import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getPrimaryBranch, loadLocalDatabase, loadLocalSession, saveLocalDatabase, saveLocalSession,
  type BranchRecord, type KiuboLocalDatabase, type LocalSession, type Plan, type TenantRecord, type UserRecord, type UserRole
} from "./local-store";

const planMap:Record<string,Plan>={start:"Start",pro:"Pro",custom:"Custom",internal:"Internal"};
const CURSOR_PREFIXES=["kiubo.cloud.cursor.v1:","kiubo.cloud.cursor.v2:"] as const;
const DURABILITY_CACHE="kiubo-data-durability-v1";

function localRole(role:string):UserRole{return role==="owner"||role==="admin"||role==="cashier"||role==="inventory"||role==="viewer"?role:"viewer"}
function upsertById<T extends {id:string}>(items:T[],record:T){const index=items.findIndex(item=>item.id===record.id);if(index>=0)items[index]=record;else items.push(record)}
function sameStringSet(left:string[],right:string[]){if(left.length!==right.length)return false;const expected=new Set(left);return right.every(item=>expected.has(item))}
function clearTenantCursors(tenantId:string){
  if(typeof window==="undefined")return;
  for(const prefix of CURSOR_PREFIXES)window.localStorage.removeItem(`${prefix}${tenantId}`);
}
function clearDurabilityShadow(){
  if(typeof window==="undefined"||!("caches" in window))return;
  void window.caches.delete(DURABILITY_CACHE).catch(()=>undefined);
}

function purgeRevokedCloudData(
  db:KiuboLocalDatabase,
  input:{tenantId:string;authUserId:string;platformAdmin:boolean;allowedBranchIds:string[];previousBranchIds:string[];previousSession:LocalSession|null}
){
  const {tenantId,authUserId,platformAdmin,allowedBranchIds,previousBranchIds,previousSession}=input;
  const allowed=new Set(allowedBranchIds);
  const accountChanged=Boolean(previousSession?.userId&&previousSession.userId!==authUserId);
  const tenantChanged=Boolean(previousSession?.activeTenantId&&previousSession.activeTenantId!==tenantId&&!platformAdmin);
  const branchScopeChanged=!sameStringSet([...previousBranchIds].sort(),[...allowedBranchIds].sort());
  const branchAllowed=(record:{tenantId:string;branchId:string})=>record.tenantId!==tenantId||allowed.has(record.branchId);

  // Platform admins may intentionally keep multiple businesses cached for workspace switching.
  // Normal business users keep only their currently-authorized tenant on the device.
  if(!platformAdmin){
    db.tenants=db.tenants.filter(item=>item.id===tenantId);
    db.users=db.users.filter(item=>item.id===authUserId&&item.tenantId===tenantId);
    db.customers=db.customers.filter(item=>item.tenantId===tenantId);
    db.settings=db.settings.filter(item=>item.tenantId===tenantId);
    db.branding=db.branding.filter(item=>item.tenantId===tenantId);
    db.suppliers=db.suppliers.filter(item=>item.tenantId===tenantId);
  }

  db.branches=platformAdmin
    ? db.branches.filter(item=>item.tenantId!==tenantId||allowed.has(item.id))
    : db.branches.filter(item=>item.tenantId===tenantId&&allowed.has(item.id));

  db.tenantProducts=db.tenantProducts.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.sales=db.sales.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.orders=db.orders.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.cashSessions=db.cashSessions.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.cashMovements=db.cashMovements.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.credits=db.credits.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.creditPayments=db.creditPayments.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.purchases=db.purchases.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.supplierPayments=db.supplierPayments.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.stockMovements=db.stockMovements.filter(item=>branchAllowed(item)&&(!platformAdmin?item.tenantId===tenantId:true));
  db.syncQueue=db.syncQueue.filter(item=>{
    if(!platformAdmin&&item.tenantId!==tenantId)return false;
    return item.tenantId!==tenantId||!item.branchId||allowed.has(item.branchId);
  });
  db.auditLogs=db.auditLogs.filter(item=>{
    if(!platformAdmin&&item.tenantId!==tenantId)return false;
    return item.tenantId!==tenantId||!item.branchId||allowed.has(item.branchId);
  });

  if(accountChanged||tenantChanged||branchScopeChanged){
    db.syncCursor=undefined;
    clearTenantCursors(tenantId);
    clearDurabilityShadow();
  }
  return{accountChanged,tenantChanged,branchScopeChanged};
}

