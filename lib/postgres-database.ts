import { Pool } from "pg";

export function createPostgresDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000 });
  let initialized: Promise<unknown> | undefined;
  async function ready() {
    initialized ||= pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, received_at TEXT NOT NULL,
        kiosk_id TEXT NOT NULL, overall INTEGER NOT NULL, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS feedback_received_idx ON feedback(received_at);
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
      );
    `).catch(error => { initialized = undefined; throw error; });
    await initialized;
  }
  function prepare(sql: string, values: unknown[] = []) {
    // SQL is application-owned; values remain separately bound parameters.
    let parameter = 0;
    const query = sql.replace(/\?/g, () => `$${++parameter}`)
      .replace("SET count=count+1", "SET count=rate_limits.count+1");
    async function execute() { await ready(); return pool.query(query, values); }
    return {
      bind(...parameters: unknown[]) { return prepare(sql, parameters); },
      async first<T>() { return ((await execute()).rows[0] as T | undefined) ?? null; },
      async all<T>() { return { results: (await execute()).rows as T[] }; },
      async run() { return { success: true, meta: { changes: (await execute()).rowCount ?? 0 } }; },
    };
  }
  return { prepare, close: () => pool.end() };
}
