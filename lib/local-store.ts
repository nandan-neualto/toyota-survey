import type { Feedback } from "./survey";
export type QueuedFeedback = Feedback & { syncedAt?: string };
export type KioskSettings = { name: string; idleSeconds: number };
let opening: Promise<IDBDatabase> | undefined;
function openDB() {
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("toyota-feedback-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("responses", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = undefined; reject(request.error); };
    request.onblocked = () => { opening = undefined; reject(new Error("Please close other kiosk windows and try again.")); };
  });
  return opening;
}
export async function saveFeedback(record: QueuedFeedback) {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("responses", "readwrite"); tx.objectStore("responses").put(record);
    tx.oncomplete = () => { window.dispatchEvent(new Event("feedback-change")); resolve(); };
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export async function readFeedback(): Promise<QueuedFeedback[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("responses").objectStore("responses").getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function feedbackReceipt(id: string): Promise<"queued" | "synced" | "missing"> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("responses").objectStore("responses").get(id);
    request.onsuccess = () => resolve(!request.result ? "missing" : request.result.syncedAt ? "synced" : "queued");
    request.onerror = () => reject(request.error);
  });
}
export function kioskId() {
  let id = localStorage.getItem("toyota-kiosk-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("toyota-kiosk-id", id); }
  return id;
}
export function getSettings(): KioskSettings {
  try { const data = JSON.parse(localStorage.getItem("toyota-settings") || "{}"); return { name: typeof data.name === "string" && data.name.trim() ? data.name.slice(0,60) : "Experience Centre · 01", idleSeconds: Number(data.idleSeconds) >= 60 && Number(data.idleSeconds) <= 600 ? Number(data.idleSeconds) : 120 }; }
  catch { return { name: "Experience Centre · 01", idleSeconds: 120 }; }
}
let syncing: Promise<{ pending: number; error?: string }> | null = null;
export async function syncFeedback(): Promise<{ pending: number; error?: string }> {
  if (syncing) return syncing;
  syncing = (async () => {
    const records = (await readFeedback()).filter(r => !r.syncedAt); let pending = records.length;
    if (!navigator.onLine) return { pending, error: "Offline. Feedback is safely queued on this device." };
    for (const record of records) {
      const { syncedAt: _synced, ...payload } = record;
      try {
        const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Sync unavailable. Saved feedback will retry automatically.");
        const result = await response.json() as { id?: string; saved?: boolean };
        if (result.id !== record.id || result.saved !== true) throw new Error("Server did not confirm receipt.");
        const syncedAt = new Date().toISOString();
        await saveFeedback({ ...record, syncedAt }); pending--;
        try { localStorage.setItem("toyota-last-sync", syncedAt); } catch { /* Receipt is already committed in IndexedDB. */ }
        window.dispatchEvent(new Event("feedback-sync"));
      } catch (e) { return { pending, error: e instanceof Error ? e.message : "Sync unavailable" }; }
    }
    return { pending };
  })().finally(() => { syncing = null; });
  return syncing;
}
