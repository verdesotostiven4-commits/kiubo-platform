import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient,isSupabaseConfigured } from "./supabase-browser";
import { loadLocalDatabase,makeId,saveLocalDatabase,type BranchRecord,type BusinessType,type KiuboLocalDatabase,type ServiceMode,type TenantRecord,type TenantStatus,type UserRecord,type UserRole } from "./local-store";
import type { CommercialPlan } from "./entitlements";
import { explainAuthEmailError } from "./auth-email";

const planMap:Record<string,CommercialPlan>={start:"Start",pro:"Pro",custom:"Custom"};
const roleMap=(role:string):UserRole=>role==="owner"||role==="admin"||role==="cashier"||role==="inventory"||role==="viewer"?role:"viewer";
const statusMap=(status:string):TenantStatus=>status==="active"||status==="grace"||status==="suspended"?status:"trial";
const KIUBO_SET_PASSWORD_URL="https://kiubo-platform.vercel.app/set-password";
export const isCloudControlMode=()=>process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase"&&isSupabaseConfigured();

export async function hydrateCloudControl():Promise<KiuboLocalDatabase>{
  const client=getSupabaseBrowserClient();if(!client)throw new Error("KIUBO Cloud no está configurado");
  const privilege=await client.rpc("is_platform_admin");if(privilege.error||!privilege.data)throw new Error("KIUBO Control requiere administrador de plataforma");
  const [tenantsResult,branchesResult,membersResult,subscriptionsResult,overridesResult]=await Promise.all([
    client.from("tenants").select("id,display_name,status,created_at").neq("status","cancelled").order("created_at"),
    client.from("branches").select("id,tenant_id,name,code,active,created_at").order("code"),
    client.from("tenant_members").select("id,tenant_id,user_id,role,active,created_at").eq("active",true),
    client.from("subscriptions").select("tenant_id,plan_code,status,trial_ends_at,current_period_ends_at").in("status",["trial","active","grace","suspended"]),
    client.from("tenant_feature_overrides").select("tenant_id,feature_key,enabled")
  ]);
  for(const result of [tenantsResult,branchesResult,membersResult,subscriptionsResult,overridesResult])if(result.error)throw new Error(result.error.message);
  const subscriptions=new Map((subscriptionsResult.data||[]).map(row=>[String(row.tenant_id),row])),overrides=overridesResult.data||[],branchesByTenant=new Map<string,number>(),usersByTenant=new Map<string,number>();
  for(const branch of branchesResult.data||[])branchesByTenant.set(String(branch.tenant_id),(branchesByTenant.get(String(branch.tenant_id))||0)+(branch.active?1:0));
  for(const member of membersResult.data||[])usersByTenant.set(String(member.tenant_id),(usersByTenant.get(String(member.tenant_id))||0)+1);
  const cloudTenants:TenantRecord[]=(tenantsResult.data||[]).map(row=>{const subscription=subscriptions.get(String(row.id));const plan=planMap[String(subscription?.plan_code||"start")]||"Start";const feature=(key:string,defaultValue:boolean)=>{const item=overrides.find(value=>String(value.tenant_id)===String(row.id)&&value.feature_key===key);return item?Boolean(item.enabled):defaultValue};return{id:String(row.id),name:String(row.display_name),plan,status:statusMap(String(row.status)),users:usersByTenant.get(String(row.id))||0,branches:branchesByTenant.get(String(row.id))||0,expiresAt:String(subscription?.trial_ends_at||subscription?.current_period_ends_at||"Cloud"),catalog:feature("catalog",plan!=="Start"),invoice:feature("invoice",false),createdAt:String(row.created_at)}});
  const cloudBranches:BranchRecord[]=(branchesResult.data||[]).map(row=>({id:String(row.id),tenantId:String(row.tenant_id),name:String(row.name),code:String(row.code),active:Boolean(row.active),createdAt:String(row.created_at)}));
  const cloudUsers:UserRecord[]=(membersResult.data||[]).map(row=>({id:String(row.user_id),tenantId:String(row.tenant_id),name:`Usuario ${String(row.user_id).slice(0,8)}`,email:"",role:roleMap(String(row.role)),active:Boolean(row.active),pin:"",platformAdmin:false,createdAt:String(row.created_at)}));
  const db=loadLocalDatabase(),cloudIds=new Set(cloudTenants.map(t=>t.id));
  db.tenants=[...db.tenants.filter(t=>t.plan==="Internal"),...cloudTenants];db.branches=[...db.branches.filter(b=>!cloudIds.has(b.tenantId)&&db.tenants.some(t=>t.id===b.tenantId&&t.plan==="Internal")),...cloudBranches];db.users=[...db.users.filter(u=>u.platformAdmin),...cloudUsers.filter(u=>!db.users.some(existing=>existing.platformAdmin&&existing.id===u.id))];saveLocalDatabase(db,{trackChanges:false});return loadLocalDatabase();
}

async function prepareOwnerAccess(ownerEmail:string,ownerName:string,businessName:string){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error("Cloud no configurado");
  const isolated=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const result=await isolated.auth.signInWithOtp({email:ownerEmail,options:{shouldCreateUser:true,data:{full_name:ownerName,business_name:businessName,kiubo_role:"owner"},emailRedirectTo:KIUBO_SET_PASSWORD_URL}});
  if(result.error)throw new Error(explainAuthEmailError(result.error.message));
}

