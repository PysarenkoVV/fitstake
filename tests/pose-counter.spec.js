import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
  });
  await page.goto("/");
});

test("pull-ups count after a stable hang, pull, and full return", async ({ page }) => {
  const count = await page.evaluate(() => {
    const point = (x, y) => ({ x, y, confidence: 1 });
    const pose = (contracted) => ({
      leftShoulder: point(.40, contracted ? .40 : .50), rightShoulder: point(.60, contracted ? .40 : .50),
      leftElbow: point(.40, contracted ? .30 : .35), rightElbow: point(.60, contracted ? .30 : .35),
      leftWrist: point(contracted ? .50 : .40, contracted ? .30 : .20), rightWrist: point(contracted ? .50 : .60, contracted ? .30 : .20),
    });
    const counter = new window.RepCounter("pullups");
    let now = 0;
    const feed = (points, frames) => { for (let i = 0; i < frames; i++) counter.process(points, { width: 1000, height: 1000 }, true, now += 50); };
    feed(pose(false), 4); feed(pose(true), 4); feed(pose(false), 4);
    return counter.count;
  });
  expect(count).toBe(1);
});

test("dips require full extension and ignore angle jitter without vertical travel", async ({ page }) => {
  const result = await page.evaluate(() => {
    const point = (x, y) => ({ x, y, confidence: 1 });
    const pose = (kind, moveBody = true) => {
      const top = kind === "top", partial = kind === "partial";
      const shoulderY = moveBody ? (top || partial ? .30 : .40) : .30;
      const elbowY = top ? .40 : .50;
      const wristY = top ? .50 : (partial ? .577 : .50);
      const wristOffset = top ? 0 : (partial ? .064 : .10);
      return {
        leftShoulder: point(.40, shoulderY), rightShoulder: point(.60, shoulderY),
        leftElbow: point(.40, elbowY), rightElbow: point(.60, elbowY),
        leftWrist: point(.40 + wristOffset, wristY), rightWrist: point(.60 - wristOffset, wristY),
      };
    };
    const counter = new window.RepCounter("dips");
    let now = 0;
    const feed = (points, frames) => { for (let i = 0; i < frames; i++) counter.process(points, { width: 1000, height: 1000 }, true, now += 50); };
    feed(pose("top"), 4); feed(pose("bottom"), 4); feed(pose("partial"), 6);
    const beforeExtension = counter.count;
    feed(pose("top"), 4);
    const afterExtension = counter.count;

    for (let cycle = 0; cycle < 4; cycle++) {
      feed(pose("bottom", false), 4);
      feed(pose("top", false), 4);
    }
    return { beforeExtension, afterExtension, afterJitter: counter.count };
  });
  expect(result).toEqual({ beforeExtension: 0, afterExtension: 1, afterJitter: 1 });
});

test("dips keep counting through a brief hidden wrist but do not count a head nod", async ({ page }) => {
  const result = await page.evaluate(() => {
    const point = (x, y, confidence = 1) => ({ x, y, confidence });
    const pose = (down, hideRightWrist = false, nodOnly = false) => {
      const travel = down && !nodOnly ? .10 : 0;
      const shoulderY = .30 + travel;
      const elbowY = down ? .50 : .40;
      const wristY = .50;
      return {
        nose: point(.50, .16 + (down ? .10 : 0)),
        leftEar: point(.47, .17 + (down ? .10 : 0)),
        rightEar: point(.53, .17 + (down ? .10 : 0)),
        leftShoulder: point(.40, shoulderY), rightShoulder: point(.60, shoulderY),
        leftElbow: point(.40, elbowY), rightElbow: point(.60, elbowY),
        leftWrist: point(down ? .50 : .40, wristY),
        rightWrist: point(down ? .50 : .60, wristY, hideRightWrist ? .1 : 1),
        leftHip: point(.44, .55 + travel), rightHip: point(.56, .55 + travel),
      };
    };
    const run = (nodOnly) => {
      const counter = new window.RepCounter("dips");
      let now = 0;
      const feed = (points, frames) => {
        for (let i = 0; i < frames; i++) counter.process(points, { width: 1000, height: 1000 }, true, now += 50);
      };
      feed(pose(false), 4);
      feed(pose(true, true, nodOnly), 5);
      feed(pose(false), 5);
      return counter.count;
    };
    return { hiddenWrist: run(false), headOnly: run(true) };
  });
  expect(result).toEqual({ hiddenWrist: 1, headOnly: 0 });
});

