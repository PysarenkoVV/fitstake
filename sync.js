/* Repact — общий прогресс через Firebase Realtime Database + аккаунты.
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

  const state = { users: null, participants: null, challenges: null, challengePaths: {}, follows: null, activity: null, reactions: null, ready: false, error: null };
  let db = null, F = null, A = null, authInstance = null, onChange = null;
  let initFailed = false;
  const challengeBuckets = { public: {}, private: {} };
  const watchedPrivate = new Set();
  let resolveAuthReady;
  const authReady = new Promise((resolve) => { resolveAuthReady = resolve; });
  // Операции, вызванные до готовности auth+db, — выполняем после подключения.
  const queued = [];
  function ready(fn, fail) {
    if (db && uid) fn();
    else if (initFailed) { if (fail) fail(); }
    else queued.push({ fn, fail });
  }
  function write(path, upd) { return F.update(F.ref(db, path), upd).then(() => true).catch(() => false); }
  function publishChallenges() {
    state.challenges = Object.assign({}, challengeBuckets.public, challengeBuckets.private);
    if (onChange) onChange();
  }
  function challengePath(id) {
    return state.challengePaths[id] || (challengeBuckets.private[id] ? "fitstake/privateChallenges/" + id : "fitstake/publicChallenges/" + id);
  }
  function watchChallenge(id) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(id || "")) || watchedPrivate.has(id)) return;
    watchedPrivate.add(id);
    ready(() => {
      F.onValue(F.ref(db, "fitstake/privateChallenges/" + id), (snap) => {
        const value = snap.val();
        if (value) {
          challengeBuckets.private[id] = value;
          state.challengePaths[id] = "fitstake/privateChallenges/" + id;
        } else {
          delete challengeBuckets.private[id];
          delete state.challengePaths[id];
        }
        publishChallenges();
      }, () => {});
    });
  }

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
      F.onValue(F.ref(db, "fitstake/publicChallenges"), (snap) => {
        challengeBuckets.public = snap.val() || {};
        for (const id of Object.keys(challengeBuckets.public)) state.challengePaths[id] = "fitstake/publicChallenges/" + id;
        publishChallenges();
        state.ready = true;
        state.error = null;
      }, () => { state.ready = true; state.error = "sync"; if (onChange) onChange(); });
      F.onValue(F.ref(db, "fitstake/follows"), (snap) => {
        state.follows = snap.val() || {};
        if (onChange) onChange();
      });
      F.onValue(F.ref(db, "fitstake/activity"), (snap) => {
        state.activity = snap.val() || {};
        if (onChange) onChange();
      });
      F.onValue(F.ref(db, "fitstake/reactions"), (snap) => {
        state.reactions = snap.val() || {};
        if (onChange) onChange();
      });
      // Состояние авторизации. Нет пользователя — входим анонимно (приложение работает сразу).
      authMod.onAuthStateChanged(authInstance, (user) => {
        if (user) {
          uid = user.uid;
          isAnon = !!user.isAnonymous;
          accountEmail = user.isAnonymous ? null : (user.email || null);
          queued.splice(0).forEach((item) => item.fn());
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
      initFailed = true;
      queued.splice(0).forEach((item) => { if (item.fail) item.fail(); });
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
    let pendingCredential = null;
    try {
      if (window.RepactNativeAuth && typeof window.RepactNativeAuth.signInGoogle === "function") {
        const tokens = await window.RepactNativeAuth.signInGoogle();
        pendingCredential = A.GoogleAuthProvider.credential(tokens.idToken || null, tokens.accessToken);
        if (cur && cur.isAnonymous) await A.linkWithCredential(cur, pendingCredential);
        else await A.signInWithCredential(authInstance, pendingCredential);
      } else if (cur && cur.isAnonymous) await A.linkWithPopup(cur, provider);
      else await A.signInWithPopup(authInstance, provider);
      refreshAuthState();
      return { ok: true };
    } catch (e) {
      if (e && e.message === "cancelled") return { ok: false, error: "cancelled" };
      const code = (e && e.code) || "error";
      // Анонимный пользователь уже существует как полноценный Google-аккаунт:
      // link пытается создать дубль и получает collision. Не регистрируем заново —
      // используем тот же Google credential для обычного входа.
      const collision = code === "auth/credential-already-in-use"
        || code === "auth/email-already-in-use"
        || code === "auth/account-exists-with-different-credential";
      if (cur && cur.isAnonymous && collision) {
        try {
          const cred = pendingCredential || A.GoogleAuthProvider.credentialFromError(e);
          if (cred) { await A.signInWithCredential(authInstance, cred); refreshAuthState(); return { ok: true }; }
        } catch {}
      }
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return { ok: false, error: "cancelled" };
      return { ok: false, error: code }; // сырой код Firebase — чтобы видеть реальную причину
    }
  }

  // Вход через Facebook. Веб и iOS WebView используют один Firebase popup-flow.
  // Анонимный аккаунт привязываем, чтобы сохранить уже набранный прогресс.
  async function signInFacebook() {
    if (!enabled || !(await waitForAuth())) return { ok: false, error: "offline" };
    const provider = new A.FacebookAuthProvider();
    provider.addScope("email");
    const cur = authInstance.currentUser;
    try {
      if (cur && cur.isAnonymous) await A.linkWithPopup(cur, provider);
      else await A.signInWithPopup(authInstance, provider);
      refreshAuthState();
      return { ok: true };
    } catch (e) {
      const code = (e && e.code) || "error";
      if (code === "auth/credential-already-in-use") {
        try {
          const cred = A.FacebookAuthProvider.credentialFromError(e);
          if (cred) { await A.signInWithCredential(authInstance, cred); refreshAuthState(); return { ok: true }; }
        } catch {}
      }
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return { ok: false, error: "cancelled" };
      return { ok: false, error: code };
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
    if (c.includes("operation-not-allowed") || c.includes("configuration-not-found") || c.includes("admin-restricted-operation") || c.includes("admin-only-operation")) return "provider-disabled";
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
      // total:0 пишем ТОЛЬКО когда снапшот загружен И нас в нём точно нет. Если
      // participants ещё null (не загрузился), не трогаем total/joinedAt — иначе
      // затрём накопленный прогресс существующего участника (гонка при старте).
      if (state.participants && !state.participants[uid]) {
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

  function createChallenge(id, meta, name) {
    return new Promise((resolve) => ready(() => {
      const base = meta.access === "private"
        ? "fitstake/privateChallenges/" + id
        : "fitstake/publicChallenges/" + id;
      state.challengePaths[id] = base;
      if (meta.access === "private") watchChallenge(id);
      const updates = {};
      updates[base + "/meta"] = Object.assign({}, meta, { ownerId: uid, createdAt: Date.now() });
      updates[base + "/participants/" + uid] = { name: name || "Player", joinedAt: Date.now(), total: 0 };
      F.update(F.ref(db), updates).then(() => resolve(true)).catch(() => resolve(false));
    }, () => resolve(false)));
  }

  function joinChallenge(id, name) {
    return new Promise((resolve) => ready(() => {
      // total:0 только если снапшот челленджей загружен и нас в участниках нет —
      // иначе (повторный заход по ссылке / гонка при старте) сохраняем прогресс.
      const rec = state.challenges && state.challenges[id];
      const isMember = rec && rec.participants && rec.participants[uid];
      const upd = { name: name || "Player" };
      if (state.challenges && !isMember) { upd.joinedAt = Date.now(); upd.total = 0; }
      F.update(F.ref(db, challengePath(id) + "/participants/" + uid), upd)
        .then(() => resolve(true)).catch(() => resolve(false));
    }, () => resolve(false)));
  }

  function leaveChallenge(id) {
    return new Promise((resolve) => ready(() => {
      F.remove(F.ref(db, challengePath(id) + "/participants/" + uid)).then(() => resolve(true)).catch(() => resolve(false));
    }, () => resolve(false)));
  }

  // Участник public-челленджа нажал «Готов!» — метка времени готовности.
  function setReady(id) {
    return new Promise((resolve) => ready(() => {
      F.set(F.ref(db, challengePath(id) + "/participants/" + uid + "/ready"), Date.now())
        .then(() => resolve(true)).catch(() => resolve(false));
    }, () => resolve(false)));
  }

  // Создатель private-челленджа задал дату старта (сегодня/завтра). Пишет только владелец.
  function setStartAt(id, ts) {
    return new Promise((resolve) => ready(() => {
      F.set(F.ref(db, challengePath(id) + "/startAt"), ts)
        .then(() => resolve(true)).catch(() => resolve(false));
    }, () => resolve(false)));
  }

  function reportChallenge(id, dateKey, perExercise, total) {
    return new Promise((resolve) => ready(() => {
      const upd = { total };
      for (const [ex, reps] of Object.entries(perExercise)) upd["days/" + dateKey + "/" + ex] = reps;
      write(challengePath(id) + "/participants/" + uid, upd).then(resolve);
    }, () => resolve(false)));
  }

  // «Провалил, но хочу продолжать»: прощаем пропуски до этой даты — misses считаются заново.
  function restart(dateKey) { if (enabled) ready(() => write("fitstake/challenge_main/participants/" + uid, { restartFrom: dateKey })); }
  function restartChallenge(id, dateKey) { if (enabled) ready(() => write(challengePath(id) + "/participants/" + uid, { restartFrom: dateKey })); }

  function setFollowing(targetUid, on) {
    return new Promise((resolve) => ready(() => {
      const ref = F.ref(db, "fitstake/follows/" + uid + "/" + targetUid);
      const op = on ? F.set(ref, true) : F.remove(ref);
      op.then(() => resolve(true)).catch(() => resolve(false));
    }, () => resolve(false)));
  }

  function publishActivity(payload) {
    if (!enabled) return;
    ready(() => {
      const rec = Object.assign({}, payload, { actorId: uid, ts: Date.now() });
      F.push(F.ref(db, "fitstake/activity"), rec).catch(() => {});
    });
  }

  function setReaction(eventId, emoji, on) {
    return new Promise((resolve) => ready(() => {
      const ref = F.ref(db, "fitstake/reactions/" + eventId + "/" + uid);
      const op = on ? F.set(ref, emoji) : F.remove(ref);
      op.then(() => resolve(true)).catch(() => resolve(false));
    }, () => resolve(false)));
  }

  // Отчёт о проблеме от тестера → общий узел bugReports (create-only по правилам БД).
  // Скриншот кладём отдельно в bugShots/{тот же id}: так разбор багов читает список
  // репортов, не выкачивая картинки. Потеря скриншота не отменяет сам отчёт.
  function reportBug(payload, shot) {
    return new Promise((resolve) => {
      if (!enabled) { resolve(false); return; }
      ready(() => {
        const rec = Object.assign({}, payload, { uid: uid || "", ts: Date.now() });
        const ref = F.push(F.ref(db, "fitstake/bugReports"));
        F.set(ref, rec)
          .then(() => (shot ? F.set(F.ref(db, "fitstake/bugShots/" + ref.key), shot).catch(() => {}) : null))
          .then(() => resolve(true))
          .catch(() => resolve(false));
      }, () => resolve(false));
    });
  }

  return {
    enabled, state, init, watchChallenge, registerUser, join, report, createChallenge, joinChallenge, leaveChallenge, reportChallenge, restart, restartChallenge, setReady, setStartAt, setFollowing, publishActivity, setReaction, reportBug, signIn, signUp, signInGoogle, signInFacebook, signOutUser,
    get uid() { return uid; },
    get email() { return accountEmail; },
    get isAnonymous() { return isAnon; },
  };
})();
