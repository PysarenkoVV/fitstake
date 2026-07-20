import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

async function openForm(page) {
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  await expect(page.locator(".create-form")).toBeVisible();
}

test("duration Custom превращает сам чип в поле ручного ввода, без отдельной секции", async ({ page }) => {
  await openForm(page);
  const form = page.locator(".create-form");
  const dur = form.locator(".create-section", { hasText: "DURATION" });
  const chip14 = dur.getByRole("button", { name: "14d", exact: true });
  await chip14.click();
  await expect(chip14).toHaveClass(/selected/);

  await dur.getByRole("button", { name: "Custom", exact: true }).click();
  // Инпут — это сам «Custom»-чип внутри ряда чипов (класс create-chip-input),
  // числовая клавиатура, без +/- степпера и без отдельной строки-секции.
  const days = dur.getByRole("textbox", { name: "Days" });
  await expect(days).toHaveClass(/create-chip-input/);
  await expect(days).toHaveValue("14");
  await expect(days).toHaveAttribute("inputmode", "numeric");
  await expect(dur.getByRole("button", { name: "+", exact: true })).toHaveCount(0);
  await expect(dur.getByRole("button", { name: "Custom", exact: true })).toHaveCount(0);

  await days.fill("45");
  await days.blur();
  await expect(dur.getByRole("textbox", { name: "Days" })).toHaveValue("45");

  // На blur значение клампится по максимуму (365 дней).
  await dur.getByRole("textbox", { name: "Days" }).fill("900");
  await dur.getByRole("textbox", { name: "Days" }).blur();
  await expect(dur.getByRole("textbox", { name: "Days" })).toHaveValue("365");
});

test("streak rules explain consequences and progression shows final target", async ({ page }) => {
  await openForm(page);
  await expect(page.getByText(/before you leave the challenge and lose your stake/)).toBeVisible();
  await page.getByRole("switch", { name: /Progressive overload/ }).click();
  await expect(page.getByText("Final daily target")).toBeVisible();
});

