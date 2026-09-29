import { authorised, database, json } from "@/lib/server";
export async function GET(req: Request) {
  if(!await authorised(req)) return json({error:"Staff sign-in required"},401);
  try {
    const u=new URL(req.url); const offset=Math.max(0,Number(u.searchParams.get("offset"))||0);
    const from=u.searchParams.get("from")||"0000", to=u.searchParams.get("to")||"9999";
    if(!Number.isSafeInteger(offset) || offset>1000000) return json({error:"Invalid page"},400);
    const rows=await database().prepare("SELECT data,received_at FROM feedback WHERE created_at >= ? AND created_at <= ? ORDER BY received_at DESC,id DESC LIMIT 501 OFFSET ?").bind(from,to,offset).all<{data:string;received_at:string}>();
    return json({rows:rows.results.slice(0,500).map(r=>({...JSON.parse(r.data),receivedAt:r.received_at})),more:rows.results.length>500,nextOffset:offset+500});
  }catch(error){console.error("Staff results unavailable",error);return json({error:"Couldn’t load feedback. Please try again."},503);}
}
