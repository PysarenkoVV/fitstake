/* FitStake — камера, MediaPipe Pose и подсчёт повторов.
   RepCounter — точный порт RepCounter.swift: угол сгиба локтей/коленей,
   гистерезис 110°/140°, grace-кадры и анти-чит по ходу корпуса. */

"use strict";

// --- Скелет: суставы, стороны, конфигурация упражнений (порт PoseModel.swift) ---
const BONES = [
  ["neck", "leftShoulder"], ["neck", "rightShoulder"], ["neck", "root"],
  ["leftShoulder", "leftElbow"], ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"], ["rightElbow", "rightWrist"],
  ["root", "leftHip"], ["root", "rightHip"],
  ["leftHip", "leftKnee"], ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"], ["rightKnee", "rightAnkle"],
];

const EX = {
  // Отжимания: кисти на полу — НИЖЕ плеч. Гейт отсекает сгибы рук, когда они подняты
  // (в комбо присед с поднятыми руками иначе засчитывался как ложное отжимание).
  pushups: {
    angleJoints: (s) => ({ a: s + "Shoulder", vertex: s + "Elbow", b: s + "Wrist" }),
    bodyJoints: ["leftShoulder", "rightShoulder"],
    wristAbove: false,
  },
  // Приседания: сгиб колена сам по себе надёжен (стоя его не подделать), а анти-чит
  // корпуса при съёмке снизу сжимает ход таза и ложно резал реальные приседы —
  // поэтому пороги мягче (стопы у края кадра к тому же шумят).
  squats: {
    angleJoints: (s) => ({ a: s + "Hip", vertex: s + "Knee", b: s + "Ankle" }),
    bodyJoints: ["leftHip", "rightHip"],
    minBodyTravel: 0.12,
    maxAnchorDrift: 1.0,
  },
  // Подтягивания: тот же локоть, но кисти на перекладине — ВЫШЕ плеч.
  // Повтор = вис (прямые руки) → подъём (сгиб <110°) → опускание (>140°).
  pullups: {
    angleJoints: (s) => ({ a: s + "Shoulder", vertex: s + "Elbow", b: s + "Wrist" }),
    bodyJoints: ["leftShoulder", "rightShoulder"],
    wristAbove: true,
  },
  // Брусья/кольца: локоть, кисти в упоре — НИЖЕ плеч. Пороги анти-чита мягче:
  // при съёмке снизу вертикальный ход корпуса сжимается, а кольца/кисти дрейфуют —
  // строгие пороги (как у отжиманий) резали реальные глубокие дипсы.
  dips: {
    angleJoints: (s) => ({ a: s + "Shoulder", vertex: s + "Elbow", b: s + "Wrist" }),
    bodyJoints: ["leftShoulder", "rightShoulder"],
    wristAbove: false,
    minBodyTravel: 0.1,
    maxAnchorDrift: 1.4,
  },
};

// Индексы landmark-точек BlazePose (33 точки).
const LM = {
  leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
};

// ==========================================================================
// RepCounter — порт RepCounter.swift
// ==========================================================================
class RepCounter {
  constructor(exercise = "pushups") {
    this.exercise = exercise;
    this.count = 0;
    this.wasDown = false;
    this.smoothedAngle = null;
    this.lostFrames = 0;
    this.tracking = false;
    this.bodyAtDown = null;
    this.leftAnchorAtDown = null;
    this.rightAnchorAtDown = null;
    this.feetAtDown = null;

    this.downThreshold = 110;
    this.upThreshold = 140;
    this.minConfidence = 0.2;
    this.smoothing = 0.5;
    this.graceFrames = 15;
    // Пороги анти-чита можно ослаблять по упражнению (см. EX).
    const cfg = EX[exercise] || {};
    this.minBodyTravel = cfg.minBodyTravel != null ? cfg.minBodyTravel : 0.3;
    this.maxAnchorDrift = cfg.maxAnchorDrift != null ? cfg.maxAnchorDrift : 0.7;
  }