function platformOnlyIdentity(authUser:User){
  const db=loadLocalDatabase();
  const internal=db.tenants.find(t=>t.plan==="Internal")??db.tenants[0];
  if(!internal)throw new Error("No existe el espacio interno de KIUBO");
  const branch=getPrimaryBranch(db,internal.id);
  const user:UserRecord={id:authUser.id,tenantId:internal.id,name:String(authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email?.split("@")[0]||"Admin KIUBO"),email:String(authUser.email||""),role:"owner",active:true,pin:"",platformAdmin:true,createdAt:String(authUser.created_at||new Date().toISOString())};
  upsertById(db.users,user);
  saveLocalDatabase(db,{trackChanges:false});
  const session:LocalSession={userId:user.id,tenantId:internal.id,activeTenantId:internal.id,activeBranchId:branch?.id,role:user.role,startedAt:new Date().toISOString()};
  saveLocalSession(session);
  return{user,session};
}

export async function hydrateCloudIdentity(client:SupabaseClient,authUser:User){
  const adminResult=await client.rpc("is_platform_admin");
  const platformAdmin=Boolean(adminResult.data)&&!adminResult.error;
  const memberResult=await client.from("tenant_members").select("id,tenant_id,role,active").eq("user_id",authUser.id).eq("active",true).limit(1).maybeSingle();
  if(memberResult.error)throw new Error(memberResult.error.message);
  let tenantId=String(memberResult.data?.tenant_id||"");

  if(!tenantId&&platformAdmin){
    const preferred=loadLocalSession()?.activeTenantId;
    if(preferred){
      const preferredTenant=await client.from("tenants").select("id").eq("id",preferred).neq("status","cancelled").maybeSingle();
      if(!preferredTenant.error&&preferredTenant.data)tenantId=String(preferredTenant.data.id);
    }
    if(!tenantId){
      const firstTenant=await client.from("tenants").select("id").neq("status","cancelled").order("created_at").limit(1).maybeSingle();
      if(firstTenant.error)throw new Error(firstTenant.error.message);
      tenantId=String(firstTenant.data?.id||"");
    }
    if(!tenantId)return platformOnlyIdentity(authUser);
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
  if(!branchResult.data.length)throw new Error("Tu usuario no tiene una sucursal activa asignada en KIUBO");

  const cloudTenant=tenantResult.data,subscription=subscriptionResult.data;
  const trialEndsAt=subscription?.trial_ends_at?Date.parse(String(subscription.trial_ends_at)):NaN;
  if(!platformAdmin&&cloudTenant.status==="trial"&&subscription?.status==="trial"&&Number.isFinite(trialEndsAt)&&trialEndsAt<=Date.now())throw new Error("Tu periodo de prueba terminó. Contacta a KIUBO para activar tu cuenta.");
  if(!platformAdmin&&(cloudTenant.status==="suspended"||subscription?.status==="suspended"))throw new Error("Tu acceso a KIUBO está suspendido. Contacta a KIUBO para reactivarlo.");
  const tenant:TenantRecord={id:cloudTenant.id,name:cloudTenant.display_name,plan:planMap[String(subscription?.plan_code||"start")]||"Start",status:cloudTenant.status,users:1,branches:branchResult.data.length,expiresAt:String(subscription?.trial_ends_at||subscription?.current_period_ends_at||"Cloud"),catalog:["pro","custom","internal"].includes(String(subscription?.plan_code||"start")),invoice:false,createdAt:cloudTenant.created_at};
  const branches:BranchRecord[]=branchResult.data.map(branch=>({id:branch.id,tenantId:branch.tenant_id,name:branch.name,code:branch.code,active:branch.active,createdAt:branch.created_at}));
  const role=localRole(String(memberResult.data?.role||"owner"));
  const user:UserRecord={id:authUser.id,tenantId,name:String(authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email?.split("@")[0]||"Usuario KIUBO"),email:String(authUser.email||""),role,active:true,pin:"",platformAdmin,createdAt:String(authUser.created_at||new Date().toISOString())};

  const db=loadLocalDatabase(),previousSession=loadLocalSession();
  const previousBranchIds=db.branches.filter(branch=>branch.tenantId===tenantId&&branch.active).map(branch=>branch.id);
  upsertById(db.tenants,tenant);
  for(const branch of branches)upsertById(db.branches,branch);
  upsertById(db.users,user);
  purgeRevokedCloudData(db,{tenantId,authUserId:authUser.id,platformAdmin,allowedBranchIds:branches.map(branch=>branch.id),previousBranchIds,previousSession});

  const primary=branches.find(branch=>branch.id===previousSession?.activeBranchId)??branches[0]??getPrimaryBranch(db,tenantId);
  saveLocalDatabase(db,{trackChanges:false});
  const session:LocalSession={userId:user.id,tenantId,activeTenantId:tenantId,activeBranchId:primary?.id,role:user.role,startedAt:new Date().toISOString()};
  saveLocalSession(session);
  return{user,session};
}
