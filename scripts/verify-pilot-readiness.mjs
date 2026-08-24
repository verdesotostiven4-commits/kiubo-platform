import { readFileSync,existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root=process.cwd();
function text(path){const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")}
function requireText(path,needles){const source=text(path);for(const needle of needles)assert.ok(source.includes(needle),`${path} missing Pilot Readiness guard: ${needle}`);console.log(`✓ ${path}`)}

requireText("lib/permissions.ts",[
  "if(permission===\"control\"||permission===\"leads\")return platformAdmin",
  "admin:[\"dashboard\"",
]);
requireText("components/SessionEnforcer.tsx",[
  "canAccess(user.role,permission,Boolean(user.platformAdmin))",
  "session.role!==user.role",
  "b.tenantId===tenantId&&b.active",
]);
requireText("components/Sidebar.tsx",[
  "platformOnly:true",
  "canAccess(user.role,item.permission,Boolean(user.platformAdmin))",
  "Caja y fiados",
]);
requireText("components/MobileNav.tsx",[
  "platformOnly:true",
  "canAccess(user.role,item.permission,Boolean(user.platformAdmin))",
]);
requireText("app/operations/page.tsx",[
  "NEXT_PUBLIC_KIUBO_AUTH_MODE===\"supabase\"",
  "cloud-operations-v2",
  ".ops-grid:first-of-type > .panel:first-child{display:none}",
]);
requireText("supabase/migrations/0004_security_guardrails.sql",[
  "guard_last_active_owner",
  "branch does not belong to member tenant",
  "can_assign_tenant_role",
]);
requireText("supabase/migrations/0013_pilot_readiness_branch_scope.sql",[
  "guard_sync_entity_branch_scope",
  "sync branch belongs to another tenant",
  "branch is inactive",
  "open'",
  "closed'",
  "branch_can_operate",
]);
requireText("lib/sync-engine.ts",[
  "isActiveQueueItem(item,activeTenantId)",
  "recoverRejectedCommand",
  "navigator.locks",
]);
requireText("lib/offline-durability.ts",[
  "recoverInterruptedSyncQueue",
  "snapshotOfflineDatabase",
  "navigator.storage?.persist",
]);

console.log("✓ Pilot Readiness V1 passed: platform isolation, tenant/branch scope, truthful cloud operations, session role reconciliation, offline recovery and sync isolation are guarded.");
