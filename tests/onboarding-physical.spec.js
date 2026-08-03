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

test("returning user can sign in from the welcome screen and skip onboarding", async ({ page }) => {
  const returningButton = page.getByRole("button", { name: "Already have an account? Log in", exact: true });
  await expect(returningButton).toBeVisible();
  expect((await returningButton.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 375, height: 667 });
  await returningButton.scrollIntoViewIfNeeded();
  const compactButtonBox = await returningButton.boundingBox();
  expect(compactButtonBox.y + compactButtonBox.height).toBeLessThanOrEqual(667);
  await returningButton.click();
  await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toHaveCount(0);
  const emailLogin = page.getByRole("button", { name: "Log in", exact: true });
  await emailLogin.scrollIntoViewIfNeeded();
  expect((await emailLogin.boundingBox()).height).toBeGreaterThanOrEqual(44);

  await page.evaluate(() => {
    window.__returningAuthOptions = null;
    Object.defineProperties(Sync, {
      uid: { configurable: true, get: () => "existing-user" },
      email: { configurable: true, get: () => "existing@example.com" },
      isAnonymous: { configurable: true, get: () => false },
    });
    Sync.state.users = { "existing-user": { name: "Existing athlete" } };
    Sync.signInGoogle = async (options) => {
      window.__returningAuthOptions = options;
      return { ok: true, profile: { name: "Existing athlete" } };
    };
  });
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();

  await expect(page.getByRole("button", { name: "Challenges", exact: true })).toBeVisible();
  await expect(page.getByText("Welcome back", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__returningAuthOptions)).toEqual({ existing: true });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.onboarded")))).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.profile.name")))).toBe("Existing athlete");
});

async function toPhysicalStep(page) {
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  await expect(page.locator("#onb-name")).toHaveValue("Test");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Your physical profile")).toBeVisible();
}

async function toExercisesStep(page) {
  await toPhysicalStep(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Your exercises")).toBeVisible();
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
  await expect(page.getByText("Your exercises")).toBeVisible();
});

test("exercises step: multi-select does not ask users to estimate a one-set max", async ({ page }) => {
  await toExercisesStep(page);
  await expect(page.locator(".onb-ex")).toHaveCount(4);
  await expect(page.locator(".onb-ex .physio-slider")).toHaveCount(0);
  await expect(page.getByText("Max reps in one set")).toHaveCount(0);

  await page.getByRole("button", { name: "Squats", exact: true }).click();
  await expect(page.locator(".onb-ex.selected")).toHaveCount(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("fs.profile.sel_squats")))).toBe(true);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Your fitness level")).toBeVisible();
});

test("full onboarding walk still reaches the app after merging steps", async ({ page }) => {
  await toExercisesStep(page);
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await next.click(); // упражнения → уровень (отжимания выбраны по умолчанию)
  await expect(page.getByText("Your fitness level")).toBeVisible();
  await next.click(); // → дневная норма
  await expect(page.getByText("reps per day")).toBeVisible();
  await expect(page.locator(".wheel")).toHaveCount(0); // колесо удалено
  await next.click(); // → вход (Sync включён в тестовом окружении)
  await expect(page.getByRole("button", { name: "Continue with Google", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Apple", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Facebook", exact: true })).toBeVisible();
  expect(await page.evaluate(() => typeof Sync.signInApple)).toBe("function");
  expect(await page.evaluate(() => typeof Sync.signInFacebook)).toBe("function");
  await page.getByRole("button", { name: "Continue as guest", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workouts you have to prove", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("button", { name: "Challenges", exact: true })).toBeVisible();
});