test("dips guide maps both movement phases from zero to the checkpoint", async ({ page }) => {
  const result = await page.evaluate(() => {
    const counter = new window.RepCounter("dips");
    const progress = (angle, phase) => {
      const span = counter.upThreshold - counter.downThreshold;
      return phase === "up"
        ? (angle - counter.downThreshold) / span
        : (counter.upThreshold - angle) / span;
    };
    return {
      downStart: progress(counter.upThreshold, "down"),
      downReached: progress(counter.downThreshold, "down"),
      upStart: progress(counter.downThreshold, "up"),
      upReached: progress(counter.upThreshold, "up"),
    };
  });
  expect(result).toEqual({ downStart: 0, downReached: 1, upStart: 0, upReached: 1 });
});

test("camera rejects sparse landmarks before drawing or counting a pose", async ({ page }) => {
  const result = await page.evaluate(() => {
    const p = (x, y, confidence = 1) => ({ x, y, confidence });
    const sparseLegs = {
      leftHip: p(.46, .58), rightHip: p(.54, .58),
      leftKnee: p(.45, .72), rightKnee: p(.55, .72),
      leftAnkle: p(.44, .90), rightAnkle: p(.56, .90),
    };
    const fullBody = {
      leftShoulder: p(.42, .24), rightShoulder: p(.58, .24),
      leftElbow: p(.36, .40), rightElbow: p(.64, .40),
      leftWrist: p(.34, .56), rightWrist: p(.66, .56),
      leftHip: p(.45, .52), rightHip: p(.55, .52),
      leftKnee: p(.44, .70), rightKnee: p(.56, .70),
      leftAnkle: p(.43, .90), rightAnkle: p(.57, .90),
    };
    const floorPushup = {
      leftShoulder: p(.30, .55), rightShoulder: p(.48, .57),
      leftElbow: p(.22, .66), rightElbow: p(.58, .68),
      leftWrist: p(.14, .78), rightWrist: p(.68, .80),
    };
    return {
      sparse: window.poseIsCoherent(sparseLegs),
      full: window.poseIsCoherent(fullBody),
      outsideFrame: window.poseIsCoherent({ ...fullBody, leftShoulder: p(-.2, .24), rightShoulder: p(1.2, .24) }),
      floorPushup: window.poseIsCoherent(floorPushup, "pushups"),
      floorSquat: window.poseIsCoherent(floorPushup, "squats"),
    };
  });
  expect(result).toEqual({ sparse: false, full: true, outsideFrame: false, floorPushup: true, floorSquat: false });
});

test("camera quality hints explain only missing or unusable poses", async ({ page }) => {
  const result = await page.evaluate(() => {
    const p = (x, y, confidence = 1) => ({ x, y, confidence });
    const arms = {
      leftShoulder: p(.30, .40), rightShoulder: p(.55, .42),
      leftElbow: p(.24, .56), rightElbow: p(.62, .58),
      leftWrist: p(.16, .72), rightWrist: p(.70, .74),
    };
    return {
      dark: window.poseQualityIssue({}, "pushups", 20, false),
      absent: window.poseQualityIssue({}, "pushups", 100, false),
      armsMissing: window.poseQualityIssue({ leftShoulder: p(.4, .4) }, "pushups", 100, true),
      tooClose: window.poseQualityIssue({ ...arms, leftWrist: p(-.1, .72), rightWrist: p(1.1, .74) }, "pushups", 100, true),
      ready: window.poseQualityIssue(arms, "pushups", 100, true),
    };
  });
  expect(result).toEqual({ dark: "tooDark", absent: "noBody", armsMissing: "showArms", tooClose: "stepBack", ready: null });
});

