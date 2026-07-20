import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

// Соло-челлендж без защиты, стартовавший 3 дня назад и ни разу не закрытый = провален.
function injectFailed(page) {
  return page.evaluate(() => {
    const c = newChallenge({
      id: "doomed", title: "Doomed", access: "solo", missPolicy: "never",
      goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 30, buyIn: 0,
      startAt: startOfDay(Date.now()) - 3 * DAY,
      participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: false, todayReps: 0 }],
    });
    c.currentDay = computeCurrentDay(c);
    app.challenges.unshift(c);
    markFailures();
    ui.tab = "challenges"; ui.challengeTab = "active"; ui.detailId = null; ui.full = null; render();
  });
}

test("проваленный челлендж: серая карточка с крестом, без play, вне хиро Хоума", async ({ page }) => {
  await injectFailed(page);
  const failedCard = page.locator(".challenge-card.failed");
  await expect(failedCard).toBeVisible();
  await expect(failedCard.locator(".challenge-fail-mark")).toBeVisible();
  await expect(failedCard.locator(".card-play")).toHaveCount(0);
  // Момент провала зафиксирован, я переведён в выбывшие.
  expect(await page.evaluate(() => !!app.failedAt.doomed)).toBe(true);

  // Детали: вместо CTA тренировки — статус провала.
  await failedCard.locator(".challenge-card-main").click();
  await expect(page.getByText("Challenge failed", { exact: true })).toBeVisible();

  // Хоум не предлагает продолжать проваленный челлендж.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: /Continue workout/ })).toHaveCount(0);
});

test("через два «серых» дня провал уезжает во вкладку Completed", async ({ page }) => {
  await injectFailed(page);
  await page.evaluate(() => { app.failedAt.doomed = Date.now() - 3 * DAY; render(); });
  await expect(page.locator(".challenge-card.failed")).toHaveCount(0);
  // Имя кнопки включает счётчик («Completed 1») — без exact.
  await page.getByRole("button", { name: /^Completed/ }).click();
  const archived = page.locator(".challenge-card.failed");
  await expect(archived).toBeVisible();
  await expect(archived.locator(".challenge-fail-mark")).toBeVisible();
});

test("«Продолжить» прощает пропуски и возвращает проваленный челлендж в Active", async ({ page }) => {
  await injectFailed(page);
  await page.locator(".challenge-card.failed .challenge-card-main").click();
  await expect(page.getByText("Challenge failed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Keep going", exact: true }).click();
  // Клик-хендлер асинхронный (sfx/haptic) — дожидаемся отклика UI автоповтором,
  // прежде чем читать состояние напрямую (иначе evaluate успевает раньше рендера).
  await expect(page.getByText("Challenge failed", { exact: true })).toHaveCount(0);
  // Момент провала снят, я снова активен — без ожидания сети (локальный solo-челлендж).
  expect(await page.evaluate(() => app.failedAt.doomed)).toBeUndefined();
  expect(await page.evaluate(() => myFailed(app.challenges.find((c) => c.id === "doomed")))).toBe(false);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".challenge-card.failed")).toHaveCount(0);
  await expect(page.locator(".challenge-card").filter({ hasText: "Doomed" })).toBeVisible();
});

test("границы провала: день 1 и разрешённый пропуск — не провал", async ({ page }) => {
  const res = await page.evaluate(() => {
    const probe = (daysAgo, missPolicy) => {
      const c = newChallenge({
        id: "probe-" + daysAgo + missPolicy, access: "solo", missPolicy,
        goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 30, buyIn: 0,
        startAt: startOfDay(Date.now()) - daysAgo * DAY,
        participants: [{ id: "m", name: "M", isMe: true, state: "active", doneToday: false, todayReps: 0 }],
      });
      c.currentDay = computeCurrentDay(c);
      return myFailed(c);
    };
    return {
      startedToday: probe(0, "never"),
      oneMissAllowed: probe(1, "oneTotal"),
      twoMissesOverLimit: probe(2, "oneTotal"),
    };
  });
  expect(res).toEqual({ startedToday: false, oneMissAllowed: false, twoMissesOverLimit: true });
});
