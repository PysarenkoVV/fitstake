/* Repact — камера, MediaPipe Pose и подсчёт повторов.
   RepCounter — точный порт RepCounter.swift: угол сгиба локтей/коленей,
   гистерезис 110°/140°, grace-кадры и анти-чит по ходу корпуса. */

"use strict";

// --- Скелет: суставы, стороны, конфигурация упражнений (порт PoseModel.swift) ---
const BONES = [
  ["head", "neck"],
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
  // angle3d: угол локтя по world-координатам (3D). В 2D-проекции при съёмке под
  // углом или узкой постановке рук (локти назад, к камере) угол почти не меняется
  // и повтор не засчитывался.
  pushups: {
    angleJoints: (s) => ({ a: s + "Shoulder", vertex: s + "Elbow", b: s + "Wrist" }),
    bodyJoints: ["leftShoulder", "rightShoulder"],
    wristAbove: false,
    angle3d: true,
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
    downThreshold: 120,
    upThreshold: 135,
    minBodyTravel: 0.12,
    maxAnchorDrift: 1.0,
    relativeBodyTravel: true,
    requireBothSides: true,
  },
  // Брусья/кольца: локоть, кисти в упоре — НИЖЕ плеч. Пороги анти-чита мягче:
  // при съёмке снизу вертикальный ход корпуса сжимается, а кольца/кисти дрейфуют —
  // строгие пороги (как у отжиманий) резали реальные глубокие дипсы.
  dips: {
    angleJoints: (s) => ({ a: s + "Shoulder", vertex: s + "Elbow", b: s + "Wrist" }),
    bodyJoints: ["leftShoulder", "rightShoulder"],
    wristAbove: false,
    downThreshold: 135,
    upThreshold: 145,
    minBodyTravel: 0.18,
    maxAnchorDrift: 1.4,
    relativeBodyTravel: true,
    // Для входа в трекинг всё ещё нужны обе руки. После этого короткое
    // перекрытие одной кисти брусом не должно обрывать уже начатый повтор.
    requireBothSides: false,
    graceFrames: 22,
    angle3d: true,
  },
};

// Индексы landmark-точек BlazePose (33 точки).
const LM = {
  nose: 0, leftEar: 7, rightEar: 8,
  leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
};
const BODY_LM_NAMES = Object.keys(LM).filter((name) => name !== "nose" && !/Ear$/.test(name));

const POSE_MIN_CONFIDENCE = 0.45;

function posePointVisible(p, confidence = POSE_MIN_CONFIDENCE) {
  return !!p && p.confidence >= confidence && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}

// MediaPipe sometimes returns a few confident landmarks for clothes, equipment or the floor.
// Accept a pose only when it contains a plausible torso and enough connected body landmarks.
function poseIsCoherent(points, exercise) {
  const visible = BODY_LM_NAMES.filter((name) => posePointVisible(points[name]));
  const upperBodyExercise = exercise === "pushups" || exercise === "dips";

  // Near the floor the torso often hides the hips from a low camera angle. For arm
  // exercises a complete, spatially plausible arm is sufficient to keep tracking.
  if (upperBodyExercise) {
    const completeArm = ["left", "right"].some((side) =>
      [side + "Shoulder", side + "Elbow", side + "Wrist"].every((name) => posePointVisible(points[name]))
    );
    const visibleArms = ["leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist"]
      .filter((name) => posePointVisible(points[name]));
    if (completeArm && visibleArms.length >= 4) {
      const xs = visibleArms.map((name) => points[name].x), ys = visibleArms.map((name) => points[name].y);
      if (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= 0.16) return true;
    }
  }

  if (visible.length < 6) return false;

  const shoulders = [points.leftShoulder, points.rightShoulder].filter((p) => posePointVisible(p));
  const hips = [points.leftHip, points.rightHip].filter((p) => posePointVisible(p));
  if (!shoulders.length || !hips.length) return false;

  const center = (items) => ({
    x: items.reduce((sum, p) => sum + p.x, 0) / items.length,
    y: items.reduce((sum, p) => sum + p.y, 0) / items.length,
  });
  const shoulder = center(shoulders), hip = center(hips);
  if (Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y) < 0.08) return false;

  const xs = visible.map((name) => points[name].x), ys = visible.map((name) => points[name].y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= 0.22;
}

