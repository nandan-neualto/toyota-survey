import { resolve } from "node:path";
process.env.NODE_ENV = "production";
process.env.HOSTNAME = process.env.HOST || "0.0.0.0";
process.env.PORT ||= "3000";
if ((process.env.STAFF_ACCESS_KEY || "").length < 16) throw new Error("Set STAFF_ACCESS_KEY to a random secret of at least 16 characters.");
if (process.env.RENDER && !process.env.DATABASE_URL && !process.env.DATABASE_PATH) throw new Error("Set DATABASE_URL to the Render Postgres connection string.");
process.env.DATABASE_PATH = resolve(process.env.DATABASE_PATH || ".render-data/feedback.sqlite");
await import("../.next-render/standalone/server.js");
