import { test, expect } from "@playwright/test";

test("privacy policy is public and links to data deletion", async ({ page }) => {
  await page.goto("/privacy.html");
  await expect(page.getByRole("heading", { name: "Privacy Policy", exact: true })).toBeVisible();
  await expect(page.getByText("Camera processing", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View deletion instructions", exact: true }))
    .toHaveAttribute("href", "data-deletion.html");
});

test("data deletion instructions provide a direct request path", async ({ page }) => {
  await page.goto("/data-deletion.html");
  await expect(page.getByRole("heading", { name: "Delete your Repact data", exact: true })).toBeVisible();
  await expect(page.getByText("repactapp@gmail.com", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Email deletion request", exact: true }))
    .toHaveAttribute("href", /mailto:repactapp@gmail\.com/);
});
