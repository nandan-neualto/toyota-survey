import type { Feedback } from "./survey";

export class StaffSessionExpired extends Error {}

export async function loadStaffFeedback(from: string, to: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<Feedback[]> {
  if (from && to && from > to) throw new Error("Choose an end date on or after the start date.");
  const rows: Feedback[] = [];
  let offset = 0;
  while (true) {
    signal.throwIfAborted();
    const query = new URLSearchParams({ offset: String(offset) });
    if (from) query.set("from", new Date(from + "T00:00:00").toISOString());
    if (to) query.set("to", new Date(to + "T23:59:59.999").toISOString());
    const response = await request("/api/staff/feedback?" + query, { signal });
    if (response.status === 401) throw new StaffSessionExpired("Your staff session expired. Please sign in again.");
    if (!response.ok) throw new Error("Couldn’t load feedback. Please try again.");
    const data = await response.json() as { rows?: Feedback[]; more?: boolean; nextOffset?: number };
    signal.throwIfAborted();
    if (!data || !Array.isArray(data.rows)) throw new Error("The feedback service returned an incomplete response. Please retry.");
    rows.push(...data.rows);
    if (!data.more) return rows;
    if (typeof data.nextOffset !== "number" || !Number.isSafeInteger(data.nextOffset) || data.nextOffset <= offset) throw new Error("Couldn’t load the next page of feedback. Please retry.");
    offset = data.nextOffset;
  }
}

export function feedbackCSV(rows: Feedback[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const fields = ["id", "createdAt", "kioskId", "kioskName", "surveyVersion", "language", "overall", "presentation", "informative", "highlights", "other", "recommendation", "comment"] as const;
  return '\uFEFF' + [fields.join(","), ...rows.map(row => fields.map(field => cell(Array.isArray(row[field]) ? (row[field] as string[]).join("; ") : row[field])).join(","))].join("\r\n");
}
