/* FitStake — общий прогресс через Firebase Realtime Database.
   Без конфига (FIREBASE_CONFIG = null) всё выключено и приложение живёт локально.
   Схема:
     fitstake/users/{uid}: { name, joinedAt }                — все, кто прошёл онбординг
     fitstake/challenge_main/participants/{uid}:
       { name, joinedAt, total, days/{YYYY-MM-DD}/{exercise}: reps }
*/

"use strict";

window.Sync = (() => {
  const CFG = window.FIREBASE_CONFIG;
  const enabled = !!(CFG && CFG.apiKey);

  let uid = localStorage.getItem("fs.uid");
  if (!uid) {
    uid = (crypto.randomUUID ? crypto.randomUUID() : "u" + Date.now() + Math.random().toString(36).slice(2));
    localStorage.setItem("fs.uid", uid);
  }

  const state = { users: null, participants: null };
  let db = null, F = null, onChange = null;

  async function init(cb) {
    onChange = cb;
    if (!enabled) return false;
    try {
      const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const dbMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
      const fbApp = appMod.initializeApp(CFG);
      db = dbMod.getDatabase(fbApp);
      F = dbMod;
      F.onValue(F.ref(db, "fitstake/users"), (snap) => {
        state.users = snap.val() || {};
        if (onChange) onChange();
      });
      F.onValue(F.ref(db, "fitstake/challenge_main/participants"), (snap) => {
        state.participants = snap.val() || {};
        if (onChange) onChange();
      });
      return true;
    } catch (e) {
      console.warn("Sync off:", e);
      return false;
    }
  }

  // Регистрация в списке «кто в приложении»; joinedAt пишется один раз.
  function registerUser(name) {
    if (!db) return;
    const upd = { name: name || "Player" };
    if (!localStorage.getItem("fs.registered")) {
      upd.joinedAt = Date.now();
      localStorage.setItem("fs.registered", "1");
    }
    F.update(F.ref(db, "fitstake/users/" + uid), upd);
  }

  function join(name) {
    if (!db) return;
    const upd = { name: name || "Player" };
    if (!(state.participants && state.participants[uid])) {
      upd.joinedAt = Date.now();
      upd.total = 0;
    }
    F.update(F.ref(db, "fitstake/challenge_main/participants/" + uid), upd);
  }

  // Абсолютные значения за день (не дельты) — безопасно при повторной отправке.
  function report(dateKey, perExercise, total) {
    if (!db) return;
    const upd = { total };
    for (const [ex, reps] of Object.entries(perExercise)) upd["days/" + dateKey + "/" + ex] = reps;
    F.update(F.ref(db, "fitstake/challenge_main/participants/" + uid), upd);
  }

  return { enabled, uid, state, init, registerUser, join, report };
})();
