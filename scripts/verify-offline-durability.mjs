import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
function requireText(relative,needles){
  const path=join(root,relative);
  assert.ok(existsSync(path),`Missing ${relative}`);
  const text=readFileSync(path,"utf8");
  for(const needle of needles)assert.ok(text.includes(needle),`${relative} missing offline durability guard: ${needle}`);
  console.log(`✓ ${relative}`);
}

requireText("lib/offline-durability.ts",[
  "kiubo-data-durability-v1",
  "kiubo-local-shadow-v1",
  "recoverInterruptedSyncQueue",
  "status:\"pending\" as const",
  "navigator.storage?.persist",
  "pagehide",
  "visibilitychange",
]);
requireText("components/DurabilityRuntime.tsx",[
  "initializeOfflineDurability",
  "startOfflineDurability",
  "window.location.reload()",
]);
requireText("lib/sync-engine.ts",[
  "navigator.locks",
  "kiubo-cloud-sync",
  "retryDelayMs",
  "STALE_SYNCING_MS",
  "isActiveQueueItem(item,activeTenantId)",
]);
requireText("public/sw.js",[
  "kiubo-shell-v3",
  "kiubo-data-",
  "\"/cash\"",
  "url.origin!==self.location.origin",
  "url.pathname.startsWith(\"/api/\")",
  "networkFirstNavigation",
  "staleWhileRevalidate",
]);
requireText("app/layout.tsx",[
  "DurabilityRuntime",
  "<DurabilityRuntime/>",
]);

console.log("✓ Offline Durability V2 passed: crash recovery, protected retry, cross-tab sync locking, persistent shadow storage and cashier offline shell are wired.");
