import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("fs.onboarded", "true");
    localStorage.setItem("fs.skippedAuth", "true");
    localStorage.setItem("fs.lang", JSON.stringify("en"));
  });
  await page.goto("/");
});

test("private challenge lands in Pending; solo and public start Active", async ({ page }) => {
  const statuses = await page.evaluate(async () => {
    const originalCreate = Sync.createChallenge;
    Sync.createChallenge = async () => true;
    const mk = async (access) => {
      ui.form = newCreateForm();
      ui.form.type = "streak"; ui.form.miss = "never"; ui.form.duration = 7;
      ui.form.access = access; ui.form.sel_pushups = true; ui.form.pushups = 50;
      ui.form.buyIn = 0; ui.form.minPlayers = 2;
      const ok = await saveChallengeForm();
      return ok ? C.status(app.challenges[0]) : "not-created";
    };
    try {
      return { solo: await mk("solo"), priv: await mk("private"), pub: await mk("public") };
    } finally {
      Sync.createChallenge = originalCreate;
    }
  });
  // Private ждёт, пока приглашённые подтвердят; solo и public стартуют сразу.
  expect(statuses).toEqual({ solo: "active", priv: "pending", pub: "active" });
});

test("public pending card shows Ready! and hides it once tapped", async ({ page }) => {
  await page.evaluate(() => {
    const c = newChallenge({
      id: "pub-test", title: "Pending Public", access: "public", isPublic: true, minPlayers: 3,
      goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 0, startAt: null, currentDay: 1,
      participants: [{ id: "me", name: "Me", isMe: true, state: "active", doneToday: false, todayReps: 0 }],
    });
    app.challenges.unshift(c);
    ui.tab = "challenges"; ui.challengeTab = "pending"; ui.detailId = null; ui.full = null; ui.sheet = null;
    render();
  });
  const readyBtn = page.getByRole("button", { name: "Ready!", exact: true });
  await expect(readyBtn).toBeVisible();
  await expect(page.getByText(/Gathered 1 \/ 3/)).toBeVisible();
  await readyBtn.click();
  await expect(page.getByRole("button", { name: "Ready!", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Waiting for everyone to gather/)).toBeVisible();
});

test("last ready participant activates public challenge immediately and publishes start", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const originalReady = Sync.setReady;
    const originalPublish = Sync.publishActivity;
    const events = [];
    Sync.setReady = async () => true;
    Sync.publishActivity = (event) => events.push(event);
    const c = newChallenge({
      id: "public-ready", title: "Everyone ready", access: "public", isPublic: true, minPlayers: 2,
      goals: [{ exercise: "pushups", repsPerDay: 50 }], durationDays: 7, buyIn: 0, startAt: null,
      participants: [
        { id: "other", name: "Other", isMe: false, state: "active", _ready: Date.now() - 1000 },
        { id: "me", name: "Me", isMe: true, state: "active", _ready: null },
      ],
    });
    app.challenges.unshift(c);
    try {
      await markReady(c.id);
      return { status: C.status(c), startIsToday: dateKey(c.startAt) === dateKey(), events };
    } finally {
      Sync.setReady = originalReady;
      Sync.publishActivity = originalPublish;
    }
  });
  expect(result.status).toBe("active");
  expect(result.startIsToday).toBe(true);
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ challengeId: "public-ready", type: "start" });
});

test("long automatic combo title is shortened before Firebase publish", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const originalCreate = Sync.createChallenge;
    let published = null;
    Sync.createChallenge = async (_id, meta) => { published = meta; return true; };
    ui.form = newCreateForm({
      type: "streak", miss: "never", access: "private", title: "",
      sel_pushups: false, sel_squats: false, sel_pullups: true, sel_dips: true,
      pullups: 50, dips: 50, duration: 3, buyIn: 0,
    });
    try {
      const ok = await saveChallengeForm();
      return { ok, title: published && published.title, goals: published && published.goals };
    } finally {
      Sync.createChallenge = originalCreate;
    }
  });
  expect(result.ok).toBe(true);
  expect(result.title).toBe("Pull-ups + Dips");
  expect(result.title.length).toBeLessThanOrEqual(40);
  expect(result.goals).toHaveLength(2);
});

test("public total goal publishes a valid miss policy", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const originalCreate = Sync.createChallenge;
    let published = null;
    Sync.createChallenge = async (_id, meta) => { published = meta; return true; };
    ui.form = newCreateForm({
      type: "goal", access: "public", title: "Qq", miss: null,
      sel_pushups: true, pushups: 50, duration: 3, buyIn: 50,
      limitParticipants: false,
    });
    try {
      const ok = await saveChallengeForm();
      return { ok, missPolicy: published && published.missPolicy };
    } finally {
      Sync.createChallenge = originalCreate;
    }
  });
  expect(result).toEqual({ ok: true, missPolicy: "never" });
});

test("challenge creator name is normalized to the Firebase limit", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const originalCreate = Sync.createChallenge;
    const originalName = store["profile.name"];
    let publishedName = null;
    Sync.createChallenge = async (_id, _meta, name) => { publishedName = name; return true; };
    store["profile.name"] = "A creator name longer than twenty characters";
    ui.form = newCreateForm({
      type: "streak", access: "public", title: "Name limit", miss: "never",
      sel_pushups: true, pushups: 20, duration: 3, buyIn: 0,
    });
    try {
      const ok = await saveChallengeForm();
      return { ok, publishedName };
    } finally {
      store["profile.name"] = originalName;
      Sync.createChallenge = originalCreate;
    }
  });
  expect(result).toEqual({ ok: true, publishedName: "A creator name longe" });
});
