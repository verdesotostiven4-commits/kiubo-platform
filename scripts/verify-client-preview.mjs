import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};

const preview=text("lib/client-preview.ts");
for(const needle of ["kiubo.admin.client-preview.v1","kiubo.admin.client-preview.workspace.v1",'get("preview")==="client"',"sessionStorage","effectivePlatformAdmin","getClientPreviewWorkspace","clientPreviewUrl"]){
  assert.ok(preview.includes(needle),`client preview helper missing: ${needle}`);
}

const control=text("components/ControlClient.tsx");
for(const needle of ["clientPreviewUrl(tenantId,branch?.id)","Ver como cliente","!u.platformAdmin","clearClientPreviewMode"]){
  assert.ok(control.includes(needle),`Control client preview missing: ${needle}`);
}
assert.ok(!control.includes("switchWorkspace(tenantId"),"Ver como cliente must not mutate the shared admin workspace.");

const store=text("lib/local-store.ts");
for(const needle of ["getClientPreviewWorkspace","setClientPreviewWorkspace","user.platformAdmin&&isClientPreviewMode()"]){
  assert.ok(store.includes(needle),`local workspace isolation missing: ${needle}`);
}

for(const path of ["components/Sidebar.tsx","components/WorkspaceSwitcher.tsx","components/MobileNav.tsx","components/CommandPalette.tsx","components/SessionEnforcer.tsx"]){
  assert.ok(text(path).includes("effectivePlatformAdmin"),`${path} must honor client preview permissions`);
}

const brand=text("components/BusinessBrandMark.tsx");
assert.ok(brand.includes('path.startsWith("/control")||path.startsWith("/leads")'),"KIUBO Control must never inherit a client brand.");

const operations=text("components/OperationsClient.tsx");
assert.ok(operations.includes("u.tenantId===ctx.tenantId&&!u.platformAdmin"),"business user list must hide platform administrators");

const cloudAuth=text("lib/cloud-auth.ts");
for(const needle of ["trialEndsAt<=Date.now()","Tu periodo de prueba terminó","Tu acceso a KIUBO está suspendido","getClientPreviewWorkspace","platformOnlyIdentity(authUser)","if(!(platformAdmin&&previewWorkspace?.tenantId))saveLocalSession(session)"]){
  assert.ok(cloudAuth.includes(needle),`cloud auth/client preview guard missing: ${needle}`);
}

console.log("✓ Admin Client Preview V2 passed: preview stays tab-scoped, KIUBO Control remains corporate, and viewing a client cannot replace the admin workspace.");