  process(points, size, countingEnabled = true) {
    const sides = ["left", "right"].filter((s) => this._limbVisible(s, points));
    if (!(sides.length === 2 || (this.tracking && sides.length > 0))) {
      if (this.tracking && this.lostFrames < this.graceFrames) {
        this.lostFrames++;
        return { status: this.wasDown ? "down" : "up", bendAngle: this.smoothedAngle };
      }
      this.tracking = false;
      this.smoothedAngle = null;
      this.wasDown = false;
      this.bodyAtDown = this.leftAnchorAtDown = this.rightAnchorAtDown = this.feetAtDown = null;
      const anything = Object.values(points).some((p) => p && p.confidence > this.minConfidence);
      return { status: anything ? "partialBody" : "noBody", bendAngle: null };
    }
    this.tracking = true;
    this.lostFrames = 0;

    const raw = sides.map((s) => this._bendAngle(s, points, size)).reduce((a, b) => a + b, 0) / sides.length;
    const angle = this.smoothedAngle != null ? this.smoothedAngle + this.smoothing * (raw - this.smoothedAngle) : raw;
    this.smoothedAngle = angle;

    if (angle < this.downThreshold) {
      // Ворота позы: у подтягиваний кисти выше плеч, у брусьев ниже —
      // не даём чужому движению (отжимания от пола и т.п.) войти в повтор.
      if (!this.wasDown && this._gateOK(points)) {
        this.wasDown = true;
        this.bodyAtDown = this._bodyMid(points, size);
        this.leftAnchorAtDown = this._anchor("left", points, size);
        this.rightAnchorAtDown = this._anchor("right", points, size);
        this.feetAtDown = this._feetMid(points, size);
      }
    } else if (angle > this.upThreshold && this.wasDown) {
      this.wasDown = false;
      if (countingEnabled && this._isRealRep(points, size)) this.count++;
    }
    return { status: this.wasDown ? "down" : "up", bendAngle: angle };
  }

  // true, если положение кистей относительно плеч соответствует упражнению
  // (или упражнению всё равно — pushups/squats).
  _gateOK(points) {
    const need = EX[this.exercise].wristAbove;
    if (need === undefined) return true;
    for (const s of ["left", "right"]) {
      const w = points[s + "Wrist"], sh = points[s + "Shoulder"];
      if (!w || !sh || w.confidence <= this.minConfidence || sh.confidence <= this.minConfidence) continue;
      // y растёт вниз: «выше» = меньший y. Блокируем только при явном нарушении;
      // если кисти не видны — не мешаем (анти-чит хода корпуса проверит на выходе).
      if ((w.y < sh.y) !== need) return false;
    }
    return true;
  }

  _isRealRep(points, size) {
    if (!this.bodyAtDown) return false;
    const bodyNow = this._bodyMid(points, size);
    if (!bodyNow) return false;
    const lengths = ["left", "right"].map((s) => this._limbLength(s, points, size)).filter((v) => v != null);
    if (!lengths.length) return false;
    const scale = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    if (scale <= 0) return false;
    const drifts = [];
    if (this.leftAnchorAtDown) { const n = this._anchor("left", points, size); if (n) drifts.push(dist(n, this.leftAnchorAtDown)); }
    if (this.rightAnchorAtDown) { const n = this._anchor("right", points, size); if (n) drifts.push(dist(n, this.rightAnchorAtDown)); }
    const bodyTravel = dist(bodyNow, this.bodyAtDown);
    // Анти-чит подтягиваний: в реальном висе стопы поднимаются/опускаются ВМЕСТЕ с корпусом.
    // Если корпус ходит, а стопы стоят на месте — это присед со стойкой на полу, держась за
    // кольца/турник (стопы на земле), а не вис. Не засчитываем. Стопы не видны — не мешаем.
    if (this.exercise === "pullups" && this.feetAtDown) {
      const feetNow = this._feetMid(points, size);
      if (feetNow && dist(feetNow, this.feetAtDown) < 0.35 * bodyTravel) return false;
    }
    return bodyTravel >= this.minBodyTravel * scale && (drifts.length ? Math.max(...drifts) : 0) <= this.maxAnchorDrift * scale;
  }

  _feetMid(points, size) {
    const vis = ["leftAnkle", "rightAnkle"].map((j) => points[j]).filter((p) => p && p.confidence > this.minConfidence).map((p) => px(p, size));
    if (!vis.length) return null;
    return { x: vis.reduce((s, p) => s + p.x, 0) / vis.length, y: vis.reduce((s, p) => s + p.y, 0) / vis.length };
  }

  _bodyMid(points, size) {
    const [j0, j1] = EX[this.exercise].bodyJoints;
    const vis = [j0, j1].map((j) => points[j]).filter((p) => p && p.confidence > this.minConfidence).map((p) => px(p, size));
    if (!vis.length) return null;
    return { x: vis.reduce((s, p) => s + p.x, 0) / vis.length, y: vis.reduce((s, p) => s + p.y, 0) / vis.length };
  }

