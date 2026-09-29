import { createSqliteDatabase } from "./sqlite-database";
import { createPostgresDatabase } from "./postgres-database";
let database: ReturnType<typeof createSqliteDatabase> | ReturnType<typeof createPostgresDatabase> | undefined;
export const env = {
  get DB() {
    if (database) return database;
    if (process.env.DATABASE_URL) return database = createPostgresDatabase(process.env.DATABASE_URL);
    if (process.env.DATABASE_PATH) return database = createSqliteDatabase(process.env.DATABASE_PATH);
    throw new Error("DATABASE_URL is required for the Render database.");
  },
  get STAFF_ACCESS_KEY() { return process.env.STAFF_ACCESS_KEY || ""; },
};
