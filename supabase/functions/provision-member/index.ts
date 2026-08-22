import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const appUrl=(Deno.env.get("KIUBO_APP_URL")||"").replace(/\/$/,"");
const allowedOrigin=appUrl?new URL(appUrl).origin:"*";
const cors={"Content-Type":"application/json","Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"method not allowed"},405);

  const authHeader=req.headers.get("Authorization")||"";
  if(!authHeader.startsWith("Bearer "))return reply({error:"authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)return reply({error:"server configuration incomplete"},503);

  const caller=createClient(url,anon,{global:{headers:{Authorization:authHeader}}});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await caller.auth.getUser();
  if(auth.error||!auth.data.user)return reply({error:"invalid session"},401);

  let body:{tenantId?:string;email?:string;name?:string;role?:string;branchIds?:string[]};
  try{body=await req.json()}catch{return reply({error:"invalid json"},400)}

  const tenantId=String(body.tenantId||"");
  const email=String(body.email||"").trim().toLowerCase();
  const name=String(body.name||"").trim();
  const role=String(body.role||"cashier");
  if(!UUID_RE.test(tenantId)||!/^\S+@\S+\.\S+$/.test(email)||!name)return reply({error:"tenantId, email and name are required"},400);
  if(!["owner","admin","cashier","inventory","viewer","accounting"].includes(role))return reply({error:"invalid role"},400);

  const allowedRole=await caller.rpc("can_assign_tenant_role",{p_tenant:tenantId,p_role:role});
  if(allowedRole.error||!allowedRole.data)return reply({error:"role assignment not allowed"},403);

  const rawBranchIds=Array.isArray(body.branchIds)?body.branchIds.map(String):[];
  if(rawBranchIds.length>50)return reply({error:"too many branches"},400);
  if(rawBranchIds.some(id=>!UUID_RE.test(id)))return reply({error:"invalid branch id"},400);
  const branchIds=[...new Set(rawBranchIds)];
  if(branchIds.length){
    const branches=await caller.from("branches").select("id").eq("tenant_id",tenantId).in("id",branchIds);
    if(branches.error)return reply({error:branches.error.message},400);
    const found=new Set((branches.data||[]).map(row=>String(row.id)));
    if(branchIds.some(id=>!found.has(id)))return reply({error:"one or more branches do not belong to this tenant"},400);
  }

  const redirectTo=appUrl?`${appUrl}/login`:undefined;
  const invited=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:name},redirectTo});
  if(invited.error||!invited.data.user)return reply({error:invited.error?.message||"could not invite user"},409);

  const userId=invited.data.user.id;
  const cleanupUser=async()=>{await admin.auth.admin.deleteUser(userId).catch(()=>undefined)};
  const member=await caller.from("tenant_members").insert({tenant_id:tenantId,user_id:userId,role,active:true}).select("id").single();
  if(member.error){await cleanupUser();return reply({error:member.error.message},400)}

  if(branchIds.length){
    const rows=branchIds.map(branch_id=>({tenant_member_id:member.data.id,branch_id}));
    const links=await caller.from("tenant_member_branches").insert(rows);
    if(links.error){
      await caller.from("tenant_members").delete().eq("id",member.data.id);
      await cleanupUser();
      return reply({error:links.error.message},400);
    }
  }

  return reply({ok:true,userId,memberId:member.data.id,email});
});
