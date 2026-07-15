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

async function signUp(page, email) {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("FitStakeTest45!");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible({ timeout: 15_000 });
}

test("creator publishes and another account joins a real challenge", async ({ browser }) => {
  const suffix = Date.now();
  const title = `Firebase QA ${suffix}`;
  const creatorContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const creator = await creatorContext.newPage();
  const joiner = await joinerContext.newPage();

  await prepare(creator, "QA Creator");
  await signUp(creator, `fitstake.creator.${suffix}@example.com`);
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
  await signUp(joiner, `fitstake.joiner.${suffix}@example.com`);
  await joiner.getByRole("button", { name: "Challenges", exact: true }).click();
  const remoteCard = joiner.getByRole("button", { name: new RegExp(title) }).first();
  await expect(remoteCard).toBeVisible({ timeout: 15_000 });
  await remoteCard.click();
  await joiner.getByRole("button", { name: /Join for/ }).first().click();
  await joiner.getByRole("button", { name: /Join for/ }).last().click();
  await expect(joiner.getByRole("button", { name: "Leave challenge" })).toBeVisible({ timeout: 15_000 });

  await creator.reload();
  await creator.getByRole("button", { name: "Challenges", exact: true }).click();
  await creator.getByRole("button", { name: new RegExp(title) }).first().click();
  await expect(creator.getByText("QA Joiner", { exact: true })).toBeVisible({ timeout: 15_000 });

  await creatorContext.close();
  await joinerContext.close();
});
