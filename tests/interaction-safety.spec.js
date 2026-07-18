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
  await page.getByRole("button", { name: "Create Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Create from scratch", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click(); // duration
  await page.getByRole("button", { name: "Continue", exact: true }).click(); // rules
  await page.getByRole("button", { name: "Continue", exact: true }).click(); // review

  const create = page.getByRole("button", { name: "Create challenge", exact: true });
  await expect(create).toBeVisible();
  // Быстрый двойной тап — раньше второй заход падал на ui.form=null (selectedExercises(null)).
  await create.dblclick();

  // Мастер закрылся (челлендж создан), приложение живо, необработанных исключений нет.
  await expect(page.getByRole("button", { name: "Create challenge", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Today", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
