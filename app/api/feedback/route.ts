import { feedbackSchema } from "@/lib/survey";
import { database, json, rateLimit, sameOrigin } from "@/lib/server";
export async function POST(req: Request) {
  if(!sameOrigin(req)) return json({error:"Invalid origin"},403);
  if(!req.headers.get("content-type")?.includes("application/json")) return json({error:"Expected JSON"},415);
  try {
    const text = await req.text(); if(text.length>10000) return json({error:"Response too large"},413);
    let input; try {input = JSON.parse(text);} catch {return json({error:"Invalid JSON"},400);}
    const parsed = feedbackSchema.safeParse(input); if(!parsed.success) return json({error:"Please check your survey answers."},400);
    if(!await rateLimit(req,"feedback",120,60)) return json({error:"Please retry shortly"},429);
    const data = parsed.data;
    await database().prepare("INSERT INTO feedback (id,created_at,received_at,kiosk_id,overall,data) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(data.id,data.createdAt,new Date().toISOString(),data.kioskId,data.overall,JSON.stringify(data)).run();
    return json({saved:true,id:data.id});
  } catch(error) {console.error("Feedback save failed",error);return json({error:"Feedback service unavailable. Keep the response on this device and retry."},503);}
}
