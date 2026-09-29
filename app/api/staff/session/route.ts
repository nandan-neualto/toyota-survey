import { authorised, json, matches, rateLimit, sameOrigin, sessionCookie, sessionToken, staffKey } from "@/lib/server";
export async function GET(req: Request) { return json({authorised:await authorised(req),configured:staffKey().length>=16}); }
export async function POST(req: Request) {
  if(!sameOrigin(req)) return json({error:"Invalid origin"},403);
  if(staffKey().length<16) return json({error:"Staff access needs to be configured by the kiosk administrator."},503);
  try {
    if(!await rateLimit(req,"staff-login",8,900)) return json({error:"Too many attempts. Please try again in 15 minutes."},429);
    const text=await req.text(); if(text.length>1024) return json({error:"Invalid access key"},400);
    let data; try{data=JSON.parse(text);}catch{return json({error:"Invalid request"},400);}
    if(typeof data.password!=="string" || !await matches(data.password,staffKey())) return json({error:"That access key isn’t correct."},401);
    return json({authorised:true},200,{"Set-Cookie":sessionCookie(req,await sessionToken())});
  }catch{ return json({error:"Staff access is temporarily unavailable."},503); }
}
export async function DELETE(req: Request) { if(!sameOrigin(req)) return json({error:"Invalid origin"},403); return json({authorised:false},200,{"Set-Cookie":sessionCookie(req,"",0)}); }
