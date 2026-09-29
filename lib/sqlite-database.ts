import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// The same prepared-statement interface used by the existing D1 route handlers.
// Each statement owns its bindings; concurrent requests never share parameters.
export function createSqliteDatabase(filename: string) {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const connection = new DatabaseSync(filename);
  connection.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
  connection.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, received_at TEXT NOT NULL,
      kiosk_id TEXT NOT NULL, overall INTEGER NOT NULL, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS feedback_received_idx ON feedback(received_at);
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
    );
  `);
  function prepare(sql: string, values: SQLInputValue[] = []) {
    return {
      bind(...parameters: SQLInputValue[]) { return prepare(sql, parameters); },
      async first<T>() { return (connection.prepare(sql).get(...values) as T | undefined) ?? null; },
      async all<T>() { return { results: connection.prepare(sql).all(...values) as T[] }; },
      async run() { const result = connection.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
    };
  }
  return { prepare, close: () => connection.close() };
}
