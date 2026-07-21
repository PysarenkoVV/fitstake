import { test, expect } from "@playwright/test";

test("Ukrainian can be selected on onboarding and persists", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("fs.lang")) localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Choose language" }).click();
  await expect(page.getByRole("dialog", { name: "Choose language" })).toBeVisible();
  await page.getByRole("button", { name: /Українська/ }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(page.getByRole("button", { name: "Почати", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.lang")))).toBe("ua");

  await page.reload();
  await expect(page.getByRole("button", { name: "Почати", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Оберіть мову" }).click();
  await expect(page.getByRole("button", { name: /Українська/ })).toHaveAttribute("aria-pressed", "true");
});

test("main navigation is localized into Ukrainian", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("ua"));
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Головна", exact: true })).toBeVisible();
  for (const label of ["Головна", "Челенджі", "Прогрес", "Профіль"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
});
