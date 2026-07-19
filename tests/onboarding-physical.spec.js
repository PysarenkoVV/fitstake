import { test, expect } from "@playwright/test";

// Онбординг проходим целиком, поэтому fs.onboarded НЕ ставим.
// Имя сеем в store заранее: фоновые sync-колбэки перерисовывают экран и стирают
// набранный в поле текст (гонка), а значение из store переживает любой render.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.lang", JSON.stringify("en"));
    localStorage.setItem("fs.profile.name", JSON.stringify("Test"));
  });
  await page.goto("/");
});

async function toPhysicalStep(page) {
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(page.locator("#onb-name")).toHaveValue("Test");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Your physical profile")).toBeVisible();
}

test("physical profile step: gender cards, slider drag and stepper buttons", async ({ page }) => {
  await toPhysicalStep(page);
  await expect(page.getByText(/Step 2 of/)).toBeVisible();
  await expect(page.locator(".physio-slider")).toHaveCount(3);

  await page.getByRole("button", { name: "Female", exact: true }).click();
  await expect(page.getByRole("button", { name: "Female", exact: true })).toHaveClass(/selected/);
  // store-proxy хранит значения JSON-стрингифицированными.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.profile.gender")))).toBe("female");

  const weight = page.locator('[data-slider="profile.weightKg"]');
  await weight.fill("90"); // fill на range диспатчит input → ветка data-slider
  await expect(page.locator('[data-val-for="profile.weightKg"]')).toHaveText("90");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.profile.weightKg")))).toBe(90);

  await page.locator('[data-act="inc"][data-store="profile.age"]').click();
  await expect(page.locator('[data-val-for="profile.age"]')).toHaveText("26");

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Which exercise do you want to start with?")).toBeVisible();
});

test("full onboarding walk still reaches the app after step renumbering", async ({ page }) => {
  await toPhysicalStep(page);
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await next.click(); // параметры → упражнение
  await expect(page.getByText("Which exercise do you want to start with?")).toBeVisible();
  await next.click(); // → уровень
  await expect(page.getByText("Your fitness level")).toBeVisible();
  await next.click(); // → максимум за подход
  await expect(page.locator(".wheel")).toBeVisible();
  await next.click(); // → дневная норма
  await expect(page.getByText("reps per day")).toBeVisible();
  await next.click(); // → вход (Sync включён в тестовом окружении)
  await page.getByRole("button", { name: "Continue as guest", exact: true }).click();
  await expect(page.getByRole("button", { name: "Challenges", exact: true })).toBeVisible();
});
