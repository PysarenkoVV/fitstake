import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const statePath = resolve(root, ".bug-report-state.json");
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || readdirSync(root).map((name) => resolve(root, name))
    .find((path) => path.includes("-firebase-adminsdk-") && path.endsWith(".json"));

if (!keyPath || !existsSync(keyPath)) {
  console.error("Firebase Admin key not found.");
  process.exit(1);
}

const key = JSON.parse(readFileSync(keyPath, "utf8"));
const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
  iss: key.client_email,
  sub: key.client_email,
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
  scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
})}`;
const signer = createSign("RSA-SHA256");
signer.update(unsigned);
const assertion = `${unsigned}.${signer.sign(key.private_key, "base64url")}`;

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  }),
});
if (!tokenResponse.ok) throw new Error(`Firebase authorization failed: ${tokenResponse.status}`);
const { access_token: token } = await tokenResponse.json();

const DB = "https://fitstake-2ccf4-default-rtdb.europe-west1.firebasedatabase.app";
const auth = { headers: { authorization: `Bearer ${token}` } };

const reportsResponse = await fetch(`${DB}/fitstake/bugReports.json`, auth);
if (!reportsResponse.ok) throw new Error(`Bug report download failed: ${reportsResponse.status}`);

const reports = await reportsResponse.json() || {};
const previous = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { seen: [] };
const seen = new Set(previous.seen || []);
const fresh = Object.entries(reports)
  .filter(([id]) => !seen.has(id))
  .map(([id, report]) => ({ id, ...report }))
  .sort((a, b) => (a.ts || 0) - (b.ts || 0));

// Скриншоты лежат отдельным узлом bugShots/{id} и весят сотни килобайт —
// в консоль их не печатаем, а сохраняем файлами и отдаём пути.
const shotsDir = resolve(root, ".bug-shots");
for (const report of fresh) {
  if (!report.hasShot) continue;
  try {
    const res = await fetch(`${DB}/fitstake/bugShots/${report.id}.json`, auth);
    const dataUrl = res.ok ? await res.json() : null;
    const base64 = typeof dataUrl === "string" ? dataUrl.split(",")[1] : null;
    if (!base64) continue;
    if (!existsSync(shotsDir)) mkdirSync(shotsDir);
    const file = resolve(shotsDir, `${report.id}.jpg`);
    writeFileSync(file, Buffer.from(base64, "base64"));
    report.shotFile = file;
  } catch {}
}

writeFileSync(statePath, JSON.stringify({
  seen: Object.keys(reports),
  checkedAt: Date.now(),
}, null, 2));

console.log(JSON.stringify({
  total: Object.keys(reports).length,
  newCount: fresh.length,
  newReports: fresh,
}, null, 2));
