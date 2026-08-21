import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getPrimaryBranch, loadLocalDatabase, saveLocalDatabase, saveLocalSession,
  type BranchRecord, type LocalSession, type Plan, type TenantRecord, type UserRecord, type UserRole
} from "./local-store";

const planMap:Record<string,Plan>={start:"Start",pro:"Pro",custom:"Custom",internal:"Internal"};
function localRole(role:string):UserRole{return role==="owner"||role==="admin"||role==="cashier"||role==="inventory"||role==="viewer"?role:"viewer"}

function upsertById<T extends {id:string}>(items:T[],record:T){const index=items.findIndex(item=>item.id===record.id);if(index>=0)items[index]=record;else items.push(record)}

export async function hydrateCloudIdentity(client:SupabaseClient,authUser:User){
  const adminResult=await client.rpc("is_platform_admin");
  const platformAdmin=Boolean(adminResult.data)&&!adminResult.error;
  const memberResult=await client.from("tenant_members").select("id,tenant_id,role,active").eq("user_id",authUser.id).eq("active",true).limit(1).maybeSingle();
  if(memberResult.error)throw new Error(memberResult.error.message);
  let tenantId=String(memberResult.data?.tenant_id||"");

  if(!tenantId&&platformAdmin){
    const firstTenant=await client.from("tenants").select("id").neq("status","cancelled").limit(1).maybeSingle();
    if(firstTenant.error)throw new Error(firstTenant.error.message);
    tenantId=String(firstTenant.data?.id||"");
  }
  if(!tenantId)throw new Error("Tu usuario todavía no está vinculado a un negocio KIUBO");

  const [tenantResult,branchResult,subscriptionResult]=await Promise.all([
    client.from("tenants").select("id,display_name,status,created_at").eq("id",tenantId).single(),
    client.from("branches").select("id,tenant_id,name,code,active,created_at").eq("tenant_id",tenantId).eq("active",true).order("code"),
    client.from("subscriptions").select("plan_code,status,trial_ends_at,current_period_ends_at").eq("tenant_id",tenantId).in("status",["trial","active","grace","suspended"]).limit(1).maybeSingle()
  ]);
  if(tenantResult.error)throw new Error(tenantResult.error.message);
  if(branchResult.error)throw new Error(branchResult.error.message);
  if(subscriptionResult.error)throw new Error(subscriptionResult.error.message);

  const cloudTenant=tenantResult.data,subscription=subscriptionResult.data;
  const tenant:TenantRecord={
    id:cloudTenant.id,name:cloudTenant.display_name,plan:planMap[String(subscription?.plan_code||"start")]||"Start",
    status:cloudTenant.status,users:1,branches:branchResult.data.length,
    expiresAt:String(subscription?.trial_ends_at||subscription?.current_period_ends_at||"Cloud"),catalog:["pro","custom","internal"].includes(String(subscription?.plan_code||"start")),
    invoice:false,createdAt:cloudTenant.created_at
  };
  const branches:BranchRecord[]=branchResult.data.map(branch=>({id:branch.id,tenantId:branch.tenant_id,name:branch.name,code:branch.code,active:branch.active,createdAt:branch.created_at}));
  const role=localRole(String(memberResult.data?.role||"owner"));
  const user:UserRecord={
    id:authUser.id,tenantId,name:String(authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email?.split("@")[0]||"Usuario KIUBO"),
    email:String(authUser.email||""),role,active:true,pin:"",platformAdmin,createdAt:String(authUser.created_at||new Date().toISOString())
  };

  const db=loadLocalDatabase();
  upsertById(db.tenants,tenant);
  for(const branch of branches)upsertById(db.branches,branch);
  upsertById(db.users,user);
  const primary=branches[0]??getPrimaryBranch(db,tenantId);
  saveLocalDatabase(db,{trackChanges:false});
  const session:LocalSession={userId:user.id,tenantId,activeTenantId:tenantId,activeBranchId:primary?.id,role:user.role,startedAt:new Date().toISOString()};
  saveLocalSession(session);
  return{user,session};
}