test("push-ups and dips hide unstable legs but keep hips in the skeleton", async ({ page }) => {
  const result = await page.evaluate(() => {
    const point = (x, y) => ({ x, y, confidence: 1 });
    const points = {
      leftShoulder: point(.42, .24), rightShoulder: point(.58, .24),
      leftElbow: point(.36, .40), rightElbow: point(.64, .40),
      leftWrist: point(.34, .56), rightWrist: point(.66, .56),
      leftHip: point(.45, .52), rightHip: point(.55, .52),
      leftKnee: point(.44, .70), rightKnee: point(.56, .70),
      leftAnkle: point(.43, .90), rightAnkle: point(.57, .90),
      neck: point(.50, .24), root: point(.50, .52),
    };
    const drawnY = (exercise) => {
      const ys = [];
      const session = new window.PoseSession([exercise]);
      session._ctx = {
        clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
        arc(x, y) { ys.push(Math.round(y)); },
      };
      session._drawSkeleton(points, { width: 100, height: 100 }, true);
      return ys.sort((a, b) => a - b);
    };
    return { pushups: drawnY("pushups"), dips: drawnY("dips"), squats: drawnY("squats") };
  });
  expect(result.pushups).toEqual([24, 24, 40, 40, 52, 52, 56, 56]);
  expect(result.dips).toEqual(result.pushups);
  expect(result.squats).toContain(70);
  expect(result.squats).toContain(90);
});

test("dips draw a head connected to the shoulder line", async ({ page }) => {
  const result = await page.evaluate(() => {
    const point = (x, y) => ({ x, y, confidence: 1 });
    const session = new window.PoseSession(["dips"]);
    const lines = [];
    const arcs = [];
    let from = null;
    session._ctx = {
      clearRect() {}, beginPath() { from = null; },
      moveTo(x, y) { from = [Math.round(x), Math.round(y)]; },
      lineTo(x, y) { lines.push([from, [Math.round(x), Math.round(y)]]); },
      stroke() {}, fill() {},
      arc(x, y, r) { arcs.push([Math.round(x), Math.round(y), Math.round(r)]); },
    };
    session._drawSkeleton({
      head: point(.50, .12), neck: point(.50, .24),
      leftShoulder: point(.42, .24), rightShoulder: point(.58, .24),
      leftElbow: point(.36, .40), rightElbow: point(.64, .40),
      leftWrist: point(.34, .56), rightWrist: point(.66, .56),
      leftHip: point(.45, .52), rightHip: point(.55, .52),
      root: point(.50, .52),
    }, { width: 100, height: 100 }, true);
    return { lines, arcs };
  });
  expect(result.lines).toContainEqual([[50, 12], [50, 24]]);
  expect(result.arcs.some(([x, y, r]) => x === 50 && y === 12 && r > 4)).toBe(true);
});

test("push-ups at an angle to the camera count via the 3D elbow angle", async ({ page }) => {
  const result = await page.evaluate(() => {
    // Локти направлены к камере: в 2D плечо-локоть-кисть почти коллинеарны (~180°)
    // и вниз, и вверх — повтор виден только по world-координатам (3D-сгиб ~56°).
    const mk = (withWorld) => {
      const W = (x, y, z) => (withWorld ? { x, y, z } : null);
      const up = {
        leftShoulder: { x: .40, y: .40, confidence: 1, world: W(-0.2, -0.30, 0) },
        rightShoulder: { x: .60, y: .40, confidence: 1, world: W(0.2, -0.30, 0) },
        leftElbow: { x: .40, y: .55, confidence: 1, world: W(-0.2, 0, 0) },
        rightElbow: { x: .60, y: .55, confidence: 1, world: W(0.2, 0, 0) },
        leftWrist: { x: .40, y: .70, confidence: 1, world: W(-0.2, 0.25, 0) },
        rightWrist: { x: .60, y: .70, confidence: 1, world: W(0.2, 0.25, 0) },
      };
      const down = {
        leftShoulder: { x: .40, y: .60, confidence: 1, world: W(-0.2, -0.05, 0) },
        rightShoulder: { x: .60, y: .60, confidence: 1, world: W(0.2, -0.05, 0) },
        leftElbow: { x: .40, y: .65, confidence: 1, world: W(-0.2, 0, 0.25) },
        rightElbow: { x: .60, y: .65, confidence: 1, world: W(0.2, 0, 0.25) },
        leftWrist: { x: .40, y: .70, confidence: 1, world: W(-0.2, 0.25, 0) },
        rightWrist: { x: .60, y: .70, confidence: 1, world: W(0.2, 0.25, 0) },
      };
      return { up, down };
    };
    const run = (withWorld) => {
      const { up, down } = mk(withWorld);
      const counter = new window.RepCounter("pushups");
      let now = 0;
      const feed = (points, frames) => { for (let i = 0; i < frames; i++) counter.process(points, { width: 1000, height: 1000 }, true, now += 50); };
      feed(up, 4); feed(down, 6); feed(up, 6);
      return counter.count;
    };
    return { with3d: run(true), flat2d: run(false) };
  });
  expect(result).toEqual({ with3d: 1, flat2d: 0 });
});

