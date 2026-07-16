"use strict";

// FitStake workout camera session. Loaded before app.js; function bodies use app globals at runtime.
// Сессия с камерой (живёт вне цикла render, чтобы не рвать видеопоток)
// ==========================================================================
const CAN_RECORD = typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;
let liveSession = null;

async function openSession(challengeId, startExercise) {
  const isDemo = challengeId === "demo";
  const c = isDemo ? null : app.challenges.find((x) => x.id === challengeId);
  if ((!isDemo && !c) || liveSession) return;
  const goals = isDemo
    ? [{ exercise: startExercise || "pushups", target: 5, start: 0 }]
    : c.goals.map((g) => ({ exercise: g.exercise, target: C.norm(c, g), start: C.myToday(c, g.exercise) }));

  const overlay = document.createElement("div");
  overlay.className = "session";
  overlay.innerHTML = `
    <video autoplay muted playsinline></video>
    <canvas class="skeleton"></canvas>
    <div class="topbar">
      <div class="between" style="align-items:flex-start">
        <button class="cam-btn" data-sess="close" aria-label="${t("Close")}">${icon("xmark")}</button>
        <div class="sess-elapsed"><span>${t("Overall time")}</span><strong id="sess-elapsed">00:00</strong></div>
        <div class="cam-col">
          ${CAN_RECORD ? `<button class="cam-btn" data-sess="record" aria-label="${t("Record video")}">${icon("record")}</button>` : ""}
        </div>
      </div>
      <div class="hint" id="sess-hint"></div>
    </div>
    <div class="sess-countdown" id="sess-countdown" aria-live="assertive"></div>
    <div class="sess-rest" id="sess-rest" hidden>
      <div class="sess-rest-timer">
        <svg viewBox="0 0 220 220" aria-hidden="true"><circle class="rest-track" cx="110" cy="110" r="96"></circle><circle class="rest-progress" id="sess-rest-progress" cx="110" cy="110" r="96"></circle></svg>
        <div class="sess-rest-clock"><span>${t("Rest")}</span><strong id="sess-rest-time">01:30</strong></div>
      </div>
      <div class="sess-rest-summary"><div class="sess-rest-title"><span>${icon("check")}</span><strong id="sess-rest-set"></strong></div><span id="sess-rest-reps"></span><div class="sess-rest-total" id="sess-rest-total"></div></div>
      <div class="sess-rest-actions"><button class="sess-rest-plus" data-sess="restPlus">${t("+30 sec")}</button><button class="sess-rest-next" data-sess="restResume"><span class="sess-stop-mark"></span>${t("Start next set")}</button></div>
    </div>
    <div class="hud"><div id="sess-counters"></div><div id="sess-bottom" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:10px"></div></div>`;
  document.body.appendChild(overlay);

  const video = overlay.querySelector("video");
  const canvas = overlay.querySelector(".skeleton");
  const hintEl = overlay.querySelector("#sess-hint");
  const countdownEl = overlay.querySelector("#sess-countdown");
  const elapsedEl = overlay.querySelector("#sess-elapsed");
  const restEl = overlay.querySelector("#sess-rest");
  const restTimeEl = overlay.querySelector("#sess-rest-time");
  const restProgressEl = overlay.querySelector("#sess-rest-progress");
  const restSetEl = overlay.querySelector("#sess-rest-set");
  const restRepsEl = overlay.querySelector("#sess-rest-reps");
  const restTotalEl = overlay.querySelector("#sess-rest-total");
  const countersEl = overlay.querySelector("#sess-counters");
  const bottomEl = overlay.querySelector("#sess-bottom");

  // Комбо теперь последовательное: активно одно упражнение за раз, счётчик показываем один.
  // startExercise — с какого упражнения начать (кнопка play у строки / выбор с большой кнопки).
  const combo = goals.length > 1;
  let active = 0;
  if (startExercise) { const i = goals.findIndex((g) => g.exercise === startExercise); if (i >= 0) active = i; }

  const sess = new window.PoseSession(goals.map((g) => g.exercise));
  sess.setRecordingContext({
    title: isDemo ? t("Practice") : c.title,
    goals,
    day: isDemo ? null : c.currentDay,
    duration: isDemo ? null : c.durationDays,
  });
  sess.setActive(active);
  liveSession = { sess, overlay };

  // Индикатор загрузки: перекрывает экран, пока открывается камера и грузится MediaPipe.
  const loader = document.createElement("div");
  loader.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:20;background:rgba(0,0,0,.55)";
  loader.innerHTML = `<div class="spinner"></div><div style="color:#fff;font-weight:600">${t("Preparing workout…")}</div>`;
  overlay.appendChild(loader);

  try {
    await sess.start(video, canvas);
    loader.remove();
  } catch (err) {
    // Ошибка камеры/модели: завершаем сессию, чистим и предлагаем повтор — приложение не виснет.
    sess.stop();
    overlay.remove();
    liveSession = null;
    showCameraError(cameraError(err), challengeId, startExercise);
    return;
  }

  const totalFor = (g, r) => g.start + (r ? r.repCount : 0);
  const resultFor = (ex) => sess.snapshot.results.find((r) => r.exercise === ex);

  // Один счётчик — активного упражнения. В комбо над ним подпись «Упражнение · N/всего».
  let prevTotal = -1;
  function renderCounter() {
    const g = goals[active];
    const hasPrev = combo && active > 0, hasNext = combo && active < goals.length - 1;
    countersEl.className = "counter-col";
    countersEl.innerHTML = `
      <span class="cap">${esc(Exercise.displayName(g.exercise))}${combo ? ` • ${active + 1}/${goals.length}` : ""}</span>
      <div class="count-line">
        <span class="counter-big c-white" id="sess-num">${totalFor(g, resultFor(g.exercise))}</span>
        ${g.target != null ? `<span class="count-target">/ ${g.target}</span>` : ""}
      </div>
      ${hasPrev || hasNext ? `<div class="sess-nav">
        ${hasPrev ? `<button data-sess="prev">${icon("chevronLeft")}${esc(Exercise.displayName(goals[active - 1].exercise))}</button>` : ""}
        ${hasNext ? `<button data-sess="next">${esc(Exercise.displayName(goals[active + 1].exercise))}${icon("chevronRight")}</button>` : ""}
      </div>` : ""}`;
    prevTotal = totalFor(g, resultFor(g.exercise)); // сброс, чтобы пульс не сработал при смене упражнения
  }
  renderCounter();
  let prevGoalReached = false, prevBottomKey = "", prevTracked = false, lastWarnTs = 0;
  let countingStarted = false, readySince = 0, countdownShown = 0, demoFinishing = false;
  const priorWorkoutMs = isDemo ? 0 : workoutSummary(c).elapsedMs;
  let workoutStartedAt = 0, workoutStoppedAt = 0, lastClockText = "";
  let setStartTotal = 0, setReps = [];
  let resting = false, restStartedAt = 0, restEndsAt = 0, restDurationMs = 90000, restTotalMs = 0, restCuePlayed = false;

  const sessionRepTotal = () => sess.snapshot.results.reduce((sum, result) => sum + result.repCount, 0);
  const currentSetReps = () => Math.max(0, sessionRepTotal() - setStartTotal);
  const sessionElapsedMs = (now = performance.now()) => workoutStartedAt ? Math.max(0, (workoutStoppedAt || now) - workoutStartedAt) : 0;
  const elapsedWorkoutMs = (now = performance.now()) => priorWorkoutMs + sessionElapsedMs(now);
  const dayRepTotal = () => goals.reduce((sum, goal) => sum + goal.start + (resultFor(goal.exercise) ? resultFor(goal.exercise).repCount : 0), 0);
  const restClock = (ms) => {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  };
  function closeCurrentSet() {
    const reps = currentSetReps();
    if (reps <= 0) return 0;
    setReps.push(reps);
    setStartTotal = sessionRepTotal();
    return reps;
  }
  function updateElapsed(now) {
    const text = workoutClock(elapsedWorkoutMs(now));
    if (text !== lastClockText) { elapsedEl.textContent = text; lastClockText = text; }
  }
  function updateRest(now) {
    if (!resting) return;
    const remaining = Math.max(0, restEndsAt - now);
    restTimeEl.textContent = restClock(remaining);
    const circumference = 603.19;
    restProgressEl.style.strokeDashoffset = String(circumference * (1 - remaining / restDurationMs));
    if (!remaining && !restCuePlayed) {
      restCuePlayed = true;
      wsfx("transition");
      haptic([0, 60, 50, 100]);
      restEl.classList.add("ready");
    }
  }
  function startRest() {
    const reps = closeCurrentSet();
    if (!reps || resting) return;
    const now = performance.now();
    resting = true;
    restStartedAt = now;
    restDurationMs = 90000;
    restEndsAt = now + restDurationMs;
    restCuePlayed = false;
    restEl.classList.remove("ready");
    restEl.hidden = false;
    restSetEl.textContent = t("Set %lld completed", setReps.length);
    restRepsEl.textContent = t("%lld reps", reps);
    restTotalEl.textContent = t("Total %@", `${dayRepTotal()} / ${goals.reduce((sum, goal) => sum + (goal.target || 0), 0)}`);
    sess.setCountingEnabled(false);
    updateRest(now);
    prevBottomKey = "";
  }
  function resumeAfterRest() {
    if (!resting) return;
    const now = performance.now();
    restTotalMs += Math.max(0, now - restStartedAt);
    resting = false;
    restEl.hidden = true;
    restEl.classList.remove("ready");
    setStartTotal = sessionRepTotal();
    sess.setCountingEnabled(true);
    prevBottomKey = "";
  }

  function resetReadyState() {
    countingStarted = false;
    readySince = 0;
    countdownShown = 0;
    countdownEl.textContent = "";
    countdownEl.classList.remove("show");
    sess.setCountingEnabled(false);
  }

  // Плашка-уведомление поверх камеры («Push-ups completed» и т.п.) — короткая, ~1.5 с.
  function flashPlate(text) {
    const p = document.createElement("div");
    p.style.cssText = "position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);background:rgba(0,0,0,.72);color:#fff;font-weight:800;font-size:22px;padding:16px 24px;border-radius:16px;z-index:30;pointer-events:none;text-align:center";
    p.textContent = text;
    overlay.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }

  function loop() {
    if (liveSession !== undefined && liveSession && liveSession.sess === sess) {
      const results = sess.snapshot.results;
      const sessionTotal = results.reduce((s, r) => s + r.repCount, 0);
      const g = goals[active], ar = resultFor(g.exercise), total = totalFor(g, ar);
      const curReached = g.target != null && total >= g.target;
      const allReached = goals.every((x) => x.target != null && totalFor(x, resultFor(x.exercise)) >= x.target);
      const now = performance.now();
      if (sessionTotal > 0 && !workoutStartedAt) workoutStartedAt = now;
      if (allReached && workoutStartedAt && !workoutStoppedAt) { workoutStoppedAt = now; closeCurrentSet(); }
      updateElapsed(now);
      updateRest(now);

      // Счётчик активного упражнения
      const numEl = countersEl.querySelector("#sess-num");
      if (numEl) {
        numEl.textContent = total;
        const cls = curReached ? "c-money" : (ar && ar.status === "down" ? "c-accent" : "c-white");
        numEl.className = numEl.className.replace(/c-(money|accent|white)/, cls);
        // Новый засчитанный повтор: один звук по приоритету workout > exercise > milestone > rep.
        // На повторе, закрывающем упражнение/тренировку, обычный rep/milestone не звучит.
        if (total > prevTotal && total > 0) {
          const milestone = total % 10 === 0;
          const justReached = curReached && !prevGoalReached;
          const event = justReached ? (allReached ? "workout" : "exercise") : (milestone ? "milestone" : "rep");
          wsfxMain(event);
          haptic(event === "rep" ? 12 : [0, 40, 40, 90]);
          if (justReached) flashPlate(t("%@ completed", Exercise.displayName(g.exercise)));
          if (isDemo && allReached && !demoFinishing) {
            demoFinishing = true;
            setTimeout(() => { if (liveSession && liveSession.sess === sess) endSession(true); }, 700);
          }
        }
        prevTotal = total;
      }

      // Сначала стабильно находим тело, затем даём человеку 3 секунды занять позицию.
      const tracked = !!(ar && (ar.status === "up" || ar.status === "down"));
      if (!countingStarted) {
        if (!tracked) {
          readySince = 0;
          countdownShown = 0;
          countdownEl.textContent = "";
          countdownEl.classList.remove("show", "word");
        } else {
          if (!readySince) readySince = now;
          const elapsed = now - readySince;
          if (elapsed >= 500) {
            const n = 3 - Math.floor((elapsed - 500) / 1000);
            if (n > 0 && n !== countdownShown) {
              countdownShown = n;
              countdownEl.textContent = String(n);
              countdownEl.classList.remove("word");
              countdownEl.classList.add("show");
              sfx("tick");
            } else if (n <= 0) {
              countingStarted = true;
              sess.setCountingEnabled(true);
              countdownEl.textContent = t("Go!");
              countdownEl.classList.toggle("word", t("Go!").length > 4);
              setTimeout(() => countdownEl.classList.remove("show"), 650);
            }
          }
        }
      }

      // Плашка нужна только пока камера не готова. Во время нормального счёта
      // она исчезает, чтобы текст не мелькал над человеком на каждом движении.
      let hint;
      if (!ar || ar.status === "noBody") hint = t("Step into frame");
      else if (!tracked) hint = g.exercise === "squats" ? t("Both legs must be fully in frame") : t("Both arms must be fully in frame");
      else if (!countingStarted) hint = t("Body found — hold still");
      else hint = null;
      hintEl.style.display = hint ? "" : "none";
      hintEl.textContent = hint || "";
      // Пользователь вышел из кадра (был в кадре → пропал): короткий warning, не чаще раза в 4 с.
      if (prevTracked && !tracked && total > 0) {
        const nowTs = performance.now();
        if (nowTs - lastWarnTs > 4000) { wsfx("warning"); lastWarnTs = nowTs; }
      }
      prevTracked = tracked;

      // Нижняя панель: угол текущего упражнения + кнопка Завершить/Готово (переключение упражнений — в блоке счётчика)
      const angle = ar && ar.bendAngle != null ? Math.round(ar.bendAngle) : null;
      const key = `${curReached}|${allReached}|${sessionTotal}|${currentSetReps()}|${setReps.length}|${resting}|${angle}`;
      if (key !== prevBottomKey) {
        prevBottomKey = key;
        let b = angle != null ? `<span class="angle">${angle}°</span>` : "";
        if (allReached) b += `<button class="action-btn money" data-sess="finish" style="max-width:340px">${iconF("checkCircle")}${t("Finish")}</button>`;
        else if (!resting && currentSetReps() > 0) b += `<button class="sess-finish-set" data-sess="finishSet" style="max-width:340px"><span class="sess-stop-mark"></span>${t("Finish set")}</button>`;
        bottomEl.innerHTML = b;
      }
      prevGoalReached = curReached;
    }
    if (liveSession && liveSession.sess === sess) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  let finishing = false;
  // Завершение сессии. save=true — засчитать повторы; в обоих случаях активная запись
  // авто-сохраняется, чтобы видео не терялось. Двойное сохранение исключено флагом finishing.
  async function endSession(save) {
    if (finishing) return;
    finishing = true;
    const counts = {};
    sess.snapshot.results.forEach((r) => (counts[r.exercise] = r.repCount));
    const now = performance.now();
    if (sessionRepTotal() > 0 && !workoutStartedAt) workoutStartedAt = now;
    if (workoutStartedAt && !workoutStoppedAt) workoutStoppedAt = now;
    if (resting) { restTotalMs += Math.max(0, now - restStartedAt); resting = false; }
    closeCurrentSet();
    const sessionStats = { elapsedMs: sessionElapsedMs(now), restMs: restTotalMs, setReps: setReps.slice() };
    if (sess.isRecording()) { try { await sess.toggleRecording(); } catch (e) { wsfx("recError"); } }
    if (save) {
      if (isDemo) {
        sess.stop(); overlay.remove(); liveSession = null;
        openDemoComplete(Object.values(counts).reduce((sum, n) => sum + n, 0));
        return;
      }
      let closed;
      try { closed = addReps(c, counts, sessionStats); }
      catch (e) { finishing = false; toast(t("Couldn't save. Try again.")); return; } // разблокируем — можно повторить
      sess.stop(); overlay.remove(); liveSession = null;
      render();
      if (closed) { C.isFinished(c) ? openChallengeComplete(c) : openDayComplete(c); }
    } else {
      sess.stop(); overlay.remove(); liveSession = null;
    }
  }

  // Крестик: если есть засчитанные повторы — спрашиваем; иначе закрываем сразу.
  function askExit() {
    const done = sess.snapshot.results.reduce((s, r) => s + r.repCount, 0);
    if (done <= 0) { endSession(false); return; }
    if (overlay.querySelector(".sess-modal")) return;
    const dlg = document.createElement("div");
    dlg.className = "sess-modal";
    dlg.style.cssText = "position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.6)";
    dlg.innerHTML = `<div role="dialog" aria-modal="true" style="background:var(--card,#1a1a1a);border-radius:20px;padding:22px;width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px;text-align:center">
      <div style="font-weight:800;font-size:20px">${t("Finish workout?")}</div>
      <div style="color:var(--text-secondary);font-size:15px;margin-bottom:6px">${t("Save completed reps?")}</div>
      <button class="action-btn money" data-sess="doSave">${t("Save workout")}</button>
      <button class="action-btn" data-sess="doExit" style="background:var(--white-08);color:#fff">${t("Exit without saving")}</button>
      <button class="text-btn" data-sess="doContinue">${t("Continue workout")}</button>
    </div>`;
    overlay.appendChild(dlg);
  }

  overlay.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-sess]");
    if (!b) return;
    const a = b.dataset.sess;
    if (a === "close") askExit();
    else if (a === "finish") endSession(true);
    else if (a === "finishSet") startRest();
    else if (a === "restPlus") {
      if (resting) {
        restEndsAt += 30000;
        restDurationMs += 30000;
        restCuePlayed = false;
        restEl.classList.remove("ready");
        updateRest(performance.now());
      }
    }
    else if (a === "restResume") resumeAfterRest();
    else if (a === "doSave") { setBtnLoading(b, true, t("Save workout")); await endSession(true); if (document.body.contains(overlay)) setBtnLoading(b, false); }
    else if (a === "doExit") endSession(false);
    else if (a === "doContinue") { const m = overlay.querySelector(".sess-modal"); if (m) m.remove(); }
    else if (a === "next") {
      if (active < goals.length - 1) { closeCurrentSet(); active++; sess.setActive(active); resetReadyState(); wsfx("transition"); renderCounter(); prevBottomKey = ""; prevGoalReached = false; }
    }
    else if (a === "prev") {
      if (active > 0) { closeCurrentSet(); active--; sess.setActive(active); resetReadyState(); renderCounter(); prevBottomKey = ""; prevGoalReached = false; }
    }
    else if (a === "record") {
      let on;
      try { on = await sess.toggleRecording(); }
      catch (err) { wsfx("recError"); toast(t("Couldn't save. Try again.")); return; }
      if (on) { wsfx("recStart"); toast(t("Recording started")); } else wsfx("recStop");
      b.innerHTML = icon(on ? "stop" : "record");
      b.style.color = on ? "var(--red)" : "rgba(255,255,255,.85)";
    }
  });
}