function poseQualityIssue(points, exercise, brightness, hasLandmarks) {
  if (brightness != null && brightness < 38) return "tooDark";
  if (!hasLandmarks) return "noBody";

  const confident = BODY_LM_NAMES.filter((name) => points[name] && points[name].confidence >= POSE_MIN_CONFIDENCE);
  const outside = confident.filter((name) => {
    const p = points[name];
    return p.x < 0.02 || p.x > 0.98 || p.y < 0.02 || p.y > 0.98;
  });
  if (outside.length >= 2) return "stepBack";
  if (poseIsCoherent(points, exercise)) return null;
  if (exercise === "squats") return "showLegs";
  if (exercise === "pushups" || exercise === "pullups" || exercise === "dips") return "showArms";
  return "noBody";
}

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
    this.armed = false;
    this.downFrames = 0;
    this.upFrames = 0;
    this.lastCountAt = -Infinity;
    this.rangeTopOffset = null;
    this.rangeBodyProgress = null;
    this.rangeScale = null;
    this.smoothedRangePosition = null;
    this.dipGripAnchors = { left: null, right: null };
    this.dipGripCandidates = { left: null, right: null };
    this.dipGripStableFrames = 0;
    this.dipGripReady = false;
    this.dipGripLocked = false;

    const cfg = EX[exercise] || {};
    this.downThreshold = cfg.downThreshold != null ? cfg.downThreshold : 110;
    this.upThreshold = cfg.upThreshold != null ? cfg.upThreshold : 140;
    this.minConfidence = POSE_MIN_CONFIDENCE;
    this.smoothing = 0.5;
    this.graceFrames = cfg.graceFrames != null ? cfg.graceFrames : 15;
    this.stableFrames = 3;
    this.minRepMs = 600;
    // Пороги анти-чита можно ослаблять по упражнению (см. EX).
    this.minBodyTravel = cfg.minBodyTravel != null ? cfg.minBodyTravel : 0.3;
    this.maxAnchorDrift = cfg.maxAnchorDrift != null ? cfg.maxAnchorDrift : 0.7;
    this.relativeBodyTravel = !!cfg.relativeBodyTravel;
    this.requireBothSides = !!cfg.requireBothSides;
    this.use3d = !!cfg.angle3d;
  }

  process(points, size, countingEnabled = true, now = performance.now()) {
    if (this.exercise === "dips") this._updateDipGripAnchors(points, size);
    const sides = ["left", "right"].filter((s) => this._limbVisible(s, points));
    const enoughSides = sides.length === 2 || (!this.requireBothSides && this.tracking && sides.length > 0);
    if (!enoughSides) {
      if (this.tracking && this.lostFrames < this.graceFrames) {
        this.lostFrames++;
        return {
          status: this.wasDown ? "down" : "up",
          bendAngle: this.smoothedAngle,
          rangePosition: this.smoothedRangePosition,
        };
      }
      this.tracking = false;
      this.smoothedAngle = null;
      this.wasDown = false;
      this.armed = false;
      this.downFrames = this.upFrames = 0;
      this.rangeTopOffset = null;
      this.rangeBodyProgress = null;
      this.rangeScale = null;
      this.smoothedRangePosition = null;
      this.bodyAtDown = this.leftAnchorAtDown = this.rightAnchorAtDown = this.feetAtDown = null;
      if (this.exercise === "dips") this._resetDipGripCalibration();
      const anything = Object.values(points).some((p) => p && p.confidence > this.minConfidence);
      return { status: anything ? "partialBody" : "noBody", bendAngle: null };
    }
    this.tracking = true;
    this.lostFrames = 0;

    const sideAngles = sides.map((s) => this._bendAngle(s, points, size));
    // При съёмке отжиманий под углом дальний локоть часто выглядит заметно прямее
    // ближнего. Среднее двух углов не доходило до порога, хотя повтор был полным.
    // Внизу достаточно подтверждённого сгиба одной руки, наверху — подтверждённого
    // разгибания; реальный ход корпуса ниже всё равно отсекает движения одной рукой.
    const useRobustArmAngle = (this.exercise === "pushups" || this.exercise === "dips") && sideAngles.length > 1;
    const raw = useRobustArmAngle
      ? (this.wasDown || !this.armed ? Math.max(...sideAngles) : Math.min(...sideAngles))
      : sideAngles.reduce((a, b) => a + b, 0) / sideAngles.length;
    const angle = this.smoothedAngle != null ? this.smoothedAngle + this.smoothing * (raw - this.smoothedAngle) : raw;
    this.smoothedAngle = angle;

    const bodyMotion = this._bodyRangeMotion(points, size, angle);
    const dipMotion = this.exercise === "dips" ? bodyMotion : null;
    const reachedDown = angle < this.downThreshold || (dipMotion && dipMotion.countProgress >= 0.90);
    const reachedUp = angle > this.upThreshold
      || (this.wasDown
        && dipMotion
        && dipMotion.countProgress <= 0.20
        && angle >= this.upThreshold - 5);

    if (reachedDown) {
      this.downFrames++;
      this.upFrames = 0;
      // Ворота позы: у подтягиваний кисти выше плеч, у брусьев ниже —
      // не даём чужому движению (отжимания от пола и т.п.) войти в повтор.
      const gripReady = this.exercise !== "dips" || this.dipGripReady;
      if (!this.wasDown && this.armed && this.downFrames >= this.stableFrames && gripReady && this._gateOK(points)) {
        this.wasDown = true;
        this.armed = false;
        if (this.exercise === "dips") this.dipGripLocked = true;
        this.bodyAtDown = this._bodyMid(points, size);
        this.leftAnchorAtDown = this._anchor("left", points, size);
        this.rightAnchorAtDown = this._anchor("right", points, size);
        this.feetAtDown = this._feetMid(points, size);
      }
    } else if (reachedUp) {
      this.upFrames++;
      this.downFrames = 0;
      if (this.wasDown && this.upFrames >= this.stableFrames) {
        this.wasDown = false;
        if (countingEnabled && now - this.lastCountAt >= this.minRepMs && this._isRealRep(points, size)) {
          this.count++;
          this.lastCountAt = now;
        }
        this.armed = true;
      } else if (!this.wasDown && this.upFrames >= this.stableFrames) this.armed = true;
    } else {
      this.downFrames = this.upFrames = 0;
    }
    const anglePosition = Math.max(0, Math.min(1,
      (this.upThreshold - angle) / Math.max(1, this.upThreshold - this.downThreshold)
    ));
    // Приседания считаются по углу колена: при нижнем ракурсе вертикальный ход таза
    // сжимается и не должен замораживать подсказку, пока колено явно сгибается.
    const useBodyRange = !!bodyMotion && (this.exercise === "dips" || this.exercise === "pullups");
    const targetPosition = useBodyRange ? bodyMotion.progress : anglePosition;
    this.smoothedRangePosition = useBodyRange
      ? targetPosition
      : (this.smoothedRangePosition == null
        ? targetPosition
        : this.smoothedRangePosition + 0.24 * (targetPosition - this.smoothedRangePosition));
    return {
      status: this.wasDown ? "down" : "up",
      bendAngle: angle,
      rangePosition: Math.max(0, Math.min(1, this.smoothedRangePosition)),
    };
  }

  // На брусьях кисти физически остаются на одном месте, но PoseLandmarker при
  // нижнем ракурсе иногда переносит landmark кисти вниз по стойке. Запоминаем
  // первый надёжный хват и принимаем только небольшие последующие поправки.
  _updateDipGripAnchors(points, size) {
    const sides = ["left", "right"];
    const arms = sides.map((side) => ({
      side,
      shoulder: points[side + "Shoulder"],
      elbow: points[side + "Elbow"],
      wrist: points[side + "Wrist"],
    }));
    if (arms.some(({ shoulder, elbow, wrist }) =>
      !this._inFrame(shoulder) || !this._inFrame(elbow) || !this._inFrame(wrist))) {
      if (!this.dipGripLocked) this._clearDipGripCandidate();
      return;
    }

    const scales = arms.map(({ shoulder, elbow }) => dist(px(shoulder, size), px(elbow, size)));
    const armScale = scales.reduce((sum, value) => sum + value, 0) / scales.length;
    if (armScale <= 0) return;

    if (this.dipGripLocked) {
      for (const { side, wrist } of arms) {
        const saved = this.dipGripAnchors[side];
        if (saved && dist(px(wrist, size), px(saved, size)) <= armScale * 0.30) {
          blendPosePoint(saved, wrist, 0.10);
        }
      }
      return;
    }

    // До первого спуска не считаем первую увиденную кисть хватом. Обе руки
    // должны несколько кадров оставаться неподвижными в верхней позиции — так
    // подход к снаряду не фиксирует случайную опору, а реальный хват успевает
    // перекалиброваться перед началом повтора.
    const topReady = arms.every(({ side }) => this._liveBendAngle(side, points, size) >= this.upThreshold - 5);
    if (!topReady) {
      const gripDrifted = this.dipGripReady && arms.some(({ side, wrist }) => {
        const saved = this.dipGripAnchors[side];
        return !saved || dist(px(wrist, size), px(saved, size)) > armScale * 0.30;
      });
      if (gripDrifted) this.dipGripReady = false;
      if (!this.dipGripReady) this._clearDipGripCandidate();
      return;
    }
    const candidateMoved = arms.some(({ side, wrist }) => {
      const candidate = this.dipGripCandidates[side];
      return !candidate || dist(px(wrist, size), px(candidate, size)) > armScale * 0.08;
    });
    if (candidateMoved) {
      const movedAwayFromGrip = arms.some(({ side, wrist }) => {
        const saved = this.dipGripAnchors[side];
        return !saved || dist(px(wrist, size), px(saved, size)) > armScale * 0.12;
      });
      if (movedAwayFromGrip) this.dipGripReady = false;
      for (const { side, wrist } of arms) this.dipGripCandidates[side] = clonePosePoint(wrist);
      this.dipGripStableFrames = 1;
      return;
    }
    this.dipGripStableFrames++;
    if (this.dipGripStableFrames < 4) return;

    const recalibrated = arms.some(({ side }) => {
      const saved = this.dipGripAnchors[side];
      return !saved || dist(px(saved, size), px(this.dipGripCandidates[side], size)) > armScale * 0.12;
    });
    for (const { side } of arms) this.dipGripAnchors[side] = clonePosePoint(this.dipGripCandidates[side]);
    this.dipGripReady = true;
    if (recalibrated) {
      this.rangeTopOffset = null;
      this.rangeBodyProgress = null;
      this.rangeScale = null;
      this.smoothedRangePosition = null;
    }
  }

  _clearDipGripCandidate() {
    this.dipGripCandidates = { left: null, right: null };
    this.dipGripStableFrames = 0;
  }

  _resetDipGripCalibration() {
    this.dipGripAnchors = { left: null, right: null };
    this.dipGripReady = false;
    this.dipGripLocked = false;
    this._clearDipGripCandidate();
  }

  _jointPoint(side, name, points) {
    if (this.exercise === "dips" && name === side + "Wrist" && this.dipGripAnchors[side]) {
      return this.dipGripAnchors[side];
    }
    return points[name];
  }

  // Положение корпуса относительно опорных кистей, нормализованное длиной руки.
  // Для dips это дополнительный сигнал счётчика, для всех упражнений — стабильная
  // координата индикатора, которая не прыгает между углами левой и правой стороны.
  _bodyRangeMotion(points, size, angle) {
    const body = this._bodyMid(points, size);
    const anchors = ["left", "right"].map((side) => this._anchor(side, points, size)).filter(Boolean);
    const lengths = ["left", "right"].map((side) => this._limbLength(side, points, size)).filter((value) => value != null);
    if (!body || !anchors.length || !lengths.length) return null;
    const anchorY = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length;
    const scale = lengths.reduce((sum, value) => sum + value, 0) / lengths.length;
    if (scale <= 0) return null;
    if (this.rangeScale == null) this.rangeScale = scale;
    const offset = (body.y - anchorY) / this.rangeScale;
    if (this.rangeTopOffset == null) this.rangeTopOffset = offset;
    const direction = this.exercise === "pullups" ? -1 : 1;
    const displacement = direction * (offset - this.rangeTopOffset);
    const nearTop = Math.abs(displacement) <= this.minBodyTravel * 0.20;
    if (!this.wasDown && angle >= this.upThreshold && nearTop) {
      this.rangeScale += 0.08 * (scale - this.rangeScale);
      // Медленно подстраиваем верхнюю норму только при подтверждённом распрямлении,
      // чтобы калибровка не следовала за корпусом во время спуска.
      this.rangeTopOffset += 0.08 * (offset - this.rangeTopOffset);
    }
    const normalizedTravel = Math.max(0, direction * (offset - this.rangeTopOffset));
    const countProgress = Math.max(0, Math.min(1,
      normalizedTravel / Math.max(0.01, this.minBodyTravel)
    ));
    const guideTravel = this.exercise === "dips"
      ? Math.max(0.65, this.minBodyTravel)
      : this.minBodyTravel;
    const rawProgress = Math.max(0, Math.min(1,
      normalizedTravel / Math.max(0.01, guideTravel)
    ));
    this.rangeBodyProgress = this.rangeBodyProgress == null
      ? rawProgress
      : this.rangeBodyProgress + 0.32 * (rawProgress - this.rangeBodyProgress);
    return {
      progress: Math.max(0, Math.min(1, this.rangeBodyProgress)),
      countProgress,
    };
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
    let measuredTravel = bodyTravel;
    if (this.relativeBodyTravel) {
      const downAnchors = [this.leftAnchorAtDown, this.rightAnchorAtDown].filter(Boolean);
      const nowAnchors = [this._anchor("left", points, size), this._anchor("right", points, size)].filter(Boolean);
      if (downAnchors.length && nowAnchors.length) {
        const avg = (list) => ({ x: list.reduce((s, p) => s + p.x, 0) / list.length, y: list.reduce((s, p) => s + p.y, 0) / list.length });
        const anchorDown = avg(downAnchors), anchorNow = avg(nowAnchors);
        measuredTravel = Math.abs((this.bodyAtDown.y - anchorDown.y) - (bodyNow.y - anchorNow.y));
      }
    }
    // Анти-чит подтягиваний: в реальном висе стопы поднимаются/опускаются ВМЕСТЕ с корпусом.
    // Если корпус ходит, а стопы стоят на месте — это присед со стойкой на полу, держась за
    // кольца/турник (стопы на земле), а не вис. Не засчитываем. Стопы не видны — не мешаем.
    if (this.exercise === "pullups" && this.feetAtDown) {
      const feetNow = this._feetMid(points, size);
      if (feetNow && dist(feetNow, this.feetAtDown) < 0.35 * bodyTravel) return false;
    }
    return measuredTravel >= this.minBodyTravel * scale && (drifts.length ? Math.max(...drifts) : 0) <= this.maxAnchorDrift * scale;
  }

  _feetMid(points, size) {
    const vis = ["leftAnkle", "rightAnkle"].map((j) => points[j]).filter((p) => p && p.confidence > this.minConfidence).map((p) => px(p, size));
    if (!vis.length) return null;
    return { x: vis.reduce((s, p) => s + p.x, 0) / vis.length, y: vis.reduce((s, p) => s + p.y, 0) / vis.length };
  }

  _bodyMid(points, size) {
    if (this.exercise === "dips") {
      const shoulder = jointMid(points, ["leftShoulder", "rightShoulder"], size, this.minConfidence);
      if (!shoulder) return null;
      const hip = jointMid(points, ["leftHip", "rightHip"], size, this.minConfidence);
      // Бёдра подтверждают реальное опускание всего тела и отсекают сгиб рук
      // вместе с пожиманием плеч. Короткие пропажи бёдер уже сглаживаются и
      // удерживаются PoseSession; плечи остаются запасным сигналом для низкой камеры.
      return hip || shoulder;
    }
    const [j0, j1] = EX[this.exercise].bodyJoints;
    const vis = [j0, j1].map((j) => points[j]).filter((p) => p && p.confidence > this.minConfidence).map((p) => px(p, size));
    if (!vis.length) return null;
    return { x: vis.reduce((s, p) => s + p.x, 0) / vis.length, y: vis.reduce((s, p) => s + p.y, 0) / vis.length };
  }

  _anchor(s, points, size) {
    const j = EX[this.exercise].angleJoints(s).b;
    const p = this._jointPoint(s, j, points);
    return p && p.confidence > this.minConfidence ? px(p, size) : null;
  }

  // Скелетный масштаб стороны. Обычно вершина→опора (предплечье/голень), но если
  // опора не видна (стопы в тени/за кадром при приседе), берём вершина→a (плечо/бедро) —
  // иначе повтор не засчитывался из-за отсутствия масштаба, хотя колени/бёдра видны.
  _limbLength(s, points, size) {
    const j = EX[this.exercise].angleJoints(s);
    const v = points[j.vertex];
    if (!v || v.confidence <= this.minConfidence) return null;
    const b = this._jointPoint(s, j.b, points), a = points[j.a];
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
    return this._inFrame(points[j.a])
      && this._inFrame(points[j.vertex])
      && this._inFrame(this._jointPoint(s, j.b, points));
  }

  _bendAngle(s, points, size) {
    return this.exercise === "dips"
      ? this._liveBendAngle(s, points, size)
      : this._jointBendAngle(s, points, size);
  }

  _liveBendAngle(s, points, size) {
    const j = EX[this.exercise].angleJoints(s);
    const v = points[j.vertex], a = points[j.a], b = points[j.b] || this._jointPoint(s, j.b, points);
    if (this.use3d && v.world && a.world && b.world) return angleAt3(v.world, a.world, b.world);
    return angleAt(px(v, size), px(a, size), px(b, size));
  }

  _jointBendAngle(s, points, size) {
    const j = EX[this.exercise].angleJoints(s);
    const v = points[j.vertex], a = points[j.a], b = this._jointPoint(s, j.b, points);
    if (this.use3d && v.world && a.world && b.world) return angleAt3(v.world, a.world, b.world);
    return angleAt(px(v, size), px(a, size), px(b, size));
  }
}

