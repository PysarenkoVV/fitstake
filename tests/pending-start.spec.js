import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

test("public and private challenges land in Pending; solo starts Active", async ({ page }) => {
  const statuses = await page.evaluate(async () => {
    const originalCreate = Sync.createChallenge;
    Sync.createChallenge = async () => true;
    const mk = async (access) => {
      ui.form = newCreateForm();
      ui.form.access = access; ui.form.sel_pushups = true; ui.form.pushups = 50;
      ui.form.buyIn = 0; ui.form.minPlayers = 2;
      await saveChallengeForm();
      return C.status(app.challenges[0]);
    };
    try {
      return { solo: await mk("solo"), priv: await mk("private"), pub: await mk("public") };
    } finally {
      Sync.createChallenge = originalCreate;
    }
  });
  expect(statuses).toEqual({ solo: "active", priv: "pending", pub: "pending" });
});

test("public pending card shows Ready! and hides it once tapped", async ({ page }) => {
  await page.evaluate(() => {
    const c = newChallenge({
      id: "pub-test", title: "Pending Public", access: "public", isPublic: true, minPlayers: 3,
      goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 0, startAt: null, currentDay: 1,
      participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: false, todayReps: 0 }],
    });
    app.challenges.unshift(c);
    ui.tab = "challenges"; ui.challengeTab = "pending"; ui.detailId = null; ui.full = null; ui.sheet = null;
    render();
  });
  const readyBtn = page.getByRole("button", { name: "Ready!", exact: true });
  await expect(readyBtn).toBeVisible();
  await expect(page.getByText(/Gathered 1 \/ 3/)).toBeVisible();
  await readyBtn.click();
  await expect(page.getByRole("button", { name: "Ready!", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Waiting for everyone to gather/)).toBeVisible();
});
