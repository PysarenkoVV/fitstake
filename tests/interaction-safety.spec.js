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
