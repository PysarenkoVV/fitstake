/* FitStake — общий прогресс через Firebase Realtime Database.
   Без конфига (FIREBASE_CONFIG = null) всё выключено и приложение живёт локально.
   uid = стабильный идентификатор анонимной авторизации Firebase (auth.uid).
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

  let uid = null; // заполняется после анонимного входа

  const state = { users: null, participants: null };
  let db = null, F = null, onChange = null;
  // Операции, вызванные до готовности auth+db, — выполняем после подключения.
  const queued = [];
  function ready(fn) { (db && uid) ? fn() : queued.push(fn); }
  function write(path, upd) { F.update(F.ref(db, path), upd).catch(() => {}); }

  async function init(cb) {
    onChange = cb;
    if (!enabled) return false;
    try {
      const [appMod, dbMod, authMod] = await Promise.all([
        import(V + "firebase-app.js"),
        import(V + "firebase-database.js"),
        import(V + "firebase-auth.js"),
      ]);
      const fbApp = appMod.initializeApp(CFG);
      db = dbMod.getDatabase(fbApp);
      F = dbMod;
      // Анонимный вход: uid стабилен между визитами (сессию Firebase хранит сам),
      // повторный вызов возвращает того же пользователя.
      const auth = authMod.getAuth(fbApp);
      const cred = await authMod.signInAnonymously(auth);
      uid = cred.user.uid;
      F.onValue(F.ref(db, "fitstake/users"), (snap) => {
        state.users = snap.val() || {};
        if (onChange) onChange();
      });
      F.onValue(F.ref(db, "fitstake/challenge_main/participants"), (snap) => {
        state.participants = snap.val() || {};
        if (onChange) onChange();
      });
      queued.splice(0).forEach((fn) => fn());
      return true;
    } catch (e) {
      console.warn("Sync off:", e);
      return false;
    }
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

  return { enabled, state, init, registerUser, join, report, get uid() { return uid; } };
})();
