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
  // Новая форма — одна страница; Push-ups выбран и Solo по умолчанию, можно сразу создавать.
  const create = page.getByRole("button", { name: "Create challenge", exact: true });
  await expect(create).toBeVisible();
  // Быстрый двойной тап — раньше второй заход падал на ui.form=null (selectedExercises(null)).
  await create.dblclick();

  // Форма закрылась (челлендж создан), приложение живо, необработанных исключений нет.
  await expect(page.getByRole("button", { name: "Create challenge", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