  _anchor(s, points, size) {
    const j = EX[this.exercise].angleJoints(s).b;
    const p = points[j];
    return p && p.confidence > this.minConfidence ? px(p, size) : null;
  }

  // Скелетный масштаб стороны. Обычно вершина→опора (предплечье/голень), но если
  // опора не видна (стопы в тени/за кадром при приседе), берём вершина→a (плечо/бедро) —
  // иначе повтор не засчитывался из-за отсутствия масштаба, хотя колени/бёдра видны.
  _limbLength(s, points, size) {
    const j = EX[this.exercise].angleJoints(s);
    const v = points[j.vertex];
    if (!v || v.confidence <= this.minConfidence) return null;
    const b = points[j.b], a = points[j.a];
    if (b && b.confidence > this.minConfidence) return dist(px(v, size), px(b, size));
    if (a && a.confidence > this.minConfidence) return dist(px(v, size), px(a, size));
    return null;
  }

  // Сустав годен, только если он РЕАЛЬНО в кадре: MediaPipe достраивает точки за краями
  // (y>1 / x<0) — при съёмке лица вблизи руки «домысливаются» под кадром и давали
  // ложный счёт. Требуем и уверенность, и координаты внутри [0,1].
  _inFrame(p) {
    return !!p && p.confidence > this.minConfidence && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  }

  _limbVisible(s, points) {
    const j = EX[this.exercise].angleJoints(s);
    return this._inFrame(points[j.a]) && this._inFrame(points[j.vertex]) && this._inFrame(points[j.b]);
  }

  _bendAngle(s, points, size) {
    const j = EX[this.exercise].angleJoints(s);
    return angleAt(px(points[j.vertex], size), px(points[j.a], size), px(points[j.b], size));
  }
}

function px(p, size) { return { x: p.x * size.width, y: p.y * size.height }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleAt(vertex, a, b) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y }, v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (len <= 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180 / Math.PI;
}

// ==========================================================================
// PoseSession — камера, MediaPipe, скелет, голос, запись
// ==========================================================================
let landmarkerPromise = null;
async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
      const fileset = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
      return vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })().catch((e) => {
      landmarkerPromise = null; // разрешить повторную попытку после ошибки загрузки
      // Модель/wasm грузятся из сети — без интернета это самая частая причина сбоя.
      const err = new Error(String(e && e.message || e));
      err.code = navigator.onLine === false ? "offline" : "poseLoad";
      throw err;
    });
  }
  return landmarkerPromise;
}

class PoseSession {
  constructor(exercises) {
    this.exercises = exercises;
    this.counters = exercises.map((e) => new RepCounter(e));
    this.active = 0; // комбо последовательное: считается только текущее упражнение — нет конфликтов
    this.snapshot = { results: exercises.map((e) => ({ exercise: e, repCount: 0, status: "noBody", bendAngle: null })), points: {}, imageSize: { width: 0, height: 0 } };
    this._running = false;
    this._stream = null;
    this._recording = false;
    this._recorder = null;
    this._recCanvas = null;
    this._lastTs = -1;
    this.countingEnabled = false;
  }

  // Переключить активное упражнение комбо (считается только оно).
  setActive(i) { if (i >= 0 && i < this.counters.length) this.active = i; }

  setCountingEnabled(on) {
    this.countingEnabled = !!on;
    if (on) {
      const c = this.counters[this.active];
      if (c) {
        c.wasDown = false;
        c.bodyAtDown = c.leftAnchorAtDown = c.rightAnchorAtDown = c.feetAtDown = null;
      }
    }
  }

  async start(video, canvas) {
    this._video = video;
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");
    this._stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = this._stream;
    await video.play().catch(() => {});
    await new Promise((res) => {
      if (video.videoWidth) return res();
      video.onloadedmetadata = () => res();
    });
    this._landmarker = await getLandmarker();
    this._running = true;
    this._loop();
  }

