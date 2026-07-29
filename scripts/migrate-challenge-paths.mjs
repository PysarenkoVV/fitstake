import { createSign } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const apply = process.argv.includes("--apply");
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

const database = "https://fitstake-2ccf4-default-rtdb.europe-west1.firebasedatabase.app";
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const sourceResponse = await fetch(`${database}/fitstake/challenges.json`, { headers });
if (!sourceResponse.ok) throw new Error(`Challenge download failed: ${sourceResponse.status}`);
const source = await sourceResponse.json() || {};
const [publicResponse, privateResponse] = await Promise.all([
  fetch(`${database}/fitstake/publicChallenges.json`, { headers }),
  fetch(`${database}/fitstake/privateChallenges.json`, { headers }),
]);
if (!publicResponse.ok || !privateResponse.ok) {
  throw new Error(`Destination check failed: ${publicResponse.status}/${privateResponse.status}`);
}
const existingPublic = await publicResponse.json() || {};
const existingPrivate = await privateResponse.json() || {};
const publicChallenges = {};
const privateChallenges = {};
const rejectionReasons = {};
const exercises = new Set(["pushups", "squats", "pullups", "dips"]);
const isIntegerIn = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
function challengeProblem(id, challenge) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return "invalid-id";
  const meta = challenge && challenge.meta;
  if (!meta || !["public", "private"].includes(meta.access)) return "unsupported-access";
  if (typeof meta.ownerId !== "string" || !meta.ownerId) return "invalid-owner";
  if (typeof meta.title !== "string" || !meta.title.length || meta.title.length > 40) return "invalid-title";
  if (!meta.goals || typeof meta.goals !== "object" || !Object.keys(meta.goals).length) return "invalid-goals";
  if (!isIntegerIn(meta.durationDays, 1, 365)) return "invalid-duration";
  if (typeof meta.buyIn !== "number" || meta.buyIn < 0 || meta.buyIn > 100000) return "invalid-buy-in";
  if (!["never", "oneTotal", "onePerTwoWeeks"].includes(meta.missPolicy)) return "invalid-miss-policy";
  if (typeof meta.createdAt !== "number") return "invalid-created-at";
  if (meta.startAt != null && typeof meta.startAt !== "number") return "invalid-start";
  if (meta.maxPlayers != null && !isIntegerIn(meta.maxPlayers, 0, 500)) return "invalid-max-players";
  const participants = challenge.participants || {};
  if (meta.maxPlayers > 0 && Object.keys(participants).length > meta.maxPlayers) return "over-capacity";
  for (const participant of Object.values(participants)) {
    if (!participant || typeof participant.name !== "string" || !participant.name.length || participant.name.length > 20) return "invalid-participant-name";
    if (typeof participant.joinedAt !== "number") return "invalid-joined-at";
    if (participant.total != null && !isIntegerIn(participant.total, 0, 10000000)) return "invalid-total";
    if (participant.ready != null && typeof participant.ready !== "number") return "invalid-ready";
    if (participant.restartFrom != null && !/^\d{4}-\d{2}-\d{2}$/.test(participant.restartFrom)) return "invalid-restart";
    for (const [date, perExercise] of Object.entries(participant.days || {})) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !perExercise || typeof perExercise !== "object") return "invalid-day";
      for (const [exercise, reps] of Object.entries(perExercise)) {
        if (!exercises.has(exercise) || !isIntegerIn(reps, 0, 5000)) return "invalid-reps";
      }
    }
  }
  return null;
}

for (const [id, challenge] of Object.entries(source)) {
  const problem = challengeProblem(id, challenge);
  if (problem) {
    rejectionReasons[problem] = (rejectionReasons[problem] || 0) + 1;
    continue;
  }
  if (challenge.meta.access === "private") privateChallenges[id] = challenge;
  else if (challenge.meta.access === "public") publicChallenges[id] = challenge;
}

const conflicts = [];
for (const [bucket, incoming, existing] of [
  ["public", publicChallenges, existingPublic],
  ["private", privateChallenges, existingPrivate],
]) {
  for (const [id, challenge] of Object.entries(incoming)) {
    if (existing[id] && JSON.stringify(existing[id]) !== JSON.stringify(challenge)) {
      conflicts.push(`${bucket}:${id}`);
    }
  }
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  publicCount: Object.keys(publicChallenges).length,
  privateCount: Object.keys(privateChallenges).length,
  skippedCount: Object.keys(source).length - Object.keys(publicChallenges).length - Object.keys(privateChallenges).length,
  rejectionReasons,
  conflictCount: conflicts.length,
}, null, 2));

if (!apply) {
  console.log("Run with --apply to copy validated records. The legacy path is intentionally not deleted.");
  process.exit(0);
}
if (conflicts.length) {
  console.error(`Migration stopped: ${conflicts.length} destination record(s) already differ.`);
  process.exit(1);
}

const migrationResponse = await fetch(`${database}/fitstake.json`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    publicChallenges: Object.assign({}, existingPublic, publicChallenges),
    privateChallenges: Object.assign({}, existingPrivate, privateChallenges),
  }),
});
if (!migrationResponse.ok) throw new Error(`Challenge migration failed: ${migrationResponse.status}`);
console.log("Challenge records copied. Verify the new paths before deploying rules or removing legacy data.");
