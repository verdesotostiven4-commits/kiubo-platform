import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"method not allowed"},405);
  const authHeader=req.headers.get("Authorization")||"";
  if(!authHeader.startsWith("Bearer "))return reply({error:"authentication required"},401);

  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const userResult=await caller.auth.getUser();
  if(userResult.error||!userResult.data.user)return reply({error:"invalid session"},401);
  const privilege=await caller.rpc("is_platform_admin");
  if(privilege.error||!privilege.data)return reply({error:"platform admin required"},403);

  let body:{businessName?:string;slug?:string;plan?:string;ownerName?:string;ownerEmail?:string};
  try{body=await req.json()}catch{return reply({error:"invalid json"},400)}
  const businessName=String(body.businessName||"").trim(),slug=String(body.slug||"").trim().toLowerCase(),ownerName=String(body.ownerName||"").trim(),ownerEmail=String(body.ownerEmail||"").trim().toLowerCase(),plan=String(body.plan||"start").toLowerCase();
  if(!businessName||!ownerName||!/^\S+@\S+\.\S+$/.test(ownerEmail))return reply({error:"businessName, ownerName and ownerEmail are required"},400);
  if(!/^[a-z0-9][a-z0-9-]{2,62}$/.test(slug))return reply({error:"invalid slug"},400);
  if(!["start","pro","custom"].includes(plan))return reply({error:"invalid plan"},400);

  const redirectTo=Deno.env.get("KIUBO_APP_URL")?`${Deno.env.get("KIUBO_APP_URL")!.replace(/\/$/,"")}/login`:undefined;
  const invited=await admin.auth.admin.inviteUserByEmail(ownerEmail,{data:{full_name:ownerName},redirectTo});
  if(invited.error||!invited.data.user)return reply({error:invited.error?.message||"could not invite owner"},409);

  const provision=await caller.rpc("platform_provision_tenant",{p_owner_user:invited.data.user.id,p_display_name:businessName,p_slug:slug,p_plan_code:plan});
  if(provision.error){await admin.auth.admin.deleteUser(invited.data.user.id).catch(()=>undefined);return reply({error:provision.error.message},400)}
  const row=Array.isArray(provision.data)?provision.data[0]:provision.data;
  return reply({ok:true,tenantId:row?.tenant_id,branchId:row?.branch_id,ownerUserId:invited.data.user.id,invitedEmail:ownerEmail});
});
