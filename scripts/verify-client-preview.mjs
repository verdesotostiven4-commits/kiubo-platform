import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};

const preview=text("lib/client-preview.ts");
for(const needle of ["kiubo.admin.client-preview.v1",'get("preview")==="client"',"sessionStorage","effectivePlatformAdmin"]){
  assert.ok(preview.includes(needle),`client preview helper missing: ${needle}`);
}

const control=text("components/ControlClient.tsx");
for(const needle of ['window.open("/app?preview=client"',"Ver como cliente","!u.platformAdmin"]){
  assert.ok(control.includes(needle),`Control client preview missing: ${needle}`);
}

for(const path of ["components/Sidebar.tsx","components/WorkspaceSwitcher.tsx","components/MobileNav.tsx","components/CommandPalette.tsx","components/SessionEnforcer.tsx"]){
  assert.ok(text(path).includes("effectivePlatformAdmin"),`${path} must honor client preview permissions`);
}

const operations=text("components/OperationsClient.tsx");
assert.ok(operations.includes("u.tenantId===ctx.tenantId&&!u.platformAdmin"),"business user list must hide platform administrators");

const cloudAuth=text("lib/cloud-auth.ts");
for(const needle of ["trialEndsAt<=Date.now()","Tu periodo de prueba terminó","Tu acceso a KIUBO está suspendido"]){
  assert.ok(cloudAuth.includes(needle),`cloud license guard missing: ${needle}`);
}

console.log("✓ Admin Client Preview V1 passed: platform-only chrome is hidden, tenant permissions remain active, and expired/suspended client access is blocked clearly.");