test("angled push-ups count when the far elbow angle is distorted", async ({ page }) => {
  const count = await page.evaluate(() => {
    const point = (x, y, anglePose) => ({
      x, y, confidence: 1,
      world: anglePose,
    });
    const arm = (side, bent, distorted) => {
      const x = side === "left" ? .40 : .60;
      const shoulder = { x: side === "left" ? -.2 : .2, y: bent ? -.05 : -.30, z: 0 };
      const elbow = distorted
        ? { x: shoulder.x, y: 0, z: 0 }
        : { x: shoulder.x, y: bent ? 0 : 0, z: bent ? .25 : 0 };
      const wrist = { x: shoulder.x, y: .25, z: 0 };
      return {
        [side + "Shoulder"]: point(x, bent ? .60 : .40, shoulder),
        [side + "Elbow"]: point(x, bent ? .65 : .55, elbow),
        [side + "Wrist"]: point(x, .70, wrist),
      };
    };
    const pose = (bent) => ({
      ...arm("left", bent, false),
      ...arm("right", bent, bent),
    });
    const counter = new window.RepCounter("pushups");
    let now = 0;
    const feed = (points, frames) => {
      for (let i = 0; i < frames; i++) counter.process(points, { width: 1000, height: 1000 }, true, now += 50);
    };
    feed(pose(false), 5);
    feed(pose(true), 6);
    feed(pose(false), 6);
    return counter.count;
  });
  expect(count).toBe(1);
});

test("push-ups do not draw the head tracker", async ({ page }) => {
  const result = await page.evaluate(() => {
    const point = (x, y) => ({ x, y, confidence: 1 });
    const session = new window.PoseSession(["pushups"]);
    const lines = [];
    const arcs = [];
    let from = null;
    session._ctx = {
      clearRect() {}, beginPath() { from = null; },
      moveTo(x, y) { from = [Math.round(x), Math.round(y)]; },
      lineTo(x, y) { lines.push([from, [Math.round(x), Math.round(y)]]); },
      stroke() {}, fill() {},
      arc(x, y, r) { arcs.push([Math.round(x), Math.round(y), Math.round(r)]); },
    };
    session._drawSkeleton({
      head: point(.50, .12), neck: point(.50, .24),
      leftShoulder: point(.42, .24), rightShoulder: point(.58, .24),
      leftElbow: point(.36, .40), rightElbow: point(.64, .40),
      leftWrist: point(.34, .56), rightWrist: point(.66, .56),
      leftHip: point(.45, .52), rightHip: point(.55, .52),
      root: point(.50, .52),
    }, { width: 100, height: 100 }, true);
    return { lines, arcs };
  });
  expect(result.lines).not.toContainEqual([[50, 12], [50, 24]]);
  expect(result.arcs.some(([x, y]) => x === 50 && y === 12)).toBe(false);
});

test("cancelling the share sheet does not fall back to a file download", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const blob = new Blob(["x"], { type: "video/mp4" });
    let clicks = 0;
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicks++; };
    try {
      // Web Share есть, но пользователь отменил (свайп вниз) → скачивать нельзя.
      navigator.canShare = () => true;
      navigator.share = () => Promise.reject(new DOMException("Abort", "AbortError"));
      await window.shareVideo(blob);
      const withShare = clicks;

      // Web Share недоступен (десктоп) → download-фолбэк остаётся живым.
      clicks = 0;
      navigator.canShare = undefined;
      await window.shareVideo(blob);
      const withoutShare = clicks;
      return { withShare, withoutShare };
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
  });
  expect(result).toEqual({ withShare: 0, withoutShare: 1 });
});

