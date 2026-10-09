import assert from "node:assert/strict";
import{readFileSync}from"node:fs";
import ts from"typescript";

const read=path=>readFileSync(path,"utf8");
const sql=read("supabase/migrations/20261009190000_tenant_operational_lease_v2.sql");
const teamSql=read("supabase/migrations/20261009191000_activate_team_cloud_v1.sql");
for(const needle of [
  "tenant_operational_leases_v2","tenant_id uuid primary key",
  "pg_advisory_xact_lock","on conflict(tenant_id)",
  "claim_tenant_operational_session_v2","transfer_tenant_operational_session_v2",
  "heartbeat_tenant_operational_session_v2","release_tenant_operational_session_v2",
  "public.has_tenant_access","public.tenant_can_operate",
  "from public,anon,authenticated"
])assert.ok(sql.includes(needle),"Tenant exclusive lease must include "+needle);
assert.ok(!/drop table|truncate table|delete from public.sync_entities/i.test(sql),"Device lease migration may not wipe business data");
assert.ok(!sql.includes("primary key(tenant_id,user_id)"),"Tenant-wide lease must not be per user");
for(const name of ["list_tenant_team_v1","tenant_invite_preflight_v1","upsert_tenant_member_by_email_v1","update_tenant_member_v1",
"can_manage_tenant_users","can_assign_tenant_role","revoke all"]){
 assert.ok(teamSql.includes(name),"Team Cloud migration missing "+name);
}
const guard=read("components/OperationalSessionGuard.tsx");
for(const needle of ["setChecking(mustClaim)","HEARTBEAT_MS=20_000","window.setInterval","tenantId","ctx.user.id","Verificando dispositivo autorizado","transferOperationalSession","heartbeatOperationalSession","setConflict({granted:false,conflict:true,offline:true})"]){
 assert.ok(guard.includes(needle),"Exclusive-device UI must include "+needle);
}
assert.ok(!guard.includes("if(claimedKey.current===key){setChecking(false);return}"),
  "Route transition must never disable heartbeat");
assert.ok(!guard.includes("hasRecentOfflineLease"),"Offline browser cannot continue after an unknown remote takeover");

const role=read("lib/permissions.ts");
const mod={exports:{}};
const compiled=ts.transpileModule(role,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function("module","exports",compiled)(mod,mod.exports);
for(const p of ["pos","cash","customers"])assert.ok(mod.exports.canAccess("cashier",p));
for(const p of ["catalog","inventory","operations","branding","purchases","upgrade","invoices","reports","control"]){
 assert.ok(!mod.exports.canAccess("cashier",p),"Cashier must not have management permission: "+p);
}
assert.equal(mod.exports.homeForRole("cashier"),"/pos");

const pos=read("components/PosClientPro.tsx");
const cash=read("components/CashClient.tsx");
for(const needle of ["canAdjustSale&&!internalConsumption","canAdjustSale&&<div className=\"pos-adjustments\"",
"if(!canAdjustSale&&(","Solo un administrador puede registrar cortesías","Los descuentos requieren autorización"]){
 assert.ok(pos.includes(needle),"Cashier POS protection missing: "+needle);
}
assert.ok(!pos.includes("Los pedidos antiguos sin número de espacio siguen disponibles en Pedidos."));
assert.ok(cash.includes('ctx.user?.role!=="cashier"&&<form className="ops-form ops-form-3"'),
 "Cashier must not see manual cash adjustments");
assert.ok(cash.includes("Solo el administrador puede registrar movimientos manuales"));

const sessionTs=read("lib/operational-session.ts");
for(const name of ["claim_tenant_operational_session_v2","transfer_tenant_operational_session_v2",
"heartbeat_tenant_operational_session_v2","release_tenant_operational_session_v2"]){
 assert.ok(sessionTs.includes(name),"Browser RPC must use "+name);
}
const calls=[];
const client={rpc:async(name,args)=>{calls.push({name,args});return{data:{granted:true},error:null}}};
const sessionModule={exports:{}};
const js=ts.transpileModule(sessionTs,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function("require","module","exports",js)(name=>{
 if(name==="./supabase-browser")return{getSupabaseBrowserClient:()=>client};
 throw Error("Unexpected dependency: "+name);
},sessionModule,sessionModule.exports);
await sessionModule.exports.claimOperationalSession("tenant-1","device-1");
await sessionModule.exports.transferOperationalSession("tenant-1","device-2");
await sessionModule.exports.heartbeatOperationalSession("tenant-1","device-2");
await sessionModule.exports.releaseOperationalSession("tenant-1","device-2");
assert.deepEqual(calls.map(c=>c.name),[
 "claim_tenant_operational_session_v2",
 "transfer_tenant_operational_session_v2",
 "heartbeat_tenant_operational_session_v2",
 "release_tenant_operational_session_v2"
]);
assert.equal(calls[1].args.p_device_id,"device-2");
console.log("✓ YUKI exclusive tenant device, recovery, four Cloud RPCs, team invitations and least-privilege cashier guards");
