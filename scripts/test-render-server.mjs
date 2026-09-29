import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const directory = mkdtempSync(join(tmpdir(), "toyota-render-qa-"));
const secret = randomBytes(32).toString("hex");
const base = "http://127.0.0.1:5191";
const origin = "https://toyota-survey-qa.onrender.com";
let child;
async function start() {
  let output = "";
  child = spawn(process.execPath, ["scripts/start-render.mjs"], {
    env: { ...process.env, PORT: "5191", HOST: "127.0.0.1", RENDER: "true", RENDER_EXTERNAL_URL: origin,
      STAFF_ACCESS_KEY: secret, DATABASE_PATH: join(directory, "feedback.sqlite") },
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", data => output += data);
  child.stderr.on("data", data => output += data);
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base + "/api/health")).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Server health check timed out: " + output);
}
async function stop() {
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
}
function post(path, body, extra = {}) {
  return fetch(base + path, { method: "POST", headers: { "content-type": "application/json", origin,
    "x-forwarded-for": "198.51.100.10", ...extra }, body: JSON.stringify(body) });
}
async function login() {
  const response = await post("/api/staff/session", { password: secret });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /; Secure/);
  return cookie.split(";")[0];
}
try {
  await start();
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(base + "/staff")).status, 200);
  assert.equal((await fetch(base + "/api/staff/feedback")).status, 401);
  assert.equal((await post("/api/staff/session", { password: secret }, { origin: "https://example.com" })).status, 403);
  assert.equal((await post("/api/staff/session", { password: "wrong" })).status, 401);
  const comments = { ja: "素晴らしい展示です", kn: "ಅದ್ಭುತ ಅನುಭವ" };
  for (const [language, comment] of Object.entries(comments)) {
    const feedback = { id: randomUUID(), kioskId: "render-qa", kioskName: "Deployment QA", surveyVersion: 1,
      language, comment, createdAt: new Date().toISOString(), overall: 5, presentation: 4, informative: 4,
      highlights: ["History & heritage"], other: "", recommendation: "yes" };
    assert.equal((await post("/api/feedback", feedback)).status, 200);
    assert.equal((await post("/api/feedback", feedback)).status, 200);
  }
  await stop();
  await start();
  const cookie = await login();
  const results = await fetch(base + "/api/staff/feedback", { headers: { cookie } });
  assert.equal(results.status, 200);
  const data = await results.json();
  assert.equal(data.rows.length, 2, "Retries must not create duplicate responses");
  for (const row of data.rows) assert.equal(row.comment, comments[row.language]);
  assert.equal((await fetch(base + "/api/staff/feedback", { headers: { cookie: cookie + "tampered" } })).status, 401);
  console.log("PASS: Render server health, pages, origin checks, staff authentication, secure cookie, Japanese/Kannada saves, retry deduplication, and persistence across restart.");
} finally {
  await stop();
  rmSync(directory, { recursive: true, force: true });
}