test("iOS app sends recorded video to the native Photos bridge", async ({ page }) => {
  const result = await page.evaluate(async () => {
    let savedName = null;
    let shared = false;
    window.RepactNativeMedia = {
      saveVideo: async (file) => { savedName = file.name; },
    };
    navigator.canShare = () => true;
    navigator.share = async () => { shared = true; };
    await window.shareVideo(new Blob(["video"], { type: "video/mp4" }));
    delete window.RepactNativeMedia;
    return { savedName, shared };
  });
  expect(result).toEqual({ savedName: "repact.mp4", shared: false });
});

test("recorded workout frame includes exercise, target, challenge, and progress", async ({ page }) => {
  const frame = await page.evaluate(() => {
    const size = { width: 720, height: 1280 };
    const source = document.createElement("canvas"); source.width = size.width; source.height = size.height;
    source.getContext("2d").fillStyle = "#456"; source.getContext("2d").fillRect(0, 0, size.width, size.height);
    const skeleton = document.createElement("canvas"); skeleton.width = size.width; skeleton.height = size.height;
    const output = document.createElement("canvas"); output.width = size.width; output.height = size.height;
    const session = new window.PoseSession(["dips"]);
    session._video = source; session._canvas = skeleton; session._recCanvas = output; session._recCtx = output.getContext("2d");
    session.snapshot = { imageSize: size, points: {}, results: [{ exercise: "dips", repCount: 5, status: "up", bendAngle: 170 }] };
    session.setRecordingContext({ title: "50 Dips", goals: [{ exercise: "dips", start: 0, target: 50 }], day: 3, duration: 30 });
    session._drawRecordFrame(size);
    const bottom = session._recCtx.getImageData(20, 1180, 1, 1).data;
    return { width: output.width, height: output.height, bottomAlpha: bottom[3] };
  });
  expect(frame).toEqual({ width: 720, height: 1280, bottomAlpha: 255 });
});

test("first rep starts the workout clock and finishing a set opens rest", async ({ page }) => {
  await page.evaluate(async () => {
    class FakePoseSession {
      constructor(exercises) {
        this.exercises = exercises;
        this.snapshot = { results: exercises.map((exercise) => ({ exercise, repCount: 0, status: "up", bendAngle: 170 })) };
        window.__fakePoseSession = this;
      }
      setRecordingContext() {}
      setActive(index) { this.active = index; }
      setCountingEnabled(on) { this.countingEnabled = on; }
      async start() {}
      stop() {}
      isRecording() { return false; }
      async toggleRecording() { return false; }
    }
    window.PoseSession = FakePoseSession;
    await window.openSession("demo", "pushups");
    window.__fakePoseSession.snapshot.results[0].repCount = 1;
  });

  await expect(page.locator("#sess-elapsed")).toHaveText(/00:0[0-9]/);
  await page.waitForTimeout(1100);
  await expect(page.locator("#sess-elapsed")).toHaveText(/00:0[1-9]/);
  await page.getByRole("button", { name: "Finish set", exact: true }).click();
  await expect(page.locator("#sess-rest")).toBeVisible();
  const activeTimeAtRest = await page.locator("#sess-elapsed").textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator("#sess-elapsed")).toHaveText(activeTimeAtRest);
  await expect(page.locator("#sess-rest-set")).toHaveText("Set 1 completed");
  await expect(page.locator("#sess-rest-reps")).toHaveText("1 reps");
  await expect(page.locator("#sess-rest-time")).toHaveText(/01:2[89]/);
  await expect(page.getByRole("button", { name: "Finish workout", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start next set", exact: true }).locator("svg.filled")).toBeVisible();
  const pauseButtons = await page.locator(".sess-rest-action").evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height), fontSize: getComputedStyle(button).fontSize };
  }));
  expect(pauseButtons[0].height).toBe(pauseButtons[1].height);
  expect(pauseButtons[1]).toEqual(pauseButtons[2]);
  await page.getByRole("button", { name: "+30 sec", exact: true }).click();
  await expect(page.locator("#sess-rest-time")).toHaveText(/01:5[89]/);
  await page.getByRole("button", { name: "Start next set", exact: true }).click();
  await expect(page.locator("#sess-rest")).toBeHidden();
  await page.waitForTimeout(1100);
  await expect(page.locator("#sess-elapsed")).not.toHaveText(activeTimeAtRest);

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Exit without saving", exact: true }).click();
  await expect(page.locator(".session")).toHaveCount(0);
});

