import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

test("home tab shows the day, not a duplicate challenge list", async ({ page }) => {
  // Первая вкладка теперь «Home».
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();

  // Вступаем в активный streak-челлендж, чтобы появился хиро дня.
  await page.evaluate(() => {
    const c = newChallenge({
      id: "home-active", title: "Home Active", access: "solo",
      goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 0,
      startAt: startOfDay(Date.now()), currentDay: 1,
      participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: false, todayReps: 0 }],
    });
    app.challenges.unshift(c);
    ui.tab = "yours"; ui.detailId = null; render();
  });

  // На Хоуме есть хиро дня («Продолжить»), но НЕТ списка карточек челленджей.
  await expect(page.getByRole("button", { name: /Continue workout/ })).toBeVisible();
  await expect(page.locator(".challenge-card")).toHaveCount(0);

  // Карточка появляется во вкладке Challenges.
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await expect(page.locator(".challenge-card").first()).toBeVisible();
});

test("all-time totals moved to the Progress tab", async ({ page }) => {
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByText("All-time", { exact: true })).toBeVisible();
  await expect(page.getByText("Total reps", { exact: true })).toBeVisible();
});

test("play button on an active challenge card opens workout setup", async ({ page }) => {
  await page.evaluate(() => {
    const c = newChallenge({
      id: "play-active", title: "Play Active", access: "solo",
      goals: [{ exercise: "pushups", repsPerDay: 5000 }], durationDays: 7, buyIn: 0,
      startAt: startOfDay(Date.now()), currentDay: 1,
      participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: false, todayReps: 0 }],
    });
    app.challenges.unshift(c);
    ui.tab = "challenges"; ui.challengeTab = "active"; ui.detailId = null; render();
  });
  await page.locator(".challenge-card").filter({ hasText: "Play Active" }).locator(".card-play").click();
  await expect(page.getByText("Camera setup", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open camera", exact: true })).toBeVisible();
});
