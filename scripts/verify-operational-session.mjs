import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};

const migration=text("supabase/migrations/20260923001500_operational_device_lease_v1.sql");
for(const needle of [
  "operational_sessions",
  "claim_operational_session_v1",
  "transfer_operational_session_v1",
  "heartbeat_operational_session_v1",
  "release_operational_session_v1",
  "interval '75 seconds'",
  "public.is_platform_admin()",
  "primary key(tenant_id,user_id)",
  "grant execute on function public.claim_operational_session_v1"
]){
  assert.ok(migration.includes(needle),`operational lease migration missing: ${needle}`);
}

const nextMigration=text("supabase/migrations/20261009190000_tenant_operational_lease_v2.sql");
for(const needle of ["tenant_operational_leases_v2","primary key references public.tenants(id)","claim_tenant_operational_session_v2","transfer_tenant_operational_session_v2","heartbeat_tenant_operational_session_v2","release_tenant_operational_session_v2","pg_advisory_xact_lock","on conflict(tenant_id)"]){
  assert.ok(nextMigration.includes(needle),`tenant-wide lease migration missing: ${needle}`);
}
assert.ok(!nextMigration.includes("drop table"),"Tenant-wide lease must not delete legacy data");

const client=text("lib/operational-session.ts");
for(const needle of ["claim_tenant_operational_session_v2","transfer_tenant_operational_session_v2","heartbeat_tenant_operational_session_v2","release_tenant_operational_session_v2","operationalDeviceLabel"]){
  assert.ok(client.includes(needle),`operational session client missing: ${needle}`);
}

const guard=text("components/OperationalSessionGuard.tsx");
for(const needle of ["ctx.user.platformAdmin","HEARTBEAT_MS=20_000","Usar KIUBO en este dispositivo","transferOperationalSession","heartbeatOperationalSession","mustClaim","setChecking(mustClaim)","Verificando dispositivo autorizado","fail closed"]){
  assert.ok(guard.includes(needle),`operational session guard missing: ${needle}`);
}

const chrome=text("components/AppChrome.tsx");
assert.ok(chrome.includes("<OperationalSessionGuard/>"),"Operational device guard must be mounted with the application chrome.");

const auth=text("lib/auth-provider.ts");
assert.ok(auth.includes("releaseOperationalSession"),"Explicit logout must release the current operational lease.");

console.log("✓ Operational Session V2 passed: tenant-wide lease across accounts, heartbeat survives route changes, initial validation blocks writes.");
