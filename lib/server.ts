import { env } from "cloudflare:workers";
export function database() { if (!env.DB) throw new Error("Feedback database is unavailable"); return env.DB; }
export function staffKey() { return (env as unknown as { STAFF_ACCESS_KEY?: string }).STAFF_ACCESS_KEY || process.env.STAFF_ACCESS_KEY || ""; }
function publicOrigin(req: Request) {
  return new URL(process.env.RENDER_EXTERNAL_URL || req.url).origin;
}
export function sameOrigin(req: Request) { const origin = req.headers.get("origin"); return !!origin && origin === publicOrigin(req); }
export function json(value: unknown, status = 200, extra: Record<string,string> = {}) { return Response.json(value, {status, headers: {"Cache-Control":"no-store", "X-Content-Type-Options":"nosniff", ...extra}}); }
const encoder = new TextEncoder();
async function signature(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(staffKey()), {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(value)))].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function matches(a: string, b: string) {
  const [x,y] = await Promise.all([crypto.subtle.digest("SHA-256",encoder.encode(a)),crypto.subtle.digest("SHA-256",encoder.encode(b))]);
  const one = new Uint8Array(x), two = new Uint8Array(y); let diff = 0;
  for(let i=0;i<one.length;i++) diff |= one[i]^two[i]; return diff === 0;
}
export async function sessionToken() { const value = `${Date.now()+15*60*1000}:${crypto.randomUUID()}`; return `${value}.${await signature(value)}`; }
export async function authorised(req: Request) {
  if(staffKey().length < 16) return false;
  const token = req.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith("toyota_staff="))?.slice(13);
  if(!token) return false;
  const [value,sig] = token.split("."); const expires = Number(value?.split(":")[0]);
  if(!Number.isFinite(expires) || expires < Date.now() || expires > Date.now()+16*60*1000 || !sig) return false;
  return matches(sig, await signature(value));
}
export function sessionCookie(req: Request, token: string, maxAge = 900) { return `toyota_staff=${token}; HttpOnly; SameSite=Strict; Path=/api/staff; Max-Age=${maxAge}${publicOrigin(req).startsWith("https:") ? "; Secure" : ""}`; }
export async function rateLimit(req: Request, scope: string, max: number, windowSeconds: number) {
  const now = Math.floor(Date.now()/1000), bucket = Math.floor(now/windowSeconds);
  const address = process.env.RENDER
    ? req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown"
    : req.headers.get("cf-connecting-ip") || "local";
  const key = `${scope}:${address}:${bucket}`;
  const row = await database().prepare("INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").bind(key,(bucket+1)*windowSeconds).first<{count:number}>();
  if (Math.random()<.02) await database().prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now).run();
  return (row?.count ?? max+1) <= max;
}