  _loop() {
    if (!this._running) return;
    const video = this._video;
    if (video && video.readyState >= 2 && video.videoWidth) {
      const size = { width: video.videoWidth, height: video.videoHeight };
      if (this._canvas.width !== size.width) { this._canvas.width = size.width; this._canvas.height = size.height; }

      let points = {};
      let ts = performance.now();
      if (ts <= this._lastTs) ts = this._lastTs + 1;
      this._lastTs = ts;
      let landmarks = null;
      try {
        const res = this._landmarker.detectForVideo(video, ts);
        if (res && res.landmarks && res.landmarks.length) landmarks = res.landmarks[0];
      } catch {}

      if (landmarks) {
        for (const [name, idx] of Object.entries(LM)) {
          const p = landmarks[idx];
          points[name] = { x: p.x, y: p.y, confidence: p.visibility != null ? p.visibility : 1 };
        }
        points.neck = mid(points.leftShoulder, points.rightShoulder);
        points.root = mid(points.leftHip, points.rightHip);
      }

      const results = this.counters.map((c, i) => {
        // Неактивные упражнения комбо на паузе: счёт заморожен, кадр не обрабатываем.
        if (i !== this.active) return { exercise: c.exercise, repCount: c.count, status: "paused", bendAngle: null };
        const r = c.process(points, size, this.countingEnabled);
        return { exercise: c.exercise, repCount: c.count, status: r.status, bendAngle: r.bendAngle };
      });
      // Всё нужное для активного упражнения в кадре — скелет зеленеет.
      const ar = results[this.active];
      const ready = !!(ar && (ar.status === "up" || ar.status === "down"));
      this.snapshot = { results, points, imageSize: size };
      this._drawSkeleton(points, size, ready);
      if (this._recording) this._drawRecordFrame(size);
    }
    requestAnimationFrame(() => this._loop());
  }

  _drawSkeleton(points, size, ready) {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, size.width, size.height);
    const on = (p) => p && p.confidence > 0.2;
    ctx.lineWidth = Math.max(3, size.width / 260);
    // Зелёный, когда всё нужное в кадре — видно, что позиция правильная; иначе оранжевый.
    ctx.strokeStyle = ready ? "rgba(77,194,128,0.95)" : "rgba(255,94,31,0.9)";
    ctx.lineCap = "round";
    for (const [a, b] of BONES) {
      const pa = points[a], pb = points[b];
      if (!on(pa) || !on(pb)) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * size.width, pa.y * size.height);
      ctx.lineTo(pb.x * size.width, pb.y * size.height);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    const r = Math.max(4, size.width / 200);
    for (const name of Object.keys(LM)) {
      const p = points[name];
      if (!on(p)) continue;
      ctx.beginPath();
      ctx.arc(p.x * size.width, p.y * size.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Запись ролика: кадр камеры + скелет + счётчик (для шеринга) ---
  _pickMime() {
    const list = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
  }
  async toggleRecording() {
    if (this._recording) {
      this._recording = false;
      await new Promise((res) => { this._recorder.onstop = res; this._recorder.stop(); });
      const blob = new Blob(this._recChunks, { type: this._recorder.mimeType || "video/webm" });
      shareVideo(blob);
      return false;
    }
    const size = this.snapshot.imageSize;
    if (!size.width) return false;
    this._recCanvas = document.createElement("canvas");
    this._recCanvas.width = size.width; this._recCanvas.height = size.height;
    this._recCtx = this._recCanvas.getContext("2d");
    const mime = this._pickMime();
    this._recChunks = [];
    this._recorder = new MediaRecorder(this._recCanvas.captureStream(30), mime ? { mimeType: mime } : undefined);
    this._recorder.ondataavailable = (e) => { if (e.data.size) this._recChunks.push(e.data); };
    this._recorder.start();
    this._recording = true;
    return true;
  }
  _drawRecordFrame(size) {
    const g = this._recCtx;
    g.save();
    g.translate(size.width, 0); g.scale(-1, 1);
    g.drawImage(this._video, 0, 0, size.width, size.height);
    g.drawImage(this._canvas, 0, 0, size.width, size.height);
    g.restore();
    const total = this.snapshot.results.reduce((s, r) => s + r.repCount, 0);
    const fs = Math.round(size.height * 0.18);
    g.font = `900 ${fs}px -apple-system, sans-serif`;
    g.textAlign = "center";
    g.fillStyle = "rgba(0,0,0,.5)";
    g.fillText(String(total), size.width / 2 + 3, size.height - fs * 0.6 + 3);
    g.fillStyle = "#fff";
    g.fillText(String(total), size.width / 2, size.height - fs * 0.6);
    g.textAlign = "left";
  }

  isRecording() { return !!this._recording; }

  stop() {
    this._running = false;
    if (this._recording && this._recorder) { try { this._recorder.stop(); } catch {} this._recording = false; }
    if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
  }
}

function mid(a, b) {
  if (!a || !b) return { x: 0, y: 0, confidence: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, confidence: Math.min(a.confidence, b.confidence) };
}

async function shareVideo(blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], "fitstake." + ext, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "FitStake" }); return; } catch {}
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fitstake." + ext;
  a.click();
}

window.PoseSession = PoseSession;
