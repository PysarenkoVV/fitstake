import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

test("двойной тап по «Create challenge» не роняет обработчик и создаёт один челлендж", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  // Проходим мастер. Берём «Only me» (стартует сразу и ведёт на список), чтобы после
  // создания увидеть таб-бар, а не экран инвайта private/public.
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await page.getByRole("button", { name: /Daily streak/ }).click();
  await page.getByRole("button", { name: "Push-ups", exact: true }).click();
  await next.click();
  await page.getByRole("button", { name: "7d", exact: true }).click();
  await page.getByRole("button", { name: /Only me/ }).click();
  await next.click();
  await page.getByRole("button", { name: /One safety day/ }).click();
  await next.click();
  const create = page.getByRole("button", { name: "Create challenge", exact: true });
  await expect(create).toBeVisible();
  // Быстрый двойной тап — раньше второй заход падал на ui.form=null (selectedExercises(null)).
  await create.dblclick();

  // Форма закрылась (челлендж создан), приложение живо, необработанных исключений нет.
  await expect(page.getByRole("button", { name: "Create challenge", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Challenge complete starts at the top and keeps native vertical scrolling", async ({ page }) => {
  await page.evaluate(() => {
    const c = newChallenge({
      id: "complete-scroll", title: "Completed challenge", access: "solo",
      goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 50,
      startAt: startOfDay(Date.now()), currentDay: 7, isCompleted: true,
      participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: true, todayReps: 50 }],
    });
    app.challenges.unshift(c);
    ui.full = DemoCompleteFull;
    render();
    document.querySelector(".fullscreen").scrollTop = 400;
    openChallengeComplete(c);
  });

  const full = page.locator(".challenge-complete");
  await expect(full).toBeVisible();
  await expect(full.locator(".challenge-complete-trophy")).toBeVisible();
  await expect(full.locator(".repact-prize-mark")).toBeVisible();
  await expect(page.getByRole("button", { name: "Take photo", exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Upload", exact: true })).toHaveCount(2);
  expect(await full.evaluate((el) => el.scrollTop)).toBe(0);
  expect(await full.evaluate((el) => getComputedStyle(el).touchAction)).toBe("pan-y");
  await full.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  expect(await full.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  const title = page.getByText("Challenge complete!", { exact: true });
  const titleNode = await title.elementHandle();
  await page.locator('[data-act="inc"][data-key="weight"]').click();
  expect(await title.evaluate((el, original) => el === original, titleNode)).toBe(true);
  await expect(page.locator('[data-model="weight"]')).toHaveValue("76");
});

test("challenge details accept vertical scrolling immediately on touch devices", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.evaluate(() => {
    const c = newChallenge({
      id: "detail-scroll", title: "Scrollable challenge", access: "solo",
      goals: [{ exercise: "squats", repsPerDay: 55 }], durationDays: 7, buyIn: 50,
      startAt: startOfDay(Date.now()), currentDay: 2,
      participants: [{ id: "me", name: "Me", isMe: true, state: "failed", doneToday: false, todayReps: 13 }],
    });
    app.challenges.unshift(c);
    openDetail(c.id);
  });

  const detail = page.locator("#detail-scroll");
  await expect(detail).toBeVisible();
  await expect(detail).toHaveClass(/challenge-detail/);
  expect(await detail.evaluate((el) => getComputedStyle(el).touchAction)).toBe("pan-y");
  expect(await detail.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  expect(await page.locator("html").evaluate((el) => el.classList.contains("vt"))).toBe(false);

  await detail.evaluate((el) => { el.scrollTop = 220; });
  expect(await detail.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("yesterday's local progress is cleared before Firebase can copy it into today", async ({ page }) => {
  const result = await page.evaluate(() => {
    const today = dateKey();
    const yesterday = dateKey(Date.now() - DAY);
    const main = app.challenges.find((c) => c.id === "main");
    Object.defineProperty(Sync, "uid", { configurable: true, value: "daily-reset-me" });
    Sync.state.participants = {
      "daily-reset-me": {
        total: 200,
        days: { [yesterday]: { pushups: 150, squats: 50 } },
      },
    };
    main.myTodayReps = { pushups: 150, squats: 50 };
    main.participants = [{ id: "daily-reset-me", isMe: true, state: "active", doneToday: true, todayReps: 200 }];
    app.dayKey = yesterday;
    const reports = [];
    const originalReport = Sync.report;
    Sync.report = (...args) => reports.push(args);
    applySync();
    Sync.report = originalReport;
    return {
      dayKey: app.dayKey,
      today,
      progress: main.myTodayReps,
      doneToday: C.me(main).doneToday,
      reports,
    };
  });

  expect(result.dayKey).toBe(result.today);
  expect(result.progress).toEqual({});
  expect(result.doneToday).toBe(false);
  expect(result.reports).toEqual([]);
});
