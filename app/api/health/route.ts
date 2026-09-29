import { database, json, staffKey } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (staffKey().length < 16) return json({ ok: false }, 503);
    await database().prepare("SELECT 1 AS ready FROM feedback LIMIT 1").first();
    return json({ ok: true });
  } catch { return json({ ok: false }, 503); }
}
