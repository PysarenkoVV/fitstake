import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

async function openWizard(page) {
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  await expect(page.locator(".create-wizard")).toBeVisible();
}

// Шаг 1 мастера: тип челленджа + упражнение. Дальше — по кнопке Continue.
async function fillGoalStep(page, { type = "Daily streak", exercise = "Push-ups" } = {}) {
  await page.getByRole("button", { name: new RegExp(type) }).click();
  await page.getByRole("button", { name: exercise, exact: true }).click();
}

// Шаг 2: срок и доступ. По умолчанию — соло, чтобы не заходить в ветку публичных настроек.
async function fillFormatStep(page, { days = "7d", access = "Only me" } = {}) {
  await page.getByRole("button", { name: days, exact: true }).click();
  await page.getByRole("button", { name: new RegExp(access) }).click();
}

test("Custom превращает сам чип в поле ручного ввода, без отдельной секции", async ({ page }) => {
  await openWizard(page);
  await fillGoalStep(page);

  // Цель по упражнению: свой ряд чипов, «Custom» — прямо в нём.
  const reps = page.locator(".create-target-row").filter({ hasText: "Push-ups" });
  const reps100 = reps.getByRole("button", { name: "100", exact: true });
  await reps100.click();
  await expect(reps100).toHaveClass(/selected/);
  await reps.getByRole("button", { name: "Custom", exact: true }).click();
  await expect(reps.getByRole("textbox", { name: "Push-ups" })).toHaveValue("");
  await expect(reps.getByRole("button", { name: "100", exact: true })).not.toHaveClass(/selected/);
  await reps.getByRole("textbox", { name: "Push-ups" }).fill("120");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Срок: тот же приём — «Custom»-чип превращается в поле на своём месте.
  const dur = page.locator(".create-chips").first();
  const chip14 = dur.getByRole("button", { name: "14d", exact: true });
  await chip14.click();
  await expect(chip14).toHaveClass(/selected/);

  const bodyBefore = await page.locator(".create-wizard-body").elementHandle();
  await dur.getByRole("button", { name: "Custom", exact: true }).click();
  // Инпут — это сам «Custom»-чип внутри ряда чипов (класс create-chip-input),
  // числовая клавиатура, без +/- степпера и без отдельной строки-секции.
  const days = dur.getByRole("textbox", { name: "Days" });
  await expect(days).toHaveClass(/create-chip-input/);
  await expect(days).toHaveValue("");
  await expect(days).toHaveAttribute("inputmode", "numeric");
  await expect(days).toHaveCSS("font-size", "16px");
  await expect(dur.getByRole("button", { name: "14d", exact: true })).not.toHaveClass(/selected/);
  // Замена чипа не пересобирает экран — иначе на iOS обрывается инерционный скролл.
  expect(await bodyBefore.evaluate((node) => node.isConnected)).toBe(true);
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

test("create form keeps a usable scroll area after repeated choices", async ({ page }) => {
  await openWizard(page);
  await fillGoalStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillFormatStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Шаг правил — самый длинный: он и должен прокручиваться внутри себя.
  const body = page.locator(".create-wizard-body");
  await page.getByRole("switch", { name: /Progressive overload/ }).click();
  await body.evaluate((node) => node.scrollTo(0, node.scrollHeight));
  await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

  await page.getByRole("button", { name: /One safety day/ }).click();
  await body.evaluate((node) => node.scrollTo(0, 0));
  await expect.poll(() => body.evaluate((node) => node.scrollTop)).toBe(0);

  const footer = page.getByRole("button", { name: "Continue", exact: true });
  const box = await footer.boundingBox();
  const viewport = page.viewportSize();
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

test("streak rules explain consequences and progression shows final target", async ({ page }) => {
  await openWizard(page);
  await fillGoalStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillFormatStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByText("Allowed misses", { exact: true })).toBeVisible();
  await expect(page.getByText("Miss one day and you're out.", { exact: true })).toBeVisible();
  await page.getByRole("switch", { name: /Progressive overload/ }).click();
  await expect(page.getByText("Final daily target")).toBeVisible();
});

test("challenge creation uses branded exercise icons", async ({ page }) => {
  await openWizard(page);
  await expect(page.locator(".create-exercise-icon")).toHaveCount(4);
  await expect(page.locator(".create-exercise-icon").first()).toHaveCSS("width", "44px");

  await page.evaluate(() => {
    ui.form = newCreateForm({ presetId: "quick7", presetExercise: "pushups", presetStep: 5, pushups: 20, duration: 7 });
    ui.full = PresetQuickSetup;
    render();
  });
  await expect(page.locator(".preset-exercise-icon")).toHaveCSS("width", "84px");
});

test("goal type hides streak rules and keeps a single create action", async ({ page }) => {
  await openWizard(page);
  await fillGoalStep(page, { type: "Total goal" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await fillFormatStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // У goal нет защиты от пропусков и прогрессии — только ставка и название.
  await expect(page.getByText("Allowed misses", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("switch", { name: /Progressive overload/ })).toHaveCount(0);
  await expect(page.getByText("Stake", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Review challenge")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create challenge", exact: true })).toHaveCount(1);
});

test("account screen exposes email and Google entry points", async ({ page }) => {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
});

test("Coins explains test currency and restores a low balance without a store", async ({ page }) => {
  await page.evaluate(() => { app.balance = 50; app.transactions = []; render(); });
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Coins", exact: true }).click();
  await expect(page.getByText("Test coins for joining challenges. They have no cash value.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy coins", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Restore test balance", exact: true }).click();
  await expect(page.getByText("Test balance restored", { exact: true })).toBeVisible();
  await expect(page.locator(".c-money").filter({ hasText: "1,000" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore test balance", exact: true })).toHaveCount(0);
});

test("invite link opens the requested challenge", async ({ page }) => {
  await page.goto("/?join=main");
  await expect(page.getByText("150 Push-ups + 50 Squats", { exact: true }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/\?join=/);
});

test("day share editor offers a 9:16 story with photo and gradient backgrounds", async ({ page }) => {
  await page.evaluate(() => window.openShareDay({ id: "main" }));
  await expect(page.getByText("Share your day", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Repact gradient", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Photo library", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open camera", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share story", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimal", exact: true })).toHaveClass(/active/);
  // Новый minimal: Strava-оверлей без «Potential reward», с AI verified и вордмарком REPACT.
  await expect(page.locator(".share-verified")).toBeVisible();
  await expect(page.locator(".share-wordmark")).toHaveText("REPACT");
  await expect(page.locator(".share-wordmark img")).toHaveAttribute("src", "icons/icon-1024.png");
  await expect(page.locator(".share-slogan")).toHaveText("DON’T JUST SAY IT. PROVE IT.");
  await expect(page.locator(".share-stat")).toHaveCount(3);
  await expect(page.locator(".share-reward")).toHaveCount(0);
  await page.evaluate(() => { window.__shareEditorNode = document.querySelector(".share-editor"); });
  await page.getByRole("button", { name: "Repact gradient", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector(".share-editor") === window.__shareEditorNode)).toBe(true);
  await page.getByRole("button", { name: "Challenge", exact: true }).click();
  await expect(page.getByRole("button", { name: "Challenge", exact: true })).toHaveClass(/active/);
  // «Potential reward» остаётся только в шаблоне Challenge.
  await expect(page.locator(".share-reward")).toContainText("Potential reward");
  await expect(page.locator(".share-challenge-cta")).toHaveText("DON’T JUST SAY IT.PROVE IT.");
  await expect(page.locator(".share-brand img")).toHaveAttribute("src", "icons/icon-1024.png");
  await expect(page.locator(".share-reward")).toContainText(/₴[\d,]+/);
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
  await expect(preview.locator(":scope > img")).toHaveCSS("transform", /matrix/);

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
  await expect(page.getByText("Shared!", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go to Home", exact: true }).click();
  await expect(page.getByText("Share your day", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
});

test("Ukrainian share slogan is consistent in preview and invite text", async ({ page }) => {
  const invite = await page.evaluate(async () => {
    store.lang = "ua";
    render();
    openShareDay({ id: "main" });
    let payload;
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data) => { payload = data; } });
    await shareInvite("main");
    return payload;
  });
  await page.getByRole("button", { name: "Челендж", exact: true }).click();
  await expect(page.locator(".share-challenge-cta")).toHaveText("НЕ ПРОСТО КАЖИ.ДОВЕДИ ЦЕ!");
  expect(invite.text).toContain("Не просто кажи. Доведи це! — Repact");
});

test("successful system share ends with a Home choice while cancellation stays in the editor", async ({ page }) => {
  await page.evaluate(() => {
    window.openShareDay({ id: "main" });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.resolve() });
  });
  await page.getByRole("button", { name: "Share story", exact: true }).click();
  await expect(page.getByText("Shared!", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Go to Home", exact: true })).toBeVisible();
  const heroCenterRatio = await page.locator(".share-complete-hero").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return (rect.top + rect.height / 2) / window.innerHeight;
  });
  expect(heroCenterRatio).toBeGreaterThan(.34);
  expect(heroCenterRatio).toBeLessThan(.56);
  await page.getByRole("button", { name: "Back to result", exact: true }).click();
  await expect(page.getByText("Share your day", { exact: true })).toHaveCount(0);

  const instagramReturn = await page.evaluate(async () => {
    window.__fallbackDownloads = 0;
    HTMLAnchorElement.prototype.click = function () { window.__fallbackDownloads++; };
    Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("Extension returned", "NotAllowedError")) });
    const challenge = app.challenges.find((item) => item.id === "main");
    const shared = await shareDayStory(challenge, { template: "minimal", dim: 45 });
    return { shared, downloads: window.__fallbackDownloads };
  });
  expect(instagramReturn).toEqual({ shared: true, downloads: 0 });

  await page.evaluate(() => {
    window.openShareDay({ id: "main" });
    Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("Abort", "AbortError")) });
  });
  await page.getByRole("button", { name: "Share story", exact: true }).click();
  await expect(page.getByText("Share your day", { exact: true })).toBeVisible();
  await expect(page.getByText("Shared!", { exact: true })).toHaveCount(0);
});

test("story camera fills the screen and crops captures to 9:16", async ({ page }) => {
  const crops = await page.evaluate(() => ({ landscape: storyCrop(1920, 1080), portrait: storyCrop(1080, 1920) }));
  expect(crops.landscape).toEqual({ x: 656.25, y: 0, width: 607.5, height: 1080 });
  expect(crops.portrait).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });

  await page.evaluate(() => {
    window.openShareDay({ id: "main" });
    navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  });
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.locator(".story-camera")).toBeVisible();
  await expect(page.locator(".story-camera video")).toHaveCSS("object-fit", "cover");
  await expect(page.getByText("9:16 · Story", { exact: true })).toBeVisible();
  await page.locator(".story-camera").getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".story-camera")).toHaveCount(0);
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
  expect(download.suggestedFilename()).toBe("repact-challenge.jpg");
  await expect.poll(() => page.evaluate(() => window.__challengeExport)).toEqual({ width: 1080, height: 1920, type: "image/jpeg" });
});
