import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
});

test("required choices unlock each step and public defaults to unlimited", async ({ page }) => {
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await expect(next).toBeDisabled();

  await page.getByRole("button", { name: /Daily streak/ }).click();
  await page.getByRole("button", { name: "Push-ups", exact: true }).click();
  await expect(next).toBeEnabled();
  await next.click();

  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "7d", exact: true }).click();
  await page.getByRole("button", { name: /Public/ }).click();
  await expect(page.getByRole("button", { name: /Public/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /By invitation/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".create-access-list .selected")).toHaveCount(1);
  await expect(page.getByText("Unlimited participants")).toBeVisible();
  await expect(next).toBeEnabled();

  await page.getByRole("switch").click();
  await expect(page.getByText("Up to 10 participants")).toBeVisible();
  await page.getByRole("button", { name: "20", exact: true }).click();
  await expect(page.getByText("Up to 20 participants")).toBeVisible();
});

test("rules use hryvnia test coin and lead to an editable review", async ({ page }) => {
  await page.getByRole("button", { name: /Daily streak/ }).click();
  await page.getByRole("button", { name: "Squats", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "3d", exact: true }).click();
  await page.getByRole("button", { name: /Only me/ }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.locator(".coin-mark")).toBeVisible();
  await expect(page.getByText("No stake", { exact: true })).toBeVisible();
  const continueButton = page.getByRole("button", { name: "Continue", exact: true });
  await expect(continueButton).toBeDisabled();
  await page.getByRole("button", { name: /One safety day/ }).click();
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  await expect(page.getByText("Review challenge")).toBeVisible();
  await expect(page.getByText(/3 days · Only me/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create challenge", exact: true })).toBeEnabled();
});

test("review combines rules and stake into one final conditions card", async ({ page }) => {
  await page.evaluate(() => {
    ui.form = newCreateForm({
      step: 3, type: "goal", access: "public", title: "Qq", miss: null,
      sel_pushups: true, pushups: 50, duration: 3, buyIn: 50,
      limitParticipants: false,
    });
    ui.full = CreateWizard;
    render();
  });

  await expect(page.locator(".create-review-card")).toHaveCount(3);
  await expect(page.getByText("Final conditions", { exact: true })).toHaveCount(1);
  await expect(page.getByText("No daily rules · Stake 50", { exact: true })).toBeVisible();
  await expect(page.locator(".create-review-label").getByText("Rules", { exact: true })).toHaveCount(0);
  await expect(page.locator(".create-review-label").getByText("Stake", { exact: true })).toHaveCount(0);
});
