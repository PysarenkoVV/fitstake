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
  await expect(page.getByText("Challenge type", { exact: true })).toBeVisible();
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
