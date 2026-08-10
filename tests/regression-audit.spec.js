import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("uk-UA is selected automatically on a clean first launch", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "language", { configurable: true, value: "uk-UA" });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(page.getByRole("button", { name: "Почати", exact: true })).toBeVisible();
});

test("cancelling camera startup stops a stream that resolves late", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    let resolveStream;
    let stopped = false;
    const streamPromise = new Promise((resolve) => { resolveStream = resolve; });
    const original = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = () => streamPromise;
    const session = new window.PoseSession(["pushups"]);
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const started = session.start(video, canvas).then(() => "started", (error) => error.name);
    session.stop();
    resolveStream({ getTracks: () => [{ stop: () => { stopped = true; } }] });
    const outcome = await started;
    navigator.mediaDevices.getUserMedia = original;
    return { outcome, stopped, running: session._running };
  });
  expect(result).toEqual({ outcome: "AbortError", stopped: true, running: false });
});

test("canvas dimensions follow both dimensions of the camera stream", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
  });
  await page.goto("/");
  const dimensions = await page.evaluate(() => {
    const session = new window.PoseSession(["pushups"]);
    session._running = true;
    session._video = { readyState: 2, videoWidth: 1280, videoHeight: 960 };
    session._canvas = document.createElement("canvas");
    session._canvas.width = 1280;
    session._canvas.height = 720;
    session._ctx = session._canvas.getContext("2d");
    session._landmarker = { detectForVideo: () => ({ landmarks: [] }) };
    session._loop();
    session.stop();
    return { width: session._canvas.width, height: session._canvas.height };
  });
  expect(dimensions).toEqual({ width: 1280, height: 960 });
});

test("iOS-friendly camera settings cap pose input at the proven Telegram resolution", async ({ page }) => {
  await page.goto("/");
  const constraints = await page.evaluate(() => {
    const session = new window.PoseSession(["pushups"]);
    return session._videoConstraints();
  });
  expect(constraints).toEqual({
    facingMode: "user",
    width: { ideal: 960, max: 960 },
    height: { ideal: 540, max: 540 },
  });
});

test("pose detection runs once per camera frame instead of once per animation frame", async ({ page }) => {
  await page.goto("/");
  const calls = await page.evaluate(() => {
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;
    const session = new window.PoseSession(["pushups"]);
    let detections = 0;
    session._running = true;
    session._video = { readyState: 2, videoWidth: 960, videoHeight: 540, currentTime: 1 };
    session._canvas = document.createElement("canvas");
    session._ctx = session._canvas.getContext("2d");
    session._landmarker = { detectForVideo: () => { detections++; return { landmarks: [] }; } };
    session._sampleBrightness = () => 100;
    session._drawSkeleton = () => {};
    session._loop();
    session._loop();
    session._video.currentTime = 2;
    session._loop();
    session.stop();
    window.requestAnimationFrame = originalRAF;
    return detections;
  });
  expect(calls).toBe(2);
});

test("service worker never stores failed responses", () => {
  const source = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  expect(source).toContain("if (res.ok)");
  expect(source.indexOf("if (res.ok)")).toBeLessThan(source.indexOf("c.put(request, copy)"));
});

test("Google auth signs into an existing account after anonymous-link collisions", () => {
  const source = fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8");
  expect(source).toContain('code === "auth/email-already-in-use"');
  expect(source).toContain('code === "auth/account-exists-with-different-credential"');
  expect(source).toContain("pendingCredential || A.GoogleAuthProvider.credentialFromError(e)");
  expect(source).toContain("await A.signInWithCredential(authInstance, cred)");
});

test("Apple auth and in-app account deletion are wired through Firebase", () => {
  const syncSource = fs.readFileSync(new URL("../sync.js", import.meta.url), "utf8");
  const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  expect(syncSource).toContain('new A.OAuthProvider("apple.com")');
  expect(syncSource).toContain("await A.deleteUser(user)");
  expect(syncSource).toContain("deletionRequests");
  expect(appSource).toContain('data-act="appleAuth"');
  expect(appSource).toContain("confirmDeleteAccount");
});

test("standalone layout uses the full viewport after iOS camera sessions", () => {
  const source = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  expect(source).toContain("@media (display-mode: standalone)");
  expect(source).toMatch(/\.session, \.fullscreen, \.story-camera\s*{[^}]*height:\s*100lvh/s);
  expect(source).toContain(".tabbar { bottom: calc(100dvh - 100lvh); }");
});

