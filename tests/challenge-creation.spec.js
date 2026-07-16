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
  const layout = await page.locator(".create-review").evaluate((review) => {
    const cards = Array.from(review.querySelectorAll(".create-review-card")).map((card) => card.getBoundingClientRect());
    return { overflow: review.scrollWidth > review.clientWidth, overlap: cards.some((card, index) => index > 0 && card.top < cards[index - 1].bottom) };
  });
  expect(layout).toEqual({ overflow: false, overlap: false });
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

test("day share editor offers a 9:16 story with photo and gradient backgrounds", async ({ page }) => {
  await page.evaluate(() => window.openShareDay({ id: "main" }));
  await expect(page.getByText("Share your day", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "FitStake gradient", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Photo library", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open camera", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share story", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimal", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".share-reward")).toContainText("Potential reward");
  await expect(page.locator(".share-reward")).toContainText(/🔥\d+/);
  await page.evaluate(() => { window.__shareEditorNode = document.querySelector(".share-editor"); });
  await page.getByRole("button", { name: "FitStake gradient", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector(".share-editor") === window.__shareEditorNode)).toBe(true);
  await page.getByRole("button", { name: "Challenge", exact: true }).click();
  await expect(page.getByRole("button", { name: "Challenge", exact: true })).toHaveClass(/active/);
  await expect.poll(() => page.evaluate(() => document.querySelector(".share-editor") === window.__shareEditorNode)).toBe(true);
  const preview = page.locator(".share-story-preview");
  await expect(preview).toHaveCSS("aspect-ratio", "9 / 16");

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Photo library", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles("icons/icon-512.png");
  await expect.poll(() => page.evaluate(() => document.querySelector(".share-editor") === window.__shareEditorNode)).toBe(true);
  await expect(page.getByRole("slider", { name: "Photo scale" })).toBeVisible();
  await page.getByRole("slider", { name: "Photo scale" }).fill("1.5");
  await page.getByRole("slider", { name: "Background dimming" }).fill("60");
  await expect(preview.locator("img")).toHaveCSS("transform", /matrix/);

  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      window.__storyExport = { width: this.width, height: this.height, type };
      return original.call(this, callback, type, quality);
    };
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share story", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fitstake-story.jpg");
  await expect.poll(() => page.evaluate(() => window.__storyExport)).toEqual({ width: 1080, height: 1920, type: "image/jpeg" });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Share your day", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
});

test("completed day highlights the result before sharing", async ({ page }) => {
  await page.evaluate(() => window.openDayComplete({ id: "main" }));
  await expect(page.getByText("Day done!", { exact: true })).toBeVisible();
  await expect(page.getByText("Above goal", { exact: true })).toBeVisible();
  await expect(page.getByText("Best day", { exact: true })).toBeVisible();
  await expect(page.getByText("Today's place", { exact: true })).toBeVisible();
  await expect(page.getByText("Streak", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText("Share your day", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("Day done!", { exact: true })).toBeVisible();
});

test("completed challenge exports an informative 9:16 story", async ({ page }) => {
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      window.__challengeExport = { width: this.width, height: this.height, type };
      return original.call(this, callback, type, quality);
    };
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(() => window.shareCard({
    title: "50 Pull-ups + 50 Dips", duration: 30, totalReps: 3000,
    exerciseSummary: "1500 pull-ups · 1500 dips", weight: "75 → 78 kg", maxReps: "15 → 35", payout: 700,
  }));
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fitstake-challenge.jpg");
  await expect.poll(() => page.evaluate(() => window.__challengeExport)).toEqual({ width: 1080, height: 1920, type: "image/jpeg" });
});
