/* FitStake — общий прогресс через Firebase Realtime Database + аккаунты.
   Без конфига (FIREBASE_CONFIG = null) всё выключено и приложение живёт локально.
   uid = auth.uid. По умолчанию анонимный вход (приложение работает сразу);
   пользователь может создать аккаунт (email+пароль) — тогда прогресс синхронизируется
   между устройствами, потому что uid один и тот же везде.
   Аноним → аккаунт делаем через linkWithCredential: uid и весь прогресс сохраняются.
   Правила БД (database.rules.json): читать может каждый, писать — только в свой узел
   ($uid === auth.uid). Пишем строго по адресам .../{uid}, поэтому чужой прогресс не подделать.
   Схема:
     fitstake/users/{uid}: { name, joinedAt }                — все, кто прошёл онбординг
     fitstake/challenge_main/participants/{uid}:
       { name, joinedAt, total, days/{YYYY-MM-DD}/{exercise}: reps }
*/

"use strict";

window.Sync = (() => {
  const CFG = window.FIREBASE_CONFIG;
  const enabled = !!(CFG && CFG.apiKey);
  const V = "https://www.gstatic.com/firebasejs/10.12.2/";

  let uid = null;              // текущий auth.uid (аноним или аккаунт)
  let accountEmail = null;     // email, если вошёл в аккаунт; null у анонима
  let isAnon = true;

  const state = { users: null, participants: null };
  let db = null, F = null, A = null, authInstance = null, onChange = null;
  let resolveAuthReady;
  const authReady = new Promise((resolve) => { resolveAuthReady = resolve; });
  // Операции, вызванные до готовности auth+db, — выполняем после подключения.
  const queued = [];
  function ready(fn) { (db && uid) ? fn() : queued.push(fn); }
  function write(path, upd) { F.update(F.ref(db, path), upd).catch(() => {}); }

  async function init(cb) {
    onChange = cb;
    if (!enabled) { resolveAuthReady(false); return false; }
    try {
      const [appMod, dbMod, authMod] = await Promise.all([
        import(V + "firebase-app.js"),
        import(V + "firebase-database.js"),
        import(V + "firebase-auth.js"),
      ]);
      const fbApp = appMod.initializeApp(CFG);
      db = dbMod.getDatabase(fbApp);
      F = dbMod;
      A = authMod;
      authInstance = authMod.getAuth(fbApp);
      resolveAuthReady(true);
      // Google Analytics (Firebase) — грузим лениво и только где поддерживается,
      // чтобы не сыпать ошибками в installed-PWA/webview. Fire-and-forget: сбой не ломает sync.
      import(V + "firebase-analytics.js")
        .then((m) => m.isSupported().then((ok) => { if (ok) m.getAnalytics(fbApp); }))
        .catch(() => {});
      // Подписки на данные — пути фиксированы, от uid не зависят.
      F.onValue(F.ref(db, "fitstake/users"), (snap) => {
        state.users = snap.val() || {};
        if (onChange) onChange();
      });
      F.onValue(F.ref(db, "fitstake/challenge_main/participants"), (snap) => {
        state.participants = snap.val() || {};
        if (onChange) onChange();
      });
      // Состояние авторизации. Нет пользователя — входим анонимно (приложение работает сразу).
      authMod.onAuthStateChanged(authInstance, (user) => {
        if (user) {
          uid = user.uid;
          isAnon = !!user.isAnonymous;
          accountEmail = user.isAnonymous ? null : (user.email || null);
          queued.splice(0).forEach((fn) => fn());
          if (onChange) onChange();
        } else {
          uid = null;
          accountEmail = null;
          isAnon = true;
          authMod.signInAnonymously(authInstance).catch(() => {});
        }
      });
      return true;
    } catch (e) {
      resolveAuthReady(false);
      console.warn("Sync off:", e);
      return false;
    }
  }

  async function waitForAuth() {
    if (A && authInstance) return true;
    return authReady;
  }

  // Регистрация нового аккаунта. Сейчас аноним — привязываем email к нему через
  // linkWithCredential, сохраняя uid и весь прогресс; иначе создаём новый аккаунт.
  // Если email уже занят — вернём email-taken (пусть пользователь войдёт).
  async function signUp(email, password) {
    if (!enabled || !(await waitForAuth())) return { ok: false, error: "offline" };
    const cur = authInstance.currentUser;
    try {
      if (cur && cur.isAnonymous) {
        const credential = A.EmailAuthProvider.credential(email, password);
        await A.linkWithCredential(cur, credential);
      } else {
        await A.createUserWithEmailAndPassword(authInstance, email, password);
      }
      refreshAuthState(); // link не всегда триггерит onAuthStateChanged — обновляем сами
      return { ok: true };
    } catch (e) {
      return { ok: false, error: authError(e) };
    }
  }

  // Вход в существующий аккаунт по email+паролю. Прогресс аккаунта подтянет applySync.
  async function signIn(email, password) {
    if (!enabled || !(await waitForAuth())) return { ok: false, error: "offline" };
    try {
      await A.signInWithEmailAndPassword(authInstance, email, password);
      refreshAuthState();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: authError(e) };
    }
  }

  // Вход через Google (popup — остаёмся внутри установленной PWA, без redirect).
  // Аноним → linkWithPopup: uid и весь прогресс сохраняются. Иначе — обычный вход.
  async function signInGoogle() {
    if (!enabled || !(await waitForAuth())) return { ok: false, error: "offline" };
    const provider = new A.GoogleAuthProvider();
    const cur = authInstance.currentUser;
    try {
      if (cur && cur.isAnonymous) await A.linkWithPopup(cur, provider);
      else await A.signInWithPopup(authInstance, provider);
      refreshAuthState();
      return { ok: true };
    } catch (e) {
      const code = (e && e.code) || "error";
      // Этот Google-аккаунт уже привязан к другому uid — просто входим в него.
      if (code === "auth/credential-already-in-use") {
        try {
          const cred = A.GoogleAuthProvider.credentialFromError(e);
          if (cred) { await A.signInWithCredential(authInstance, cred); refreshAuthState(); return { ok: true }; }
        } catch {}
      }
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return { ok: false, error: "cancelled" };
      return { ok: false, error: code }; // сырой код Firebase — чтобы видеть реальную причину
    }
  }

  async function signOutUser() {
    if (A && authInstance) { try { await A.signOut(authInstance); } catch {} }
    // onAuthStateChanged(null) вернёт анонимный вход.
  }

  function refreshAuthState() {
    const u = authInstance && authInstance.currentUser;
    if (!u) return;
    uid = u.uid;
    isAnon = !!u.isAnonymous;
    accountEmail = u.isAnonymous ? null : (u.email || null);
  }

  function authError(e) {
    const c = (e && e.code) || "";
    if (c.includes("email-already-in-use") || c.includes("credential-already-in-use")) return "email-taken";
    if (c.includes("user-not-found")) return "no-account";
    if (c.includes("wrong-password") || c.includes("invalid-credential")) return "wrong-password";
    if (c.includes("weak-password")) return "weak-password";
    if (c.includes("invalid-email")) return "invalid-email";
    if (c.includes("operation-not-allowed") || c.includes("configuration-not-found")) return "provider-disabled";
    if (c.includes("unauthorized-domain")) return "unauthorized-domain";
    if (c.includes("network")) return "network";
    return c || ((e && e.message) ? String(e.message) : "error");
  }

  // Регистрация в списке «кто в приложении»; joinedAt пишется один раз на этот uid.
  function registerUser(name) {
    if (!enabled) return;
    ready(() => {
      const upd = { name: name || "Player" };
      const regKey = "fs.reg." + uid;
      if (!localStorage.getItem(regKey)) {
        upd.joinedAt = Date.now();
        localStorage.setItem(regKey, "1");
      }
      write("fitstake/users/" + uid, upd);
    });
  }

  function join(name) {
    if (!enabled) return;
    ready(() => {
      const upd = { name: name || "Player" };
      if (!(state.participants && state.participants[uid])) {
        upd.joinedAt = Date.now();
        upd.total = 0;
      }
      write("fitstake/challenge_main/participants/" + uid, upd);
    });
  }

  // Абсолютные значения за день (не дельты) — безопасно при повторной отправке.
  function report(dateKey, perExercise, total) {
    if (!enabled) return;
    const per = Object.assign({}, perExercise); // снимок на момент вызова
    ready(() => {
      const upd = { total };
      for (const [ex, reps] of Object.entries(per)) upd["days/" + dateKey + "/" + ex] = reps;
      write("fitstake/challenge_main/participants/" + uid, upd);
    });
  }

  // Отчёт о проблеме от тестера → общий узел bugReports (create-only по правилам БД).
  function reportBug(payload) {
    return new Promise((resolve) => {
      if (!enabled) { resolve(false); return; }
      ready(() => {
        const rec = Object.assign({}, payload, { uid: uid || "", ts: Date.now() });
        F.push(F.ref(db, "fitstake/bugReports"), rec).then(() => resolve(true)).catch(() => resolve(false));
      });
    });
  }

  return {
    enabled, state, init, registerUser, join, report, reportBug, signIn, signUp, signInGoogle, signOutUser,
    get uid() { return uid; },
    get email() { return accountEmail; },
    get isAnonymous() { return isAnon; },
  };
})();
