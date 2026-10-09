import assert from "node:assert/strict";
import{readFileSync}from"node:fs";
import ts from"typescript";

const code=path=>readFileSync(path,"utf8");
const YUKI="8e2d0299-5680-4eec-8c57-e37fe29086aa";
const session=code("lib/operational-session.ts");
const guard=code("components/OperationalSessionGuard.tsx");
const engine=code("lib/sync-engine.ts");
const migration=code("supabase/migrations/20261009220000_yuki_exclusive_write_gate_v3.sql");
assert.ok(!session.includes('if(!client)return{granted:true,bypassed:true}'),"Cloud validator must NEVER grant the POS when not connected");
assert.ok(session.includes('if(!client)throw new Error'),"No Cloud client must fail closed");
assert.ok(guard.includes("await new Promise(resolve=>window.setTimeout(resolve,700))"),"Short transient errors get a retry");
assert.ok(guard.includes('window.addEventListener("online",onOnline)'),"Restore session automatically when Internet returns");
assert.ok(guard.includes('kiubo:operational-session-blocked'),"Lost Cloud lease must immediately warn POS");
assert.ok(guard.includes("setConflict(offline)"),"Unknown device state must remain blocked");
assert.ok(engine.includes('const lease=await heartbeatOperationalSession(activeTenantId,getLocalDeviceId())'),"Must confirm Cloud lease before sending queued writes");
assert.ok(engine.includes('failed:0,pulled:0,message:"Este equipo perdió el control'),"Revoked-device queue cannot be marked sent or failed");
assert.ok(engine.includes("No se pudo confirmar la caja autorizada"),"Offline writes must remain pending");
assert.ok(engine.includes("deviceId:getLocalDeviceId()"),"Newly queued writes require a device identity before Cloud push");
assert.ok(engine.includes("return{...sanitized,deviceId:getLocalDeviceId()}"),"Device ID must be transport only");
assert.ok(migration.includes("for share"),"Cloud lease row must be locked while committing sale");
assert.ok(migration.includes("public.kiubo_assert_yuki_device_batch_v3(p_operations)"),"All writers must check the lease");
assert.ok(migration.includes("v_lease.user_id<>v_user or v_lease.device_id<>v_device"),"Different account/device must not push");
for(const procedure of ["apply_sync_operations","apply_sale_transactions_v2","apply_finance_transactions_v2","apply_sale_reversals_v1","apply_purchase_transactions_v3","apply_inventory_adjustments_v2"]){
 assert.ok(migration.includes("'"+procedure+"'"),"Missing write guard "+procedure);
}
const beginChanges=(migration.match(/drop table|truncate table|delete from public.sync_entities/ig)||[]);
assert.deepEqual(beginChanges,[],"Write gate migration is additive and never deletes YUKI data");

const body=engine.match(/^function safeOperation\(item:SyncQueueRecord\)[\s\S]*?^}/m)?.[0];
assert.ok(body,"Must test actual operation serialization");
const transformed=ts.transpileModule(body+"\nmodule.exports=safeOperation;",{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const m={exports:{}};
new Function("module","exports","getLocalDeviceId",transformed)(m,m.exports,()=>"device-one");
const safe=m.exports;
const sample={operationId:"sale-keep-stable-1",entityType:"saleTransactions",tenantId:YUKI,branchId:"main",status:"pending",payload:{pin:"SECRET_DO_NOT_SEND",sale:{id:"s1",total:12}}};
const encoded=safe(sample);
assert.equal(encoded.operationId,sample.operationId,"Idempotency ID must be stable on resync/retry");
assert.equal(encoded.deviceId,"device-one","YUKI Cloud write is tied to the currently authorized register");
assert.equal(encoded.payload.pin,undefined,"Private local fields must not be sent");
assert.equal(sample.payload.pin,"SECRET_DO_NOT_SEND","Original durable queue must not be mutated");
const other=safe({...sample,tenantId:"different-tenant"});
assert.equal(other.deviceId,undefined,"Other tenant must keep unchanged operation protocol");
console.log("✓ YUKI Cloud write safety: no bypass, retry, takeover block, queue preserved, device identity, SQL serialized batch");

const load=()=>{
 const j=ts.transpileModule(session,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function("module","exports","require",j)(mod,mod.exports,()=>({getSupabaseBrowserClient:()=>null}));
 return mod.exports;
};
await assert.rejects(()=>load().claimOperationalSession(YUKI,"device-one"),/Cloud no está disponible/);
console.log("✓ Missing Supabase client cannot grant a fake session");
