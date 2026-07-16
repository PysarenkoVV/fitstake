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