test("a workout started after the daily goal stays in extra-reps mode", () => {
  const source = fs.readFileSync(new URL("../workout-session.js", import.meta.url), "utf8");
  expect(source).toContain("completionDismissed = goals.every((goal) => goal.target != null && goal.start >= goal.target)");
  expect(source).toContain("if (allReached && !completionDismissed && workoutStartedAt && !workoutStoppedAt)");
});

test("failed remote join does not charge or add a local participant", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const challenge = newChallenge({
      id: "join_failure", title: "Join failure", isPublic: true, access: "public", buyIn: 100,
      goals: [{ exercise: "pushups", reps: 10 }], participants: [],
    });
    const balance = app.balance;
    const original = Sync.joinChallenge;
    Sync.joinChallenge = async () => false;
    const joined = await joinChallenge(challenge, 75, 20, null);
    Sync.joinChallenge = original;
    return { joined, balanceBefore: balance, balanceAfter: app.balance, participants: challenge.participants.length };
  });
  expect(result).toEqual({ joined: null, balanceBefore: result.balanceBefore, balanceAfter: result.balanceBefore, participants: 0 });
});

test("cancelling native invite share does not copy the link", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
  });
  await page.goto("/");
  const copied = await page.evaluate(async () => {
    let writes = 0;
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("cancel", "AbortError"); } });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { writes++; } } });
    await shareInvite("main");
    return writes;
  });
  expect(copied).toBe(0);
});

test("invite share includes the Repact slogan", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
  });
  await page.goto("/");
  const shared = await page.evaluate(async () => {
    let payload;
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data) => { payload = data; } });
    await shareInvite("main");
    return payload;
  });
  expect(shared.text).toContain("DON’T JUST SAY IT. PROVE IT.");
  expect(shared.url).toContain("?join=main");
});

test("fullscreen traps focus and browser Back closes it first", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  const full = page.locator(".fullscreen");
  await expect(full).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement.closest(".fullscreen"))).toBe(true);
  await page.goBack();
  await expect(full).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Challenges", exact: true })).toBeVisible();
});

test("remote challenge ids cannot inject markup into Browse", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    window.__challengeXss = false;
  });
  await page.goto("/");
  const result = await page.evaluate(() => {
    const maliciousId = `x"><img src=x onerror="window.__challengeXss=true">`;
    Sync.state.challenges = {
      [maliciousId]: {
        meta: {
          title: "Injected", goals: [{ exercise: "pushups", repsPerDay: 10 }],
          durationDays: 7, buyIn: 0, type: "streak", access: "public",
          missPolicy: "never", createdAt: Date.now(),
        },
        participants: {},
      },
    };
    applyPublicChallenges(dateKey());
    render();
    return {
      executed: window.__challengeXss,
      imageCount: document.querySelectorAll('img[src="x"]').length,
      challengePresent: app.challenges.some((challenge) => challenge.id === maliciousId),
    };
  });
  expect(result).toEqual({ executed: false, imageCount: 0, challengePresent: false });
});

test("calendar days remain unique across the autumn DST transition", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "Europe/Berlin" });
  const page = await context.newPage();
  await page.goto("/");
  const keys = await page.evaluate(() => [1, 2, 3].map((day) => dateKey(dayEpoch("2025-10-25", day))));
  expect(keys).toEqual(["2025-10-25", "2025-10-26", "2025-10-27"]);
  await context.close();
});

test("history keeps challenges with the same title separate", async ({ page }) => {
  await page.goto("/");
  const entries = await page.evaluate(() => {
    app.history = [];
    logEntry("challenge-a", "Daily", 10, 10, { pushups: 10 });
    logEntry("challenge-b", "Daily", 20, 20, { squats: 20 });
    return app.history[0].entries.map(({ challengeId, reps }) => ({ challengeId, reps }));
  });
  expect(entries).toEqual([
    { challengeId: "challenge-a", reps: 10 },
    { challengeId: "challenge-b", reps: 20 },
  ]);
});

test("Firebase rules separate public discovery from private invite records", () => {
  const rules = JSON.parse(fs.readFileSync(new URL("../database.rules.json", import.meta.url), "utf8")).rules.fitstake;
  expect(rules.publicChallenges[".read"]).toBe(true);
  expect(rules.privateChallenges[".read"]).toBeUndefined();
  expect(rules.privateChallenges.$challengeId[".read"]).toContain("meta/ownerId");
  expect(rules.privateChallenges.$challengeId[".read"]).toContain("participants");
  expect(rules.privateChallenges.$challengeId.meta[".read"]).toBe("auth != null");
  expect(rules.publicChallenges.$challengeId[".validate"]).not.toContain("numChildren()");
  expect(rules.publicChallenges.$challengeId[".validate"]).toContain("matches(/^[A-Za-z0-9_-]");
});
