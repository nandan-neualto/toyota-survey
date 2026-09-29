import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const feedback = sqliteTable("feedback", {
  id: text("id").primaryKey(), createdAt: text("created_at").notNull(), receivedAt: text("received_at").notNull(),
  kioskId: text("kiosk_id").notNull(), overall: integer("overall").notNull(), data: text("data").notNull(),
}, t => [index("feedback_received_idx").on(t.receivedAt)]);
export const rateLimits = sqliteTable("rate_limits", { key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull() });