test("goal type hides streak rules and switches the reps label to a total", async ({ page }) => {
  await openForm(page);
  const sectionLabels = page.locator(".create-section-label");
  await expect(sectionLabels.filter({ hasText: /^Daily minimum reps$/ })).toBeVisible();
  await expect(page.getByText(/before you leave the challenge and lose your stake/)).toBeVisible();

  await page.locator(".create-pick", { hasText: "Goal" }).click();
  await expect(sectionLabels.filter({ hasText: /^Total reps$/ })).toBeVisible();
  // У goal нет защиты от пропусков/прогрессии.
  await expect(page.getByText(/before you leave the challenge and lose your stake/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create challenge", exact: true })).toHaveCount(1);
});

test("account screen exposes email and Google entry points", async ({ page }) => {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
});

test("invite link opens the requested challenge", async ({ page }) => {
  await page.goto("/?join=main");
  await expect(page.getByText("150 Push-ups + 50 Squats", { exact: true }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/\?join=/);
});

test("day share editor offers a 9:16 story with photo and gradient backgrounds", async ({ page }) => {
  await page.evaluate(() => window.openShareDay({ id: "main" }));
  await expect(page.getByText("Share your day", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "FitStake gradient", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Photo library", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open camera", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share story", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimal", exact: true })).toHaveClass(/active/);
  // Новый minimal: Strava-оверлей без «Potential reward», с AI verified и вордмарком REPACT.
  await expect(page.locator(".share-verified")).toBeVisible();
  await expect(page.locator(".share-wordmark")).toHaveText("REPACT");
  await expect(page.locator(".share-stat")).toHaveCount(3);
  await expect(page.locator(".share-reward")).toHaveCount(0);
  await page.evaluate(() => { window.__shareEditorNode = document.querySelector(".share-editor"); });
  await page.getByRole("button", { name: "FitStake gradient", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector(".share-editor") === window.__shareEditorNode)).toBe(true);
  await page.getByRole("button", { name: "Challenge", exact: true }).click();
  await expect(page.getByRole("button", { name: "Challenge", exact: true })).toHaveClass(/active/);
  // «Potential reward» остаётся только в шаблоне Challenge.
  await expect(page.locator(".share-reward")).toContainText("Potential reward");
  await expect(page.locator(".share-reward")).toContainText(/🔥\d+/);
  await expect.poll(() => page.evaluate(() => document.querySelector(".share-editor") === window.__shareEditorNode)).toBe(true);
  const preview = page.locator(".share-story-preview");
  await expect(preview).toHaveCSS("aspect-ratio", "9 / 16");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Photo library", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles("icons/icon-512.png");
  await expect.poll(() => page.evaluate(() => document.querySelector(".share-editor") === window.__shareEditorNode)).toBe(true);
  await expect(page.getByRole("slider", { name: "Photo scale" })).toBeVisible();
  await page.getByRole("slider", { name: "Photo scale" }).fill("1.5");
  await page.getByRole("slider", { name: "Background dimming" }).fill("60");
  await expect(preview.locator("img")).toHaveCSS("transform", /matrix/);

  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      window.__storyExport = { width: this.width, height: this.height, type };
      return original.call(this, callback, type, quality);
    };
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share story", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("repact-story.jpg");
  await expect.poll(() => page.evaluate(() => window.__storyExport)).toEqual({ width: 1080, height: 1920, type: "image/jpeg" });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Share your day", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
});

test("completed day highlights the result before sharing", async ({ page }) => {
  await page.evaluate(() => window.openDayComplete({ id: "main" }));
  await expect(page.getByText("Day done!", { exact: true })).toBeVisible();
  await expect(page.getByText("Above goal", { exact: true })).toBeVisible();
  await expect(page.getByText("Best day", { exact: true })).toBeVisible();
  await expect(page.getByText("Today's place", { exact: true })).toBeVisible();
  await expect(page.getByText("Streak", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText("Share your day", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Day done!", { exact: true })).toBeVisible();
});

test("completed day stores workout time and set performance", async ({ page }) => {
  const summary = await page.evaluate(() => {
    const challenge = app.challenges.find((item) => item.id === "main");
    challenge.myTodayReps = {};
    let me = C.me(challenge);
    if (!me) { me = { id: "test-me", name: "Test", isMe: true, state: "active", doneToday: false, todayReps: 0 }; challenge.participants.unshift(me); }
    me.todayReps = 0; me.doneToday = false;
    challenge.workoutStatsByDay = {};
    const previous = new Date(Date.now() - 86400000);
    challenge.workoutStatsByDay[dateKey(previous.getTime())] = { elapsedMs: 300000, restMs: 120000, setReps: [40, 40, 40, 40, 40], reps: 200, completedAt: previous.getTime() };
    addReps(challenge, { pushups: 150, squats: 50 }, { elapsedMs: 248000, restMs: 100000, setReps: [40, 40, 40, 40, 40] });
    openDayComplete(challenge);
    return workoutSummary(challenge);
  });
  expect(summary).toMatchObject({ time: "04:08", sets: 5, average: 40, best: 40, improvementMs: 52000 });
  await expect(page.getByText("04:08", { exact: true })).toBeVisible();
  await expect(page.getByText("52 sec faster", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  // Minimal-оверлей: время / сеты / среднее — тремя колонками.
  await expect(page.locator(".share-stat-value")).toHaveText(["04:08", "5", "40"]);
  const improvement = page.locator(".share-insight");
  await expect(improvement).toContainText("faster than last time");
  await expect(improvement).toContainText("00:52");
});

test("completed challenge exports an informative 9:16 story", async ({ page }) => {
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      window.__challengeExport = { width: this.width, height: this.height, type };
      return original.call(this, callback, type, quality);
    };
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => window.shareCard({
    title: "50 Pull-ups + 50 Dips", duration: 30, totalReps: 3000,
    exerciseSummary: "1500 pull-ups · 1500 dips", weight: "75 → 78 kg", maxReps: "15 → 35", payout: 700,
  }));
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fitstake-challenge.jpg");
  await expect.poll(() => page.evaluate(() => window.__challengeExport)).toEqual({ width: 1080, height: 1920, type: "image/jpeg" });
});
