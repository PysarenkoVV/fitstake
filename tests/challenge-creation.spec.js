import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

async function openDurationStep(page) {
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await page.getByRole("button", { name: "Create Challenge", exact: true }).click();
  await page.getByRole("button", { name: "Create from scratch", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("duration presets stay selected and steppers remain numeric", async ({ page }) => {
  await openDurationStep(page);
  const twoMonths = page.getByRole("button", { name: /^2 months/ });
  await twoMonths.click();
  await expect(twoMonths).toHaveClass(/selected/);
  await expect(page.getByRole("spinbutton", { name: "Duration (days)" })).toHaveValue("60");

  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Duration (days)" })).toHaveValue("61");
  await page.getByRole("button", { name: "−", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Duration (days)" })).toHaveValue("60");
});

test("rules explain consequences and progression shows final target", async ({ page }) => {
  await openDurationStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText(/before you leave the challenge and lose your stake/)).toBeVisible();
  await page.getByRole("switch", { name: /Progressive overload/ }).click();
  await expect(page.getByText("Final daily target")).toBeVisible();
  await expect(page.getByText(/Push-ups 195/)).toBeVisible();
});

test("review has one clear primary action", async ({ page }) => {
  await openDurationStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Review challenge", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create challenge", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Save & share/ })).toHaveCount(0);
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