function px(p, size) { return { x: p.x * size.width, y: p.y * size.height }; }
function clonePosePoint(point) {
  return {
    ...point,
    world: point.world ? { ...point.world } : undefined,
  };
}
function blendPosePoint(target, source, amount) {
  for (const key of ["x", "y", "z"]) {
    if (Number.isFinite(source[key])) target[key] += amount * (source[key] - target[key]);
  }
  if (source.world) {
    if (!target.world) target.world = { ...source.world };
    else {
      for (const key of ["x", "y", "z"]) {
        if (Number.isFinite(source.world[key])) target.world[key] += amount * (source.world[key] - target.world[key]);
      }
    }
  }
  target.confidence = Math.max(target.confidence || 0, source.confidence || 0);
}
function jointMid(points, names, size, confidence) {
  const visible = names.map((name) => points[name])
    .filter((p) => p && p.confidence > confidence)
    .map((p) => px(p, size));
  if (!visible.length) return null;
  return {
    x: visible.reduce((sum, p) => sum + p.x, 0) / visible.length,
    y: visible.reduce((sum, p) => sum + p.y, 0) / visible.length,
  };
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angleAt(vertex, a, b) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y }, v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (len <= 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180 / Math.PI;
}
function angleAt3(vertex, a, b) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y, z: a.z - vertex.z };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y, z: b.z - vertex.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const len = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z);
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
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
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
    this._coherentFrames = 0;
    this._incoherentFrames = 0;
    this._poseAccepted = false;
    this._brightness = null;
    this._brightnessAt = -Infinity;
    this._stableDipPoints = {};
    this._dipPointAge = {};
    this._visualPoints = {};
    this._visualLostFrames = 0;
    this._trackingEnabled = true;
    this._lastVideoTime = -1;
    this.countingEnabled = false;
    this.facing = "user";   // "user" (фронталка) | "environment" (задняя)
    this.zoom = 1;          // 1× | 0.5× — 0.5 = задний ультра-ширик (отдельная линза)
    this._lenses = null;    // { ultra: deviceId } — узнаём после выдачи доступа
  }

  // Переключить активное упражнение комбо (считается только оно).
  setActive(i) { if (i >= 0 && i < this.counters.length) this.active = i; }

  setCountingEnabled(on, preserveCurrentRep = false) {
    this.countingEnabled = !!on;
    if (on && !preserveCurrentRep) {
      const c = this.counters[this.active];
      if (c) {
        c.wasDown = false;
        c.downFrames = c.upFrames = 0;
        c.armed = c.smoothedAngle != null && c.smoothedAngle > c.upThreshold;
        c.bodyAtDown = c.leftAnchorAtDown = c.rightAnchorAtDown = c.feetAtDown = null;
      }
    }
  }

  setTrackingEnabled(on) {
    this._trackingEnabled = !!on;
    this._lastVideoTime = -1;
    if (!this._trackingEnabled) {
      this._visualPoints = {};
      this._visualLostFrames = 0;
      if (this._ctx && this._canvas) this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    }
  }

  setRecordingContext(context) { this.recordingContext = context || null; }

  async start(video, canvas) {
    const generation = (this._startGeneration || 0) + 1;
    this._startGeneration = generation;
    this._video = video;
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d");
    const stream = await navigator.mediaDevices.getUserMedia({ video: this._videoConstraints(), audio: false });
    if (this._startGeneration !== generation) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException("Workout startup cancelled", "AbortError");
    }
    this._stream = stream;
    video.srcObject = this._stream;
    await video.play().catch(() => {});
    await new Promise((resolve, reject) => {
      if (video.videoWidth) return resolve();
      const cleanup = () => { video.onloadedmetadata = null; this._cancelStart = null; };
      video.onloadedmetadata = () => { cleanup(); resolve(); };
      this._cancelStart = () => { cleanup(); reject(new DOMException("Workout startup cancelled", "AbortError")); };
    });
    await this._findLenses(); // узнать про задний ультра-ширик для кнопки 0.5×
    if (this._startGeneration !== generation) throw new DOMException("Workout startup cancelled", "AbortError");
    this._landmarker = await getLandmarker();
    if (this._startGeneration !== generation) throw new DOMException("Workout startup cancelled", "AbortError");
    this._running = true;
    this._loop();
  }

  // Ограничения потока под текущие камеру/зум. 0.5× — это отдельная физическая
  // линза (ультра-ширик), цифровым зумом её не получить — только по deviceId.
  _videoConstraints() {
    // 960×540 достаточно для lite-модели и заметно снижает задержку внутри
    // iOS WebView по сравнению с обработкой 1280×720.
    const base = { width: { ideal: 960, max: 960 }, height: { ideal: 540, max: 540 } };
    if (this.facing === "environment" && this.zoom === 0.5 && this._lenses && this._lenses.ultra) {
      return Object.assign({ deviceId: { exact: this._lenses.ultra } }, base);
    }
    return Object.assign({ facingMode: this.facing }, base);
  }

  // После выдачи доступа к камере ищем заднюю ультра-широкую (iOS: «Back Ultra Wide Camera»).
  async _findLenses() {
    try {
      const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      const ultra = cams.find((d) => /ultra|0\.5/i.test(d.label || ""));
      this._lenses = { ultra: ultra ? ultra.deviceId : null };
    } catch { this._lenses = { ultra: null }; }
  }

  hasUltraWide() { return !!(this._lenses && this._lenses.ultra); }
  isMirrored() { return this.facing === "user"; }

  _loop() {
    if (!this._running) return;
    const video = this._video;
    if (!this._trackingEnabled) {
      if (this._recording && video && video.readyState >= 2 && video.videoWidth && video.currentTime !== this._lastVideoTime) {
        this._lastVideoTime = video.currentTime;
        this._drawRecordFrame({ width: video.videoWidth, height: video.videoHeight });
      }
      requestAnimationFrame(() => this._loop());
      return;
    }
    // RAF в iOS WebView часто быстрее реальной камеры. Повторный detectForVideo
    // на том же кадре зря блокирует главный поток, скелет и индикаторы.
    if (video && video.currentTime === this._lastVideoTime) {
      requestAnimationFrame(() => this._loop());
      return;
    }
    if (video && video.readyState >= 2 && video.videoWidth) {
      this._lastVideoTime = video.currentTime;
      const size = { width: video.videoWidth, height: video.videoHeight };
      if (this._canvas.width !== size.width || this._canvas.height !== size.height) {
        this._canvas.width = size.width;
        this._canvas.height = size.height;
      }

      let points = {};
      let ts = performance.now();
      if (ts <= this._lastTs) ts = this._lastTs + 1;
      this._lastTs = ts;
      let landmarks = null, world = null;
      try {
        const res = this._landmarker.detectForVideo(video, ts);
        if (res && res.landmarks && res.landmarks.length) {
          landmarks = res.landmarks[0];
          world = res.worldLandmarks && res.worldLandmarks[0] || null;
        }
        this._detectFails = 0;
      } catch {
        // Инстанс мог «умереть» (потеря GPU/WebGL-контекста после фона на iOS) —
        // после серии сбоев пересоздаём landmarker, иначе скелет пропадёт навсегда.
        this._detectFails = (this._detectFails || 0) + 1;
        if (this._detectFails % 90 === 0 && !this._recovering) this._recoverLandmarker();
      }

      if (landmarks) {
        for (const [name, idx] of Object.entries(LM)) {
          const p = landmarks[idx];
          const w = world && world[idx];
          const visibility = p.visibility != null ? p.visibility : 1;
          const presence = p.presence != null ? p.presence : 1;
          points[name] = { x: p.x, y: p.y, confidence: Math.min(visibility, presence), world: w ? { x: w.x, y: w.y, z: w.z } : null };
        }
        if (this.exercises[this.active] === "dips") {
          points = this._stabilizeDipPoints(this._correctDipSideSwap(points));
        } else {
          this._stableDipPoints = {};
          this._dipPointAge = {};
        }
        points.neck = mid(points.leftShoulder, points.rightShoulder);
        points.root = mid(points.leftHip, points.rightHip);
        points.head = headMid(points);
      }

      const brightness = this._sampleBrightness(video, ts);
      const quality = {
        brightness,
        issue: poseQualityIssue(points, this.exercises[this.active], brightness, !!landmarks),
      };

      if (poseIsCoherent(points, this.exercises[this.active])) {
        this._coherentFrames++;
        this._incoherentFrames = 0;
        if (this._coherentFrames >= 3) this._poseAccepted = true;
      } else {
        this._coherentFrames = 0;
        this._incoherentFrames++;
        if (this._incoherentFrames >= 6) this._poseAccepted = false;
      }
      const acceptedPoints = this._poseAccepted ? points : {};

      const results = this.counters.map((c, i) => {
        // Неактивные упражнения комбо на паузе: счёт заморожен, кадр не обрабатываем.
        if (i !== this.active) return { exercise: c.exercise, repCount: c.count, status: "paused", bendAngle: null };
        const r = c.process(acceptedPoints, size, this.countingEnabled);
        const guidePhase = c.wasDown || !c.armed ? "up" : "down";
        const position = r.rangePosition == null ? 0 : r.rangePosition;
        const guideProgress = guidePhase === "up" ? 1 - position : position;
        return {
          exercise: c.exercise,
          repCount: c.count,
          status: r.status,
          bendAngle: r.bendAngle,
          rangePosition: position,
          guidePhase,
          guideProgress,
        };
      });
      // Всё нужное для активного упражнения в кадре — скелет зеленеет.
      const ar = results[this.active];
      const ready = !!(ar && (ar.status === "up" || ar.status === "down"));
      this.snapshot = { results, points: acceptedPoints, imageSize: size, quality };
      this._drawSkeleton(this._smoothVisualPoints(acceptedPoints), size, ready);
      if (this._recording) this._drawRecordFrame(size);
    }
    requestAnimationFrame(() => this._loop());
  }

  _drawSkeleton(points, size, ready) {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, size.width, size.height);
    const on = (p) => posePointVisible(p);
    const exercise = this.exercises[this.active];
    const hideLegs = exercise === "pushups" || exercise === "dips";
    const hideHead = exercise === "pushups" || exercise === "squats";
    const hidden = (name) => (hideLegs && /Knee|Ankle$/.test(name)) || (hideHead && name === "head");
    ctx.lineWidth = Math.max(3, size.width / 260);
    // Изумрудный, когда всё нужное в кадре; иначе брендовый лайм.
    ctx.strokeStyle = ready ? "rgba(69,212,131,0.95)" : "rgba(200,255,33,0.9)";
    ctx.lineCap = "round";
    for (const [a, b] of BONES) {
      if (hidden(a) || hidden(b)) continue;
      const pa = points[a], pb = points[b];
      if (!on(pa) || !on(pb)) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * size.width, pa.y * size.height);
      ctx.lineTo(pb.x * size.width, pb.y * size.height);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    const r = Math.max(4, size.width / 200);
    for (const name of Object.keys(LM).filter((name) => !/Ear$/.test(name) && name !== "nose")) {
      if (hidden(name)) continue;
      const p = points[name];
      if (!on(p)) continue;
      ctx.beginPath();
      ctx.arc(p.x * size.width, p.y * size.height, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const head = points.head;
    if (!hideHead && on(head)) {
      const shoulderWidth = on(points.leftShoulder) && on(points.rightShoulder)
        ? Math.abs(points.rightShoulder.x - points.leftShoulder.x) * size.width
        : size.width / 10;
      ctx.beginPath();
      ctx.arc(head.x * size.width, head.y * size.height, Math.max(r * 1.8, shoulderWidth * 0.18), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Счётчик получает быстрые acceptedPoints выше, а более сильное сглаживание
  // применяется только к нарисованному скелету и записываемому видео.
  _smoothVisualPoints(points) {
    if (!Object.keys(points).length) {
      this._visualLostFrames++;
      if (this._visualLostFrames > 5) this._visualPoints = {};
      return {};
    }
    this._visualLostFrames = 0;
    const previous = this._visualPoints;
    const next = {};
    for (const [name, current] of Object.entries(points)) {
      const prev = previous[name];
      if (!current || !posePointVisible(current) || !prev) {
        if (current) next[name] = current;
        continue;
      }
      const distance = Math.hypot(current.x - prev.x, current.y - prev.y);
      const likelyOutlier = distance > .22 && current.confidence < prev.confidence * .75;
      if (likelyOutlier) {
        next[name] = prev;
        continue;
      }
      const alpha = /Elbow|Wrist|Knee|Ankle$/.test(name) ? .78
        : /Shoulder|Hip$|neck|root/.test(name) ? .62
          : .58;
      next[name] = {
        ...current,
        x: prev.x + alpha * (current.x - prev.x),
        y: prev.y + alpha * (current.y - prev.y),
        world: smoothWorld(prev.world, current.world, alpha),
      };
    }
    this._visualPoints = next;
    return next;
  }

  // MediaPipe изредка на один кадр переставляет левую и правую стороны.
  // На брусьях руки не пересекаются, поэтому выбираем назначение с меньшим
  // перемещением относительно предыдущего устойчивого кадра.
  _correctDipSideSwap(points) {
    const previous = this._stableDipPoints;
    const names = ["Shoulder", "Elbow", "Wrist"];
    if (!previous.leftShoulder || !previous.rightShoulder) return points;
    const cost = (swapped) => names.reduce((sum, joint) => {
      const left = points[(swapped ? "right" : "left") + joint];
      const right = points[(swapped ? "left" : "right") + joint];
      const prevLeft = previous["left" + joint], prevRight = previous["right" + joint];
      if (!left || !right || !prevLeft || !prevRight) return sum;
      return sum + Math.hypot(left.x - prevLeft.x, left.y - prevLeft.y)
        + Math.hypot(right.x - prevRight.x, right.y - prevRight.y);
    }, 0);
    const direct = cost(false), swapped = cost(true);
    if (!(swapped + 0.12 < direct)) return points;
    const corrected = { ...points };
    for (const name of Object.keys(LM)) {
      if (!name.startsWith("left")) continue;
      const suffix = name.slice(4);
      const right = "right" + suffix;
      if (!(right in points)) continue;
      corrected[name] = points[right];
      corrected[right] = points[name];
    }
    return corrected;
  }

  // Сглаживаем дрожание, отбрасываем невозможные скачки и ненадолго сохраняем
  // последнюю кисть/сустав, когда его перекрыл брус. После 18 кадров точка исчезает:
  // система не продолжает считать по давно потерянной позе.
  _stabilizeDipPoints(points) {
    const next = {};
    const previous = this._stableDipPoints;
    const holdLimit = 18;
    for (const name of Object.keys(LM)) {
      const current = points[name];
      const prev = previous[name];
      const visible = posePointVisible(current);
      const jumped = visible && prev && Math.hypot(current.x - prev.x, current.y - prev.y) > 0.18;
      if (visible && !jumped) {
        const alpha = 0.45;
        next[name] = prev ? {
          x: prev.x + alpha * (current.x - prev.x),
          y: prev.y + alpha * (current.y - prev.y),
          confidence: current.confidence,
          world: smoothWorld(prev.world, current.world, alpha),
        } : current;
        this._dipPointAge[name] = 0;
      } else if (prev && (this._dipPointAge[name] || 0) < holdLimit) {
        this._dipPointAge[name] = (this._dipPointAge[name] || 0) + 1;
        next[name] = { ...prev, confidence: Math.max(this.minConfidence || POSE_MIN_CONFIDENCE, prev.confidence * 0.98), held: true };
      } else {
        this._dipPointAge[name] = holdLimit;
      }
    }
    this._stableDipPoints = next;
    return next;
  }

  _sampleBrightness(video, now) {
    if (now - this._brightnessAt < 500) return this._brightness;
    this._brightnessAt = now;
    try {
      if (!this._lightCanvas) {
        this._lightCanvas = document.createElement("canvas");
        this._lightCanvas.width = 24;
        this._lightCanvas.height = 16;
        this._lightCtx = this._lightCanvas.getContext("2d", { willReadFrequently: true });
      }
      this._lightCtx.drawImage(video, 0, 0, 24, 16);
      const data = this._lightCtx.getImageData(0, 0, 24, 16).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 4) total += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      this._brightness = total / (data.length / 4);
    } catch {}
    return this._brightness;
  }

  // --- Запись ролика: кадр камеры + скелет + счётчик (для шеринга) ---
  _pickMime() {
    // Все браузеры на iPhone работают через WebKit: отдаём им MP4/H.264,
    // который открывается в Photos и стандартном плеере без конвертации.
    const apple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent || "");
    const mp4 = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4"];
    const webm = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const list = apple ? [...mp4, ...webm] : [...webm, ...mp4];
    return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
  }
  async toggleRecording() {
    if (this._recording) {
      this._recording = false;
      await new Promise((res) => { this._recorder.onstop = res; this._recorder.stop(); });
      const blob = new Blob(this._recChunks, { type: this._recorder.mimeType || "video/webm" });
      await shareVideo(blob);
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
    this._recorder.start(1000);
    this._recording = true;
    return true;
  }
  _drawRecordFrame(size) {
    const g = this._recCtx;
    g.save();
    // Фронталку показываем зеркально (как в селфи) — и в записи так же; заднюю не зеркалим.
    if (this.isMirrored()) { g.translate(size.width, 0); g.scale(-1, 1); }
    g.drawImage(this._video, 0, 0, size.width, size.height);
    g.drawImage(this._canvas, 0, 0, size.width, size.height);
    g.restore();
    const ctx = this.recordingContext || {};
    const goal = ctx.goals && ctx.goals[this.active];
    const result = this.snapshot.results[this.active];
    const current = (goal && goal.start || 0) + (result ? result.repCount : 0);
    const target = goal && goal.target != null ? goal.target : null;
    const margin = Math.round(size.width * 0.065);
    const sans = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif';
    const fitText = (text, maxWidth, startSize, weight = 700) => {
      let fontSize = startSize;
      do { g.font = `${weight} ${fontSize}px ${sans}`; fontSize -= 2; } while (fontSize > 18 && g.measureText(text).width > maxWidth);
      return g.font;
    };

    const topShade = g.createLinearGradient(0, 0, 0, size.height * .2);
    topShade.addColorStop(0, "rgba(0,0,0,.68)"); topShade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = topShade; g.fillRect(0, 0, size.width, size.height * .22);
    const bottomShade = g.createLinearGradient(0, size.height * .58, 0, size.height);
    bottomShade.addColorStop(0, "rgba(0,0,0,0)"); bottomShade.addColorStop(.38, "rgba(0,0,0,.58)"); bottomShade.addColorStop(1, "rgba(0,0,0,.94)");
    g.fillStyle = bottomShade; g.fillRect(0, size.height * .56, size.width, size.height * .44);

    g.textAlign = "left"; g.textBaseline = "alphabetic";
    const brandSize = Math.round(size.width * .042);
    g.font = `900 ${brandSize}px ${sans}`; g.fillStyle = "#fff"; g.fillText("REP", margin, margin * 1.2);
    const repWidth = g.measureText("REP").width; g.fillStyle = "#c8ff21"; g.fillText("ACT", margin + repWidth, margin * 1.2);
    if (ctx.title) {
      const title = String(ctx.title);
      fitText(title, size.width - margin * 2, Math.round(size.width * .038), 650);
      g.fillStyle = "rgba(255,255,255,.78)"; g.fillText(title, margin, margin * 2.15);
    }

    const exercise = this.exercises[this.active];
    const exerciseName = typeof Exercise !== "undefined" ? Exercise.displayName(exercise) : exercise;
    const combo = this.exercises.length > 1 ? `  ·  ${this.active + 1}/${this.exercises.length}` : "";
    const baseY = size.height - Math.round(size.width * .25);
    g.font = `750 ${Math.round(size.width * .035)}px ${sans}`;
    g.fillStyle = "rgba(255,255,255,.72)";
    g.fillText(String(exerciseName).toUpperCase() + combo, margin, baseY - Math.round(size.width * .29));

    const countSize = Math.round(size.width * .17);
    g.font = `900 ${countSize}px ${sans}`; g.fillStyle = "#fff";
    g.fillText(String(current), margin, baseY - Math.round(size.width * .10));
    const currentWidth = g.measureText(String(current)).width;
    if (target != null) {
      g.font = `750 ${Math.round(size.width * .075)}px ${sans}`;
      g.fillStyle = "rgba(255,255,255,.56)";
      g.fillText(`/ ${target}`, margin + currentWidth + Math.round(size.width * .025), baseY - Math.round(size.width * .10));
      const barY = baseY - Math.round(size.width * .045), barW = size.width - margin * 2, barH = Math.max(6, Math.round(size.width * .012));
      g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(margin, barY, barW, barH);
      g.fillStyle = current >= target ? "#45d483" : "#c8ff21"; g.fillRect(margin, barY, barW * Math.max(0, Math.min(1, target ? current / target : 0)), barH);
    }

    const metaY = size.height - margin * .8;
    g.font = `650 ${Math.round(size.width * .031)}px ${sans}`;
    g.fillStyle = "rgba(255,255,255,.72)";
    if (ctx.day && ctx.duration) g.fillText(t("Day %lld of %lld", ctx.day, ctx.duration), margin, metaY);
    if (target != null) {
      const left = Math.max(0, target - current);
      const status = left ? t("%lld left", left) : t("Goal reached!");
      g.textAlign = "right"; g.fillStyle = left ? "#fff" : "#45d483"; g.fillText(status, size.width - margin, metaY);
    }
    g.textAlign = "left";
  }

  isRecording() { return !!this._recording; }

  // Пересоздать landmarker после серии сбоев detectForVideo (контекст-лосс).
  async _recoverLandmarker() {
    this._recovering = true;
    try {
      landmarkerPromise = null; // сбросить общий кэш → создать свежий инстанс
      const lm = await getLandmarker();
      if (this._running) { this._landmarker = lm; this._detectFails = 0; }
    } catch {} finally { this._recovering = false; }
  }

  videoTrack() { return this._stream ? this._stream.getVideoTracks()[0] : null; }

  // Переключить поток на текущие facing/zoom: сначала гасим старый трек
  // (iOS не держит две активные камеры), потом берём новый.
  async _reopenStream() {
    if (!this._running || !this._video) return false;
    if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
    this._stream = null;
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ video: this._videoConstraints(), audio: false });
    } catch { return false; }
    if (!this._running) { this._stream.getTracks().forEach((t) => t.stop()); this._stream = null; return false; }
    this._video.srcObject = this._stream;
    await this._video.play().catch(() => {});
    return true;
  }

  // Фронт ↔ задняя. При провале — откат на прежнюю. Возвращает актуальный facing.
  async flipCamera() {
    const pf = this.facing, pz = this.zoom;
    this.facing = this.facing === "user" ? "environment" : "user";
    if (this.facing === "user") this.zoom = 1; // 0.5× только на задней
    if (await this._reopenStream()) return this.facing;
    this.facing = pf; this.zoom = pz;
    await this._reopenStream();
    return this.facing;
  }

  // 1× ↔ 0.5× (только на задней). При провале — откат. Возвращает актуальный zoom.
  async setZoom(zoom) {
    if (this.facing !== "environment") return this.zoom;
    const pz = this.zoom;
    this.zoom = zoom === 0.5 ? 0.5 : 1;
    if (this.zoom === pz) return this.zoom;
    if (await this._reopenStream()) return this.zoom;
    this.zoom = pz;
    await this._reopenStream();
    return this.zoom;
  }

  // Перезапуск камеры после возврата из фона (iOS «замораживает» трек в фоне).
  async restartCamera() {
    if (!this._running || !this._video) return false;
    let fresh;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({ video: this._videoConstraints(), audio: false });
    } catch { return false; }
    if (!this._running) { fresh.getTracks().forEach((t) => t.stop()); return false; }
    const old = this._stream;
    this._stream = fresh;
    if (old) old.getTracks().forEach((t) => t.stop());
    this._video.srcObject = fresh;
    await this._video.play().catch(() => {});
    return true;
  }

  stop() {
    this._startGeneration = (this._startGeneration || 0) + 1;
    if (this._cancelStart) this._cancelStart();
    this._running = false;
    if (this._recording && this._recorder) { try { this._recorder.stop(); } catch {} this._recording = false; }
    if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
  }
}