// Понятное сообщение об ошибке камеры/модели по типу сбоя. denied → есть подсказка про настройки.
function cameraError(err) {
  const name = err && err.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
    return { msg: t("Camera permission denied"), hint: t("Allow camera access in your browser settings, then retry.") };
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError")
    return { msg: t("Camera not found") };
  if (err && err.code === "offline") return { msg: t("Internet connection required") };
  if (err && err.code === "poseLoad") return { msg: t("Couldn't load pose recognition") };
  return { msg: t("Camera access is needed to count your reps.") };
}

// Экран ошибки камеры поверх приложения: сообщение + Retry (заново) / Cancel (назад).
function showCameraError(info, challengeId, startExercise) {
  const ov = document.createElement("div");
  ov.className = "session";
  ov.style.cssText = "display:flex;align-items:center;justify-content:center;padding:32px;background:#000";
  ov.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;max-width:340px;color:#fff">
    <div style="width:44px;height:44px;color:rgba(255,255,255,.75)">${iconF("camera")}</div>
    <div style="font-weight:700;font-size:18px">${esc(info.msg)}</div>
    ${info.hint ? `<div style="color:rgba(255,255,255,.65);font-size:14px;line-height:1.4">${esc(info.hint)}</div>` : ""}
    <button class="action-btn money" data-err="retry" style="max-width:280px">${t("Retry")}</button>
    <button class="text-btn" data-err="cancel">${t("Cancel")}</button>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("[data-err]");
    if (!b) return;
    ov.remove();
    if (b.dataset.err === "retry") openSession(challengeId, startExercise);
  });
}

// ==========================================================================
