import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { IDBDatabase } from "fake-indexeddb";
import { saveFeedback, readFeedback, feedbackReceipt, syncFeedback } from "../lib/local-store.ts";
import { loadStaffFeedback, StaffSessionExpired, feedbackCSV } from "../lib/staff-results.ts";

globalThis.window = new EventTarget();
let online = false;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { get onLine() { return online; } } });
globalThis.localStorage = { setItem() {} };
const record = (id = crypto.randomUUID()) => ({ id, createdAt: new Date().toISOString(), kioskId: "isolated-test", kioskName: "QA", surveyVersion: 1, language: "kn", overall: 5, presentation: 4, informative: 4, highlights: ["History & heritage"], other: "", recommendation: "yes", comment: "ಕನ್ನಡ 日本語" });
const reply = data => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });

test("offline storage, confirmed receipt, duplicate retries and storage failures", async () => {
  const row = record();
  let requests = 0, syncEvents = 0;
  window.addEventListener("feedback-sync", () => syncEvents++);
  globalThis.fetch = async () => { requests++; throw new Error("Disconnected"); };
  await saveFeedback(row);
  assert.equal(await feedbackReceipt(row.id), "queued");
  assert.equal(await feedbackReceipt("missing"), "missing");
  assert.equal((await syncFeedback()).pending, 1);
  assert.equal(requests, 0);
  online = true;
  assert.match((await syncFeedback()).error, /Disconnected/);
  assert.equal(await feedbackReceipt(row.id), "queued");
  globalThis.fetch = async () => reply({ id: "different-id", saved: true });
  assert.match((await syncFeedback()).error, /confirm receipt/);
  assert.equal(await feedbackReceipt(row.id), "queued");
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  const sent = [];
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); await waiting; return reply({ id: row.id, saved: true }); };
  localStorage.setItem = () => { throw new Error("Storage denied"); };
  const first = syncFeedback(), overlap = syncFeedback();
  release();
  assert.deepEqual(await first, { pending: 0 });
  assert.deepEqual(await overlap, { pending: 0 });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], row);
  assert.equal(await feedbackReceipt(row.id), "synced");
  assert.equal(syncEvents, 1);
  await syncFeedback();
  assert.equal(sent.length, 1, "confirmed responses must not be sent again");
  const transaction = IDBDatabase.prototype.transaction;
  try {
    IDBDatabase.prototype.transaction = () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); };
    await assert.rejects(saveFeedback(record()), /Quota exceeded/);
  } finally { IDBDatabase.prototype.transaction = transaction; }
  assert.equal((await readFeedback()).length, 1, "a failed local save must not create a completion record");
  const retry = record();
  await saveFeedback(retry);
  let attempts = 0;
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).id, retry.id);
    if (++attempts === 1) throw new Error("Receipt lost after server save");
    return reply({ id: retry.id, saved: true });
  };
  assert.equal((await syncFeedback()).pending, 1);
  assert.equal((await syncFeedback()).pending, 0);
  assert.equal((await readFeedback()).length, 2);
});

test("staff results publish only a complete current request", async () => {
  const a = record(), b = record();
  const urls = [];
  const result = await loadStaffFeedback("2026-09-01", "2026-09-30", new AbortController().signal, async url => {
    urls.push(url);
    return urls.length === 1 ? reply({ rows: [a], more: true, nextOffset: 1 }) : reply({ rows: [b], more: false });
  });
  assert.deepEqual(result, [a, b]);
  assert.match(urls[1], /offset=1/);
  assert.match(urls[0], /from=/);
  let page = 0;
  await assert.rejects(loadStaffFeedback("", "", new AbortController().signal, async () => ++page === 1 ? reply({ rows: [a], more: true, nextOffset: 1 }) : new Response("Unavailable", { status: 503 })), /load feedback/);
  const cancelled = new AbortController();
  await assert.rejects(loadStaffFeedback("", "", cancelled.signal, async () => { cancelled.abort(); return reply({ rows: [a], more: false }); }), { name: "AbortError" });
  await assert.rejects(loadStaffFeedback("2026-10-01", "2026-09-01", new AbortController().signal), /end date/);
  await assert.rejects(loadStaffFeedback("", "", new AbortController().signal, async () => new Response("", { status: 401 })), StaffSessionExpired);
  await assert.rejects(loadStaffFeedback("", "", new AbortController().signal, async () => reply({ rows: [], more: true, nextOffset: 0 })), /next page/);
});

test("CSV preserves Japanese and Kannada, quotes multiline text and neutralizes formulas", () => {
  const csv = feedbackCSV([{ ...record(), other: '=HYPERLINK("unsafe")', comment: '日本語, ಕನ್ನಡ\n"quoted"' }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('"日本語, ಕನ್ನಡ\n""quoted"""'));
  assert.ok(csv.includes('"\'=HYPERLINK(""unsafe"")"'));
});
