import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqliteDatabase } from "../lib/sqlite-database.ts";

test("feedback survives a restart, deduplicates retries, and preserves Unicode", async () => {
  const dir = mkdtempSync(join(tmpdir(), "toyota-storage-"));
  let db = createSqliteDatabase(join(dir, "feedback.sqlite"));
  try {
    const insert = db.prepare("INSERT INTO feedback VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING");
    const japanese = JSON.stringify({ language: "ja", comment: "素晴らしい体験" });
    const kannada = JSON.stringify({ language: "kn", comment: "ಉತ್ತಮ ಅನುಭವ" });
    await insert.bind("a", "2026-09-29", "2026-09-29", "test", 5, japanese).run();
    await insert.bind("a", "2026-09-29", "2026-09-29", "test", 1, "duplicate").run();
    await insert.bind("b", "2026-09-29", "2026-09-29", "test", 4, kannada).run();
    db.close(); db = createSqliteDatabase(join(dir, "feedback.sqlite"));
    const rows = await db.prepare("SELECT data FROM feedback ORDER BY id").all();
    assert.deepEqual(rows.results.map(r => r.data), [japanese, kannada]);
    assert.equal(await db.prepare("SELECT data FROM feedback WHERE id=?").bind("missing").first(), null);
    assert.equal(await db.prepare("SELECT data FROM feedback WHERE id=?").bind("' OR 1=1 --").first(), null);
  } finally { db.close(); rmSync(dir, { recursive: true }); }
});

test("rate limits increment atomically and bindings remain independent", async () => {
  const db = createSqliteDatabase(":memory:");
  try {
    const statement = db.prepare("INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count");
    const results = await Promise.all(Array.from({ length: 12 }, () => statement.bind("visitor", 1000).first()));
    assert.deepEqual(results.map(r => r.count), Array.from({ length: 12 }, (_, i) => i + 1));
    assert.equal((await statement.bind("other", 1000).first()).count, 1);
    await db.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(1001).run();
    assert.deepEqual((await db.prepare("SELECT * FROM rate_limits").all()).results, []);
  } finally { db.close(); }
});