test("a set ends automatically after ten seconds without another rep", async ({ page }) => {
  await page.evaluate(async () => {
    class FakePoseSession {
      constructor(exercises) {
        this.snapshot = { results: exercises.map((exercise) => ({ exercise, repCount: 0, status: "up", bendAngle: 170 })) };
        window.__fakePoseSession = this;
      }
      setRecordingContext() {}
      setActive() {}
      setCountingEnabled(on) { this.countingEnabled = on; }
      async start() {}
      stop() {}
      isRecording() { return false; }
      async toggleRecording() { return false; }
    }
    window.__REPACT_SET_IDLE_MS__ = 1000;
    window.PoseSession = FakePoseSession;
    await window.openSession("demo", "pushups");
    window.__fakePoseSession.snapshot.results[0].repCount = 1;
  });

  await expect(page.getByRole("button", { name: "Finish set", exact: true })).toBeVisible();
  await expect(page.locator("#sess-rest")).toBeVisible({ timeout: 2500 });
  await expect(page.locator("#sess-rest-set")).toHaveText("Set 1 completed");
  await expect(page.locator("#sess-rest-reps")).toHaveText("1 reps");

  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
});

test("starting a rep during rest resumes the next set without losing it", async ({ page }) => {
  await page.evaluate(async () => {
    class FakePoseSession {
      constructor(exercises) {
        this.snapshot = { results: exercises.map((exercise) => ({ exercise, repCount: 0, status: "up", bendAngle: 170 })) };
        window.__fakePoseSession = this;
      }
      setRecordingContext() {}
      setActive() {}
      setCountingEnabled(on, preserveCurrentRep = false) {
        this.countingEnabled = on;
        this.preservedCurrentRep = preserveCurrentRep;
      }
      async start() {}
      stop() {}
      isRecording() { return false; }
      async toggleRecording() { return false; }
    }
    window.PoseSession = FakePoseSession;
    await window.openSession("demo", "pushups");
    window.__fakePoseSession.snapshot.results[0].repCount = 1;
  });

  await expect(page.getByRole("button", { name: "Finish set", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish set", exact: true }).click();
  await expect(page.locator("#sess-rest")).toBeVisible();

  await page.evaluate(() => {
    window.__fakePoseSession.snapshot.results[0].status = "down";
  });
  await expect(page.locator("#sess-rest")).toBeHidden();
  expect(await page.evaluate(() => window.__fakePoseSession.preservedCurrentRep)).toBe(true);

  await page.evaluate(() => {
    window.__fakePoseSession.snapshot.results[0] = {
      ...window.__fakePoseSession.snapshot.results[0],
      status: "up",
      repCount: 2,
    };
  });
  await expect(page.locator("#sess-num")).toHaveText("2");
  await expect(page.getByRole("button", { name: "Finish set", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Exit without saving", exact: true }).click();
});

test("set energy drains between reps and refills on the next rep", async ({ page }) => {
  await page.evaluate(async () => {
    class FakePoseSession {
      constructor(exercises) {
        this.snapshot = { results: exercises.map((exercise) => ({ exercise, repCount: 0, status: "up", bendAngle: 170 })) };
        window.__fakePoseSession = this;
      }
      setRecordingContext() {}
      setActive() {}
      setCountingEnabled() {}
      async start() {}
      stop() {}
      isRecording() { return false; }
      async toggleRecording() { return false; }
    }
    window.__REPACT_SET_IDLE_MS__ = 2000;
    window.PoseSession = FakePoseSession;
    await window.openSession("demo", "pushups");
    window.__fakePoseSession.snapshot.results[0].repCount = 1;
  });

  const energy = page.locator("#sess-energy");
  await expect(energy).toBeVisible();
  const first = Number(await energy.getAttribute("aria-valuenow"));
  await page.waitForTimeout(500);
  const drained = Number(await energy.getAttribute("aria-valuenow"));
  expect(drained).toBeLessThan(first);

  await page.evaluate(() => {
    window.__fakePoseSession.snapshot.results[0].repCount = 2;
  });
  await expect.poll(async () => Number(await energy.getAttribute("aria-valuenow"))).toBeGreaterThan(drained);

  await page.getByRole("button", { name: "Finish set", exact: true }).click();
  await expect(energy).toBeHidden();
  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
});

test("range guide is available beyond dips and shows checkpoints plus movement", async ({ page }) => {
  await page.evaluate(async () => {
    class FakePoseSession {
      constructor(exercises) {
        this.snapshot = {
          results: exercises.map((exercise) => ({
            exercise,
            repCount: 0,
            status: "up",
            bendAngle: 150,
            guidePhase: "down",
            guideProgress: .4,
          })),
        };
        window.__fakePoseSession = this;
      }
      setRecordingContext() {}
      setActive() {}
      setCountingEnabled() {}
      async start() {}
      stop() {}
      isRecording() { return false; }
      async toggleRecording() { return false; }
    }
    window.PoseSession = FakePoseSession;
    await window.openSession("demo", "pushups");
  });

  const guide = page.locator("#sess-range-guide");
  await expect(guide).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#sess-range-label")).toHaveText("Lower down");
  await expect(page.locator(".sess-range-track b")).toHaveCount(2);
  await expect(page.locator("#sess-range-marker")).toHaveCSS("bottom", /.+/);

  await page.evaluate(() => {
    window.__fakePoseSession.snapshot.results[0].guidePhase = "up";
    window.__fakePoseSession.snapshot.results[0].guideProgress = .7;
  });
  await expect(page.locator("#sess-range-label")).toHaveText("Push up");
  await expect(page.locator("#sess-range-value")).toHaveText("70%");

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".session")).toHaveCount(0);
});

test("daily target completion shows finish and extra-set actions", async ({ page }) => {
  await page.evaluate(async () => {
    class FakePoseSession {
      constructor(exercises) {
        this.snapshot = { results: exercises.map((exercise) => ({ exercise, repCount: 0, status: "up", bendAngle: 170 })) };
        window.__fakePoseSession = this;
      }
      setRecordingContext() {}
      setActive() {}
      setCountingEnabled(on) { this.countingEnabled = on; }
      async start() {}
      stop() {}
      isRecording() { return false; }
      async toggleRecording() { return false; }
    }
    window.PoseSession = FakePoseSession;
    const challenge = app.challenges.find((item) => item.id === "main");
    challenge.goals = [{ exercise: "pushups", repsPerDay: 2 }];
    challenge.progression = { step: 0, period: "day" };
    challenge.myTodayReps = {};
    await window.openSession("main", "pushups");
    window.__fakePoseSession.snapshot.results[0].repCount = 2;
  });

  await expect(page.locator("#sess-rest.complete")).toBeVisible();
  await expect(page.getByText("Day complete", { exact: true })).toBeVisible();
  await expect(page.locator("#sess-complete-total")).toHaveText("2 / 2");
  await expect(page.getByRole("button", { name: "Finish workout", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Extra set", exact: true })).toBeVisible();

  const completedButtons = await page.locator(".sess-rest-action").evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height), fontSize: getComputedStyle(button).fontSize };
  }));
  expect(completedButtons[0]).toEqual(completedButtons[1]);

  await page.getByRole("button", { name: "Extra set", exact: true }).click();
  await expect(page.locator("#sess-rest")).toBeHidden();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Exit without saving", exact: true }).click();
  await expect(page.locator(".session")).toHaveCount(0);
});

test("saving a partial workout opens a useful result screen", async ({ page }) => {
  await page.evaluate(async () => {
    class FakePoseSession {
      constructor(exercises) {
        this.snapshot = { results: exercises.map((exercise) => ({ exercise, repCount: 0, status: "up", bendAngle: 170 })) };
        window.__fakePoseSession = this;
      }
      setRecordingContext() {}
      setActive() {}
      setCountingEnabled() {}
      async start() {}
      stop() {}
      isRecording() { return false; }
      async toggleRecording() { return false; }
    }
    window.PoseSession = FakePoseSession;
    const challenge = app.challenges.find((item) => item.id === "main");
    challenge.goals = [{ exercise: "pushups", repsPerDay: 5000 }];
    challenge.myTodayReps = {};
    await window.openSession("main", "pushups");
    window.__fakePoseSession.snapshot.results[0].repCount = 12;
  });
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByText("Workout saved", { exact: true })).toBeVisible();
  await expect(page.locator(".workout-result-hero strong")).toHaveText("12");
  await expect(page.getByText("Best set", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
});
