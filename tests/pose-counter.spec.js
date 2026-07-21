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
    return {
      sparse: window.poseIsCoherent(sparseLegs),
      full: window.poseIsCoherent(fullBody),
      outsideFrame: window.poseIsCoherent({ ...fullBody, leftShoulder: p(-.2, .24), rightShoulder: p(1.2, .24) }),
    };
  });
  expect(result).toEqual({ sparse: false, full: true, outsideFrame: false });
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

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Exit without saving", exact: true }).click();
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
