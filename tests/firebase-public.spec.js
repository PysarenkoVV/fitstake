import { test, expect } from "@playwright/test";

test.skip(!process.env.RUN_FIREBASE_INTEGRATION, "Writes test users and a challenge to the live Firebase project");

async function prepare(page, name) {
  await page.addInitScript((profileName) => {
    localStorage.clear();
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
    localStorage.setItem("fs.profile.name", JSON.stringify(profileName));
  }, name);
  await page.goto("/");
}

async function authenticateTestSession(page, name) {
  await page.waitForFunction(() => !!window.Sync.uid, null, { timeout: 15_000 });
  await page.evaluate((profileName) => {
    Object.defineProperties(window.Sync, {
      email: { configurable: true, get: () => "firebase-test@example.com" },
      isAnonymous: { configurable: true, get: () => false },
    });
    window.Sync.registerUser(profileName);
  }, name);
}

test("creator publishes and another account joins a real challenge", async ({ browser }) => {
  const suffix = Date.now();
  const title = `Firebase QA ${suffix}`;
  const creatorContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  const joiner = await joinerContext.newPage();

  await prepare(creator, "QA Creator");
  await authenticateTestSession(creator, "QA Creator");
  await creator.getByRole("button", { name: "Challenges", exact: true }).click();
  await creator.getByRole("button", { name: "Create Challenge", exact: true }).click();
  await creator.getByRole("button", { name: "Create from scratch", exact: true }).click();
  await creator.getByRole("button", { name: "Continue", exact: true }).click();
  await creator.getByRole("button", { name: /^2 weeks/ }).click();
  await creator.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(creator.getByRole("switch", { name: "Public challenge" })).toBeChecked();
  await creator.getByRole("textbox", { name: "Challenge name" }).fill(title);
  await creator.getByRole("button", { name: "Continue", exact: true }).click();
  await creator.getByRole("button", { name: "Create challenge", exact: true }).click();
  await expect(creator.getByText(title, { exact: true }).first()).toBeVisible();

  await prepare(joiner, "QA Joiner");
  await authenticateTestSession(joiner, "QA Joiner");
  await joiner.getByRole("button", { name: "Challenges", exact: true }).click();
  const remoteCard = joiner.getByRole("button", { name: new RegExp(title) }).first();
  await expect(remoteCard).toBeVisible({ timeout: 15_000 });
  const challengeId = await remoteCard.getAttribute("data-act").then((act) => act.split(":")[1]);
  await remoteCard.click();
  await joiner.getByRole("button", { name: /Join for/ }).first().click();
  await joiner.getByRole("button", { name: /Join for/ }).last().click();
  await expect(joiner.getByRole("button", { name: "Leave challenge" })).toBeVisible({ timeout: 15_000 });

  await creator.reload();
  await authenticateTestSession(creator, "QA Creator");
  await creator.getByRole("button", { name: "Challenges", exact: true }).click();
  await creator.getByRole("button", { name: new RegExp(title) }).first().click();
  await expect(creator.getByText("QA Joiner", { exact: true })).toBeVisible({ timeout: 15_000 });

  await creator.getByText("QA Joiner", { exact: true }).click();
  await expect(creator.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  await creator.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(creator.getByRole("button", { name: "Unfollow", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(creator.getByText("Challenges joined", { exact: true })).toBeVisible();
  await creator.getByRole("button", { name: "Close", exact: true }).click();
  await creator.getByRole("button", { name: "Back", exact: true }).click();

  await joiner.evaluate(({ id, challengeTitle }) => {
    window.Sync.publishActivity({
      challengeId: id,
      challengeTitle,
      actorName: "QA Joiner",
      type: "exercise",
      exercise: "pushups",
    });
  }, { id: challengeId, challengeTitle: title });
  await creator.getByRole("button", { name: "Notifications", exact: true }).click();
  const activity = creator.locator(".activity-row").filter({ hasText: `QA Joiner completed Push-ups in ${title}` });
  await expect(activity).toBeVisible({ timeout: 15_000 });
  await activity.getByRole("button", { name: "🔥", exact: true }).click();
  await expect(activity.getByRole("button", { name: "🔥 1", exact: true })).toHaveClass(/selected/, { timeout: 15_000 });

  await creatorContext.close();
  await joinerContext.close();
});
