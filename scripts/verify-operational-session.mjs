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

const client=text("lib/operational-session.ts");
for(const needle of ["claim_operational_session_v1","transfer_operational_session_v1","heartbeat_operational_session_v1","release_operational_session_v1","operationalDeviceLabel"]){
  assert.ok(client.includes(needle),`operational session client missing: ${needle}`);
}

const guard=text("components/OperationalSessionGuard.tsx");
for(const needle of ["ctx.user.platformAdmin","HEARTBEAT_MS=20_000","Usar KIUBO en este dispositivo","transferOperationalSession","heartbeatOperationalSession","tolerancia offline"]){
  assert.ok(guard.includes(needle),`operational session guard missing: ${needle}`);
}

const chrome=text("components/AppChrome.tsx");
assert.ok(chrome.includes("<OperationalSessionGuard/>"),"Operational device guard must be mounted with the application chrome.");

const auth=text("lib/auth-provider.ts");
assert.ok(auth.includes("releaseOperationalSession"),"Explicit logout must release the current operational lease.");

console.log("✓ Operational Session V1 passed: customer logins use one active operational device, explicit takeover is supported, and platform-admin preview is bypassed.");
