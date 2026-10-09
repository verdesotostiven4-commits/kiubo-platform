import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const code=path=>readFileSync(path,"utf8");
const guard=code("components/OperationalSessionGuard.tsx");
const pos=code("components/PosClientPro.tsx");
const sync=code("lib/sync-engine.ts");
const session=code("lib/operational-session.ts");
const gate=code("supabase/migrations/20261009220000_yuki_exclusive_write_gate_v3.sql");
const yuki="8e2d0299-5680-4eec-8c57-e37fe29086aa";

for(const pattern of [
'window.addEventListener("offline",onOffline)',
'window.removeEventListener("offline",onOffline)',
'window.addEventListener("online",onOnline)',
'window.addEventListener("kiubo:operational-session-blocked",onLeaseBlocked)',
"Reconectando con KIUBO Cloud…",
"setConflict({granted:false,conflict:true,offline:true})"
])assert.ok(guard.includes(pattern),"Missing online-only UI guard: "+pattern);

assert.ok(pos.includes('const lease=await heartbeatOperationalSession(ctx.tenantId,getLocalDeviceId())'));
assert.ok(pos.includes('const checkout=async()=>{'));
assert.ok(pos.indexOf('const lease=await heartbeatOperationalSession(ctx.tenantId,getLocalDeviceId())') < pos.indexOf('if(balanceMode){registerPartialBalance();return}'),"Check lease before partial balance");
assert.ok(pos.indexOf('const lease=await heartbeatOperationalSession(ctx.tenantId,getLocalDeviceId())') < pos.indexOf('enqueueSaleTransaction(next,'),"Check lease before creating sale");
assert.ok(pos.includes('if(ctx.tenantId===\u0022'+yuki+'\u0022&&typeof navigator'),"Only YUKI needs Internet for open-order saving");
assert.ok(pos.includes("El cobro NO se registró"),"Explain that payments are not recorded if the session fails");
assert.ok(pos.includes('return null}if(!foodService||!cart.length)'),"No offline order autosave for YUKI");
assert.ok(!pos.includes("window.localStorage.clear()"),"Never clear local orders on reconnect");

assert.ok(sync.includes('const lease=await heartbeatOperationalSession(activeTenantId,getLocalDeviceId())'),"Queued operations must verify Cloud lease");
assert.ok(sync.includes('deviceId:getLocalDeviceId()'),"Pushes must identify the authorized terminal");
assert.ok(gate.includes('kiubo_assert_yuki_device_batch_v3'),"Server enforcement migration must be prepared");
assert.ok(gate.includes('for share'),"Atomic server gate must lock the lease");
assert.ok(gate.includes('md5(v_definition)'),"Gate must fail if Cloud functions drift");
assert.ok(!gate.includes('truncate table'),"No destructive reset");
assert.ok(session.includes('if(args.p_tenant===\u0022'+yuki+'\u0022)'),"Do not change policy for other KIUBO tenants");

const module={exports:{}};
const transpiled=ts.transpileModule(session,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
new Function("require","module","exports",transpiled)(
()=>({getSupabaseBrowserClient:()=>null}),module,module.exports
);
await assert.rejects(
()=>module.exports.heartbeatOperationalSession(yuki,"device-online-1"),
/Cloud no está disponible/,
"YUKI must not receive authorization without the network client"
);
const unrelated=await module.exports.heartbeatOperationalSession("another-tenant","device-online-1");
assert.equal(unrelated.bypassed,true,"Unrelated offline/demo tenants retain their prior behavior");
console.log("✓ YUKI online-only: immediate disconnect barrier, live checkout guard, offline order protection, Cloud queue safety, staged transactional gate and other-tenant isolation");
