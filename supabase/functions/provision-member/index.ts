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
  const auth=await caller.auth.getUser();if(auth.error||!auth.data.user)return reply({error:"invalid session"},401);

  let body:{tenantId?:string;email?:string;name?:string;role?:string;branchIds?:string[]};try{body=await req.json()}catch{return reply({error:"invalid json"},400)}
  const tenantId=String(body.tenantId||""),email=String(body.email||"").trim().toLowerCase(),name=String(body.name||"").trim(),role=String(body.role||"cashier");
  if(!/^[0-9a-f-]{36}$/i.test(tenantId)||!/^\S+@\S+\.\S+$/.test(email)||!name)return reply({error:"tenantId, email and name are required"},400);
  if(!["owner","admin","cashier","inventory","viewer","accounting"].includes(role))return reply({error:"invalid role"},400);
  const allowed=await caller.rpc("can_manage_tenant_users",{p_tenant:tenantId});if(allowed.error||!allowed.data)return reply({error:"not allowed"},403);

  const redirectTo=Deno.env.get("KIUBO_APP_URL")?`${Deno.env.get("KIUBO_APP_URL")!.replace(/\/$/,"")}/login`:undefined;
  const invited=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:name},redirectTo});
  if(invited.error||!invited.data.user)return reply({error:invited.error?.message||"could not invite user"},409);
  const member=await caller.from("tenant_members").insert({tenant_id:tenantId,user_id:invited.data.user.id,role,active:true}).select("id").single();
  if(member.error){await admin.auth.admin.deleteUser(invited.data.user.id).catch(()=>undefined);return reply({error:member.error.message},400)}
  const branchIds=(Array.isArray(body.branchIds)?body.branchIds:[]).filter(id=>/^[0-9a-f-]{36}$/i.test(String(id)));
  if(branchIds.length){const rows=branchIds.map(branch_id=>({tenant_member_id:member.data.id,branch_id}));const links=await caller.from("tenant_member_branches").insert(rows);if(links.error)return reply({error:links.error.message},400)}
  return reply({ok:true,userId:invited.data.user.id,memberId:member.data.id,email});
});
