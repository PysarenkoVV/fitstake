import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
});

test("tester guide preserves its step and routes the selected path", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => startTesterGuide(false));
  await expect(page.getByRole("heading", { name: "Workouts you have to prove" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose how to start" })).toBeVisible();
  await page.getByRole("button", { name: /Create your own/ }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fs.testerGuide")).startIntent)).toBe("create");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Choose how to start" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Go to the app", exact: true }).click();
  await expect(page.getByText("What are you proving?", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.testerGuide")).status)).toBe("completed");
});

test("invite survives the guide and remains the destination", async ({ page }) => {
  await page.goto("/?join=main");
  await page.evaluate(() => startTesterGuide(false));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: /Accept a friend's invite/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "View invitation", exact: true }).click();
  await expect(page).not.toHaveURL(/\?join=/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.pendingInvite")).challengeId)).toBe("main");
  await expect(page.getByText("150 Push-ups + 50 Squats", { exact: true })).toBeVisible();
  await expect(page.getByText("Account required", { exact: true })).toBeVisible();
});

test("guide can be reopened from Profile without changing completed state", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.testerGuide", JSON.stringify({ version: 1, status: "completed", step: 3, startIntent: "join" }));
    localStorage.setItem("fs.testerProgress", JSON.stringify({ startedAt: Date.now(), cameraTested: false, inviteShared: false, resultShared: false, progressViewed: false, dismissed: false }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "How Repact works", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workouts you have to prove" })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.testerGuide")).status)).toBe("completed");
});

test("guide and camera success keep a balanced layout on compact phones", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.evaluate(() => startTesterGuide(false));
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  const guideLayout = await page.evaluate(() => {
    const intro = document.querySelector(".guide-intro").getBoundingClientRect();
    const visual = document.querySelector(".guide-visual").getBoundingClientRect();
    const actions = document.querySelector(".guide-actions").getBoundingClientRect();
    return { introBottom: intro.bottom, visualTop: visual.top, visualBottom: visual.bottom, actionsTop: actions.top, actionsBottom: actions.bottom, height: innerHeight };
  });
  expect(guideLayout.visualTop).toBeGreaterThanOrEqual(guideLayout.introBottom - 1);
  expect(guideLayout.actionsTop).toBeGreaterThanOrEqual(guideLayout.visualBottom - 1);
  expect(guideLayout.actionsBottom).toBeLessThanOrEqual(guideLayout.height);

  await page.evaluate(() => {
    ui.screen = "tabs";
    ui.guideCamera = true;
    ui.form = { demoReps: 5 };
    ui.full = DemoCompleteFull;
    render();
  });
  const completeLayout = await page.evaluate(() => {
    const hero = document.querySelector(".demo-complete-hero").getBoundingClientRect();
    const actions = document.querySelector(".demo-complete-actions").getBoundingClientRect();
    return { gap: actions.top - hero.bottom, bottom: actions.bottom, height: innerHeight };
  });
  expect(completeLayout.gap).toBeLessThanOrEqual(70);
  expect(completeLayout.bottom).toBeLessThanOrEqual(completeLayout.height);
});

test("first demo asks for an exercise and remembers the choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try 5 reps", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Choose an exercise" })).toBeVisible();
  await page.getByRole("button", { name: "Squats", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fs.demoExercise")))).toBe("squats");
  await expect(page.getByText("Camera setup", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ui.form.startExercise)).toBe("squats");
});

test("unfinished checklist items are visually muted", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.testerProgress", JSON.stringify({ startedAt: Date.now(), cameraTested: false, inviteShared: false, resultShared: false, progressViewed: false, dismissed: false }));
  });
  await page.goto("/");
  const pending = page.locator(".tester-check-items .pending");
  await expect(pending.first()).toBeVisible();
  const color = await pending.first().locator("svg").evaluate((el) => getComputedStyle(el).color);
  expect(color).not.toBe("rgb(181, 255, 18)");
});

test("completed testing checklist has an explicit Finish test button", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.testerProgress", JSON.stringify({ startedAt: Date.now(), cameraTested: true, inviteShared: true, resultShared: true, progressViewed: true, dismissed: false }));
  });
  await page.goto("/");
  await page.evaluate(() => {
    app.totalReps = 5;
    app.challenges = [newChallenge({
      id: "tester-complete", title: "Tester complete", access: "solo",
      goals: [{ exercise: "pushups", repsPerDay: 5 }], durationDays: 3, startAt: startOfDay(Date.now()),
      myTodayReps: { pushups: 5 },
      participants: [{ id: "me", isMe: true, state: "active", doneToday: true, todayReps: 5 }],
    })];
    render();
  });

  const finish = page.getByRole("button", { name: "Finish test", exact: true });
  await expect(finish).toBeVisible();
  await finish.click();
  await expect(page.locator(".tester-check-card")).toHaveCount(0);
});