type BusinessProfileInput={businessType?:BusinessType;address?:string;phone?:string;serviceModes?:ServiceMode[];tableCount?:number;logoUrl?:string;primaryColor?:string;secondaryColor?:string;accentColor?:string;receiptFooter?:string};
async function configureBusinessProfile(tenantId:string,businessName:string,profile:BusinessProfileInput){
  const client=getSupabaseBrowserClient();if(!client)throw new Error("Cloud no configurado");
  const businessType=profile.businessType||"general",serviceModes=profile.serviceModes?.length?profile.serviceModes:[businessType==="food_service"?"table":"counter"],address=profile.address?.trim()||"",phone=profile.phone?.trim()||"",tableCount=Math.max(0,Math.min(500,Math.floor(profile.tableCount||0))),primaryColor=profile.primaryColor||"#0b5a42",secondaryColor=profile.secondaryColor||"#17352c",accentColor=profile.accentColor||"#f28b30",receiptFooter=profile.receiptFooter||"Gracias por tu compra";
  const rpc=await client.rpc("configure_business_profile_v1",{p_tenant:tenantId,p_trade_name:businessName,p_address:address,p_phone:phone,p_business_type:businessType,p_service_modes:serviceModes,p_table_count:tableCount,p_logo_url:profile.logoUrl||"",p_primary_color:primaryColor,p_secondary_color:secondaryColor,p_accent_color:accentColor,p_receipt_footer:receiptFooter});
  if(!rpc.error)return;
  const text=rpc.error.message.toLowerCase();
  if(!(text.includes("configure_business_profile_v1")&&(text.includes("could not find")||text.includes("does not exist")||text.includes("schema cache"))))throw new Error(rpc.error.message);
  // Compatibility path until migration 0020 is active: settings/branding were already valid generic sync entities.
  const now=new Date().toISOString(),settings={tenantId,tradeName:businessName,legalName:"",ruc:"",establishment:"001",emissionPoint:"001",currency:"USD",accent:primaryColor,receiptFooter,requireCashSession:true,allowCredit:true,address,phone,businessType,serviceModes,tableCount,showProductImages:true,splashEnabled:true,receiptWidth:"80mm"},branding={tenantId,businessName,logoUrl:profile.logoUrl||"",primaryColor,secondaryColor,accentColor,receiptTagline:receiptFooter,updatedAt:now};
  const operations=[{id:makeId("queue"),operationId:makeId("op"),tenantId,entityType:"settings",entityId:tenantId,action:"upsert",payload:settings,status:"pending",attempts:0,createdAt:now,updatedAt:now},{id:makeId("queue"),operationId:makeId("op"),tenantId,entityType:"branding",entityId:tenantId,action:"upsert",payload:branding,status:"pending",attempts:0,createdAt:now,updatedAt:now}];
  const fallback=await client.rpc("apply_sync_operations",{p_operations:operations});if(fallback.error)throw new Error(fallback.error.message);
}

export async function provisionCloudTenant(input:{businessName:string;ownerName:string;ownerEmail:string;plan:CommercialPlan}&BusinessProfileInput){
  const client=getSupabaseBrowserClient();if(!client)throw new Error("Cloud no configurado");
  const slug=input.businessName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55)+`-${Math.random().toString(36).slice(2,6)}`;
  await prepareOwnerAccess(input.ownerEmail,input.ownerName,input.businessName);
  const result=await client.rpc("platform_provision_tenant_by_email",{p_owner_email:input.ownerEmail,p_display_name:input.businessName,p_slug:slug,p_plan_code:input.plan.toLowerCase()});if(result.error)throw new Error(result.error.message);
  const row=Array.isArray(result.data)?result.data[0]:result.data;if(!row?.tenant_id||!row?.branch_id)throw new Error("KIUBO no confirmó la creación del negocio");
  await configureBusinessProfile(String(row.tenant_id),input.businessName,input);
  return{ok:true,tenantId:row.tenant_id,branchId:row.branch_id,invitedEmail:input.ownerEmail};
}
export async function setCloudTenantPlan(tenantId:string,plan:CommercialPlan){const client=getSupabaseBrowserClient();if(!client)throw new Error("Cloud no configurado");const result=await client.rpc("platform_set_tenant_plan",{p_tenant:tenantId,p_plan_code:plan.toLowerCase()});if(result.error)throw new Error(result.error.message)}
export async function setCloudTenantStatus(tenantId:string,status:TenantStatus){const client=getSupabaseBrowserClient();if(!client)throw new Error("Cloud no configurado");const result=await client.rpc("platform_set_tenant_status",{p_tenant:tenantId,p_status:status});if(result.error)throw new Error(result.error.message)}
export async function setCloudTenantFeature(tenantId:string,featureKey:string,enabled:boolean){const client=getSupabaseBrowserClient();if(!client)throw new Error("Cloud no configurado");const result=await client.from("tenant_feature_overrides").upsert({tenant_id:tenantId,feature_key:featureKey,enabled,limits:{},reason:"KIUBO Control"},{onConflict:"tenant_id,feature_key"});if(result.error)throw new Error(result.error.message)}
export async function addCloudBranch(tenantId:string,name:string,code:string){const client=getSupabaseBrowserClient();if(!client)throw new Error("Cloud no configurado");const result=await client.from("branches").insert({tenant_id:tenantId,name,code,active:true});if(result.error)throw new Error(result.error.message)}
