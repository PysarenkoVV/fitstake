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

test("home tips remain available after an active challenge is created", async ({ page }) => {
  await page.evaluate(() => {
    app.challenges.unshift(newChallenge({
      id: "tips-active", title: "20 Push-ups", access: "solo",
      goals: [{ exercise: "pushups", repsPerDay: 20 }], durationDays: 7, buyIn: 0,
      startAt: startOfDay(Date.now()), currentDay: 1,
      participants: [{ id: "me", isMe: true, state: "active" }],
    }));
    ui.tab = "yours"; ui.homeTipsExpanded = false; render();
  });
  const tips = page.getByRole("button", { name: "Tips & quick start", exact: true });
  await expect(tips).toBeVisible();
  await tips.click();
  await expect(page.getByRole("button", { name: "Try 5 reps", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide tips", exact: true })).toHaveAttribute("aria-expanded", "true");
});

test("challenge progress becomes brighter as the daily goal is completed", async ({ page }) => {
  await page.evaluate(() => {
    app.challenges = [newChallenge({
      id: "visual-progress", title: "Visual progress", access: "solo",
      goals: [{ exercise: "pushups", repsPerDay: 150 }, { exercise: "squats", repsPerDay: 50 }],
      durationDays: 7, buyIn: 0, startAt: startOfDay(Date.now()),
      participants: [{ id: "me", isMe: true, state: "active" }],
      myTodayReps: { pushups: 50, squats: 70 },
    })];
    ui.tab = "challenges"; ui.challengeTab = "active"; render();
  });

  const card = page.locator(".challenge-card", { hasText: "Visual progress" });
  const bars = card.locator(".challenge-progress");
  await expect(bars).toHaveCount(2);
  expect(await bars.nth(0).locator("span").evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.7);
  await expect(bars.nth(1)).toHaveClass(/is-complete/);
  expect(await bars.nth(1).locator("span").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

test("all-time totals moved to the Progress tab", async ({ page }) => {
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByText("All-time", { exact: true })).toBeVisible();
  await expect(page.getByText("Total reps", { exact: true })).toBeVisible();
});

test("Progress highlights weekly growth, discipline, records, and recent workouts", async ({ page }) => {
  await page.evaluate(() => {
    const today = startOfDay(Date.now());
    app.history = [
      { id: "p1", date: today - DAY, entries: [{ title: "Daily", reps: 80, norm: 80, byEx: { pushups: 50, squats: 30 } }] },
      { id: "p2", date: today, entries: [{ title: "Daily", reps: 100, norm: 100, byEx: { pushups: 60, squats: 40 } }] },
    ];
    app.totalReps = 180; app.repsByExercise = { pushups: 110, squats: 70 };
    ui.tab = "stats"; render();
  });
  await expect(page.getByText("This week", { exact: true })).toBeVisible();
  await expect(page.getByText("Last 30 days", { exact: true })).toBeVisible();
  await expect(page.getByText("Personal records", { exact: true })).toBeVisible();
  await expect(page.getByText("Recent workouts", { exact: true })).toBeVisible();
  await expect(page.locator(".discipline-day")).toHaveCount(30);
  await expect(page.locator(".record-row")).toHaveCount(2);
});

test("Recent workouts shows three entries until expanded", async ({ page }) => {
  await page.evaluate(() => {
    const today = startOfDay(Date.now());
    app.challenges = [];
    app.history = Array.from({ length: 5 }, (_, i) => ({
      id: "recent-" + i,
      date: today - i * DAY,
      entries: [{ title: i === 0 ? null : "Workout " + (i + 1), reps: 20 + i, norm: i === 0 ? null : 20, byEx: { pushups: 20 + i } }],
    })).reverse();
    ui.tab = "stats";
    ui.recentWorkoutsExpanded = false;
    render();
  });
  const journal = page.locator(".progress-journal");
  await expect(journal.locator(".entry-row:visible")).toHaveCount(3);
  const toggle = journal.getByRole("button", { name: "Show all workouts" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(journal.locator(".entry-row:visible")).toHaveCount(5);
  await expect(journal.getByRole("button", { name: "Collapse workouts" })).toHaveAttribute("aria-expanded", "true");
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

test("Continue workout offers only challenges that are not completed today", async ({ page }) => {
  await page.evaluate(() => {
    app.challenges = [
      newChallenge({ id: "todo-a", title: "Push day", access: "solo", goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 0, startAt: startOfDay(Date.now()), participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: false, todayReps: 10 }], myTodayReps: { pushups: 10 } }),
      newChallenge({ id: "done", title: "Already done", access: "solo", goals: [{ exercise: "squats", repsPerDay: 20 }], durationDays: 7, buyIn: 0, startAt: startOfDay(Date.now()), participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: true, todayReps: 20 }], myTodayReps: { squats: 20 } }),
      newChallenge({ id: "todo-b", title: "Dip day", access: "solo", goals: [{ exercise: "dips", repsPerDay: 30 }], durationDays: 7, buyIn: 0, startAt: startOfDay(Date.now()), participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: false, todayReps: 0 }] }),
    ];
    ui.tab = "yours"; ui.detailId = null; render();
  });

  await page.getByRole("button", { name: "Continue workout", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Choose a workout" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Push day/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Dip day/ })).toBeVisible();
  await expect(page.getByText("Already done", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: /Dip day/ }).click();
  await expect(page.getByText("Camera setup", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ui.form.challengeId)).toBe("todo-b");
});

test("Continue workout excludes pending challenges", async ({ page }) => {
  await page.evaluate(() => {
    app.challenges = [
      newChallenge({ id: "active", title: "Active workout", access: "solo", goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 0, startAt: startOfDay(Date.now()), participants: [{ id: "me", isMe: true, state: "active" }] }),
      newChallenge({ id: "pending", title: "Pending workout", access: "private", goals: [{ exercise: "dips", repsPerDay: 30 }], durationDays: 7, buyIn: 0, startAt: null, participants: [{ id: "me", isMe: true, state: "active" }] }),
    ];
    ui.tab = "yours"; render();
  });
  await page.getByRole("button", { name: "Continue workout", exact: true }).click();
  await expect(page.getByText("Active workout", { exact: true })).toBeVisible();
  await expect(page.getByText("Pending workout", { exact: true })).toHaveCount(0);
});

test("remote cleanup removes cached Browse challenges but keeps the main challenge", async ({ page }) => {
  const result = await page.evaluate(() => {
    app.challenges.push(newChallenge({
      id: "ch_stale_remote", title: "Stale Browse challenge", access: "public", isPublic: true,
      goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 0,
    }));
    Sync.state.challenges = {};
    applyPublicChallenges(dateKey());
    return {
      staleExists: app.challenges.some((c) => c.id === "ch_stale_remote"),
      mainExists: app.challenges.some((c) => c.id === "main"),
    };
  });
  expect(result).toEqual({ staleExists: false, mainExists: true });
});