function mid(a, b) {
  if (!a || !b) return { x: 0, y: 0, confidence: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, confidence: Math.min(a.confidence, b.confidence) };
}

function headMid(points) {
  if (posePointVisible(points.leftEar) && posePointVisible(points.rightEar)) {
    return mid(points.leftEar, points.rightEar);
  }
  return posePointVisible(points.nose) ? { ...points.nose } : { x: 0, y: 0, confidence: 0 };
}

function smoothWorld(previous, current, alpha) {
  if (!current) return previous || null;
  if (!previous) return current;
  return {
    x: previous.x + alpha * (current.x - previous.x),
    y: previous.y + alpha * (current.y - previous.y),
    z: previous.z + alpha * (current.z - previous.z),
  };
}

async function shareVideo(blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], "repact." + ext, { type: blob.type });
  if (window.RepactNativeMedia && typeof window.RepactNativeMedia.saveVideo === "function") {
    await window.RepactNativeMedia.saveVideo(file);
    return;
  }
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    // Отмена (свайп вниз) — не повод скачивать: download-фолбэк открывал в PWA
    // превью Safari, после которого iOS оставлял камеру замороженной.
    try { await navigator.share({ files: [file], title: "Repact" }); } catch {}
    return;
  }
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = "repact." + ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.PoseSession = PoseSession;
window.RepCounter = RepCounter;
window.poseIsCoherent = poseIsCoherent;
window.poseQualityIssue = poseQualityIssue;
