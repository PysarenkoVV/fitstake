import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
  await page.evaluate(() => openBug());
  await expect.poll(() => page.locator(".bug-note").count()).toBe(1);
});

const send = (page) => page.getByRole("button", { name: "Send report", exact: true });

test("отправка открывается только после описания и категории", async ({ page }) => {
  await expect(send(page)).toBeDisabled();

  await page.locator(".bug-note").fill("не то");
  await expect(send(page)).toBeDisabled();

  await page.locator(".bug-note").fill("камера считает лишние повторы");
  await expect(send(page)).toBeDisabled(); // категория ещё не выбрана

  await page.getByRole("button", { name: /Counting & camera/ }).click();
  await expect(send(page)).toBeEnabled();
});

test("выбор категории и важности не пересобирает лист", async ({ page }) => {
  await page.locator(".bug-note").fill("после старта счёт замирает на нуле");
  const sheetBefore = await page.locator(".sheet").elementHandle();
  const noteBefore = await page.locator(".bug-note").elementHandle();

  await page.getByRole("button", { name: /Design & layout/ }).click();
  await page.getByRole("button", { name: "Critical", exact: true }).click();

  // Лист и поле ввода те же узлы — иначе на iOS закрылась бы клавиатура.
  expect(await sheetBefore.evaluate((node) => node.isConnected)).toBe(true);
  expect(await noteBefore.evaluate((node) => node.value)).toBe("после старта счёт замирает на нуле");
  await expect(page.getByRole("button", { name: /Design & layout/ })).toHaveClass(/sel/);
  await expect(page.getByRole("button", { name: "Critical", exact: true })).toHaveClass(/sel/);
  await expect(page.getByRole("button", { name: "Normal", exact: true })).not.toHaveClass(/sel/);
});

test("в отчёт уезжают текст, важность и автоконтекст", async ({ page }) => {
  await page.evaluate(() => {
    window.__bug = null;
    Sync.reportBug = async (payload, shot) => { window.__bug = { payload, shot }; return true; };
  });
  await page.locator(".bug-note").fill("челлендж пропал из списка после перезапуска");
  await page.getByRole("button", { name: /Challenges & money/ }).click();
  await page.getByRole("button", { name: "High", exact: true }).click();
  await send(page).click();

  await expect(page.getByText("Thanks! Report sent.", { exact: true })).toBeVisible();
  const sent = await page.evaluate(() => window.__bug);
  expect(sent.shot).toBe(null);
  expect(sent.payload).toMatchObject({
    category: "Challenges & money",
    note: "челлендж пропал из списка после перезапуска",
    severity: "high",
    screen: "tab-yours",
    lang: "en",
    hasShot: false,
  });
  expect(sent.payload.viewport).toMatch(/^\d+×\d+$/);
  expect(sent.payload.version).toMatch(/^v\d+$/);
});

test("скриншот прикрепляется, снимается и уходит отдельной картинкой", async ({ page }) => {
  await page.evaluate(() => {
    window.__bug = null;
    Sync.reportBug = async (payload, shot) => { window.__bug = { payload, shot }; return true; };
  });
  await page.locator(".bug-note").fill("текст налезает на кнопку внизу экрана");
  await page.getByRole("button", { name: /Design & layout/ }).click();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach a screenshot", exact: true }).click();
  (await chooserPromise).setFiles("icons/icon-512.png");
  await expect(page.locator(".bug-shot img")).toBeVisible();

  await page.getByRole("button", { name: "Remove screenshot", exact: true }).click();
  await expect(page.locator(".bug-shot")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Attach a screenshot", exact: true })).toBeVisible();

  const secondChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach a screenshot", exact: true }).click();
  (await secondChooser).setFiles("icons/icon-512.png");
  await expect(page.locator(".bug-shot img")).toBeVisible();
  await send(page).click();
  await expect(page.getByText("Thanks! Report sent.", { exact: true })).toBeVisible();

  const sent = await page.evaluate(() => window.__bug);
  expect(sent.payload.hasShot).toBe(true);
  expect(sent.shot).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.shot.length).toBeLessThanOrEqual(260000);
});
