import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")??"{}") as Record<string,string>;
const SECRET=secrets.default||legacy;
if(!SUPABASE_URL||!SECRET)throw new Error("Missing runtime configuration");
const db=createClient(SUPABASE_URL,SECRET,{auth:{persistSession:false,autoRefreshToken:false}});

type Json=Record<string,unknown>;
const slugify=(v:unknown)=>{const s=String(v??"").toLowerCase();return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)?s:""};
const uuid=(v:unknown)=>{const s=String(v??"");return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:""};
const clean=(v:unknown,max=800)=>String(v??"").trim().slice(0,max);
function cors(req:Request){const origin=req.headers.get("origin")||"";const allowed=origin==="https://hakuna-matata-catalogo.vercel.app"||origin==="https://kiubo-catalogos-master.vercel.app"||/^https:\/\/(?:hakuna-matata-catalogo|kiubo-catalogos-master)-[a-z0-9-]+\.vercel\.app$/.test(origin)||/^http:\/\/localhost(?::\d+)?$/.test(origin);const h=new Headers({"content-type":"application/json; charset=utf-8","cache-control":"no-store","vary":"Origin","access-control-allow-headers":"authorization, content-type, x-provider-session","access-control-allow-methods":"POST, OPTIONS","access-control-max-age":"86400"});if(allowed)h.set("access-control-allow-origin",origin);return h}
function out(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function route(slug:string){const {data,error}=await db.from("catalog_accounts").select("id,slug,name,logo_url").eq("slug",slug).maybeSingle();if(error)throw error;return data}
async function providerAccount(req:Request,accountId:string){const token=clean(req.headers.get("x-provider-session"),180);if(token.length<32)return false;const hash=await sha256(token);const {data:session}=await db.from("catalog_provider_sessions").select("id,account_id,session_version,expires_at,revoked_at").eq("token_hash",hash).eq("account_id",accountId).maybeSingle();if(!session||session.revoked_at||new Date(session.expires_at).getTime()<=Date.now())return false;const {data:account}=await db.from("catalog_accounts").select("session_version").eq("id",accountId).maybeSingle();return !!account&&Number(account.session_version)===Number(session.session_version)}
function internal(req:Request){const auth=req.headers.get("authorization")||"";return auth===`Bearer ${SECRET}`}
async function config(accountId:string){const {data,error}=await db.from("catalog_push_config").select("vapid_public_key,vapid_private_key,subject").eq("account_id",accountId).maybeSingle();if(error)throw error;return data}
async function sendRows(accountId:string,rows:any[],payload:Json){const cfg=await config(accountId);if(!cfg||!rows.length)return{sent:0,failed:0};webpush.setVapidDetails(cfg.subject,cfg.vapid_public_key,cfg.vapid_private_key);let sent=0,failed=0;await Promise.all(rows.map(async row=>{try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload),{TTL:300,urgency:"high"});sent++}catch(error:any){failed++;const code=Number(error?.statusCode||0);if(code===404||code===410)await db.from("catalog_push_subscriptions").update({active:false,updated_at:new Date().toISOString()}).eq("id",row.id)}}));return{sent,failed}}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
 if(req.method!=="POST")return out(req,{error:"method_not_allowed"},405);
 try{
  const body=await req.json() as Json;const slug=slugify(body.slug||"hakuna-matata");if(!slug)return out(req,{error:"invalid_slug"},400);const account=await route(slug);if(!account)return out(req,{error:"account_not_found"},404);const action=String(body.action||"");
  if(action==="public_key"){const cfg=await config(account.id);return out(req,{public_key:cfg?.vapid_public_key||null});}
  if(action==="subscribe"){
   const sub=(body.subscription&&typeof body.subscription==="object"?body.subscription:{}) as Json;const keys=(sub.keys&&typeof sub.keys==="object"?sub.keys:{}) as Json;const endpoint=clean(sub.endpoint,1800),p256dh=clean(keys.p256dh,300),auth=clean(keys.auth,200),audience=String(body.audience||"customer");if(!endpoint||!p256dh||!auth||!["customer","provider"].includes(audience))return out(req,{error:"invalid_subscription"},400);if(audience==="provider"&&!(await providerAccount(req,account.id)))return out(req,{error:"session_expired"},401);const orderToken=uuid(body.order_public_token)||null;const {data,error}=await db.from("catalog_push_subscriptions").upsert({account_id:account.id,audience,order_public_token:orderToken,endpoint,p256dh,auth,user_agent:clean(req.headers.get("user-agent"),500)||null,active:true,updated_at:new Date().toISOString()},{onConflict:"account_id,endpoint"}).select("id").single();if(error)throw error;return out(req,{ok:true,subscription_id:data.id});
  }
  if(action==="bind_order"){
   const sid=uuid(body.subscription_id),token=uuid(body.order_public_token);if(!sid||!token)return out(req,{error:"invalid_request"},400);const {data:order}=await db.from("catalog_orders").select("id").eq("account_id",account.id).eq("public_token",token).maybeSingle();if(!order)return out(req,{error:"order_not_found"},404);const {error}=await db.from("catalog_push_subscriptions").update({order_public_token:token,active:true,updated_at:new Date().toISOString()}).eq("id",sid).eq("account_id",account.id).eq("audience","customer");if(error)throw error;return out(req,{ok:true});
  }
  if(action==="unsubscribe"){
   const endpoint=clean(body.endpoint,1800);if(endpoint)await db.from("catalog_push_subscriptions").update({active:false,updated_at:new Date().toISOString()}).eq("account_id",account.id).eq("endpoint",endpoint);return out(req,{ok:true});
  }
  if(!internal(req))return out(req,{error:"forbidden"},403);
  if(action==="notify_provider"){
   const orderId=uuid(body.order_id);if(!orderId)return out(req,{error:"invalid_order"},400);const {data:order}=await db.from("catalog_orders").select("id,order_number,customer_business,customer_name,total").eq("id",orderId).eq("account_id",account.id).maybeSingle();if(!order)return out(req,{error:"order_not_found"},404);const {data:rows}=await db.from("catalog_push_subscriptions").select("id,endpoint,p256dh,auth").eq("account_id",account.id).eq("audience","provider").eq("active",true);const result=await sendRows(account.id,rows||[],{title:"Nuevo pedido en Hakuna",body:`${order.customer_business||order.customer_name||"Cliente"} · ${order.order_number} · $${Number(order.total||0).toFixed(2)}`,tag:`hakuna-new-${order.id}`,url:"/panel"});return out(req,{ok:true,...result});
  }
  if(action==="notify_customer"){
   const orderId=uuid(body.order_id);if(!orderId)return out(req,{error:"invalid_order"},400);const {data:order}=await db.from("catalog_orders").select("id,public_token,order_number,status").eq("id",orderId).eq("account_id",account.id).maybeSingle();if(!order)return out(req,{error:"order_not_found"},404);const labels:Record<string,string>={new:"recibido",confirmed:"confirmado",preparing:"en preparación",dispatched:"despachado",delivered:"entregado",cancelled:"cancelado"};const {data:rows}=await db.from("catalog_push_subscriptions").select("id,endpoint,p256dh,auth").eq("account_id",account.id).eq("audience","customer").eq("order_public_token",order.public_token).eq("active",true);const result=await sendRows(account.id,rows||[],{title:`Pedido ${order.order_number}`,body:`Tu pedido está ${labels[order.status]||"actualizado"}.`,tag:`hakuna-${order.id}-${order.status}`,url:`/pedido?ref=${order.public_token}`});return out(req,{ok:true,...result});
  }
  return out(req,{error:"unknown_action"},400);
 }catch(error){console.error("catalog-notify",error);return out(req,{error:"notify_failed"},500)}
});
