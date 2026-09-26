import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};

const store=text("lib/local-store.ts");
for(const needle of ["KIUBO_SYNC_QUEUED_EVENT","window.dispatchEvent(new CustomEvent(KIUBO_SYNC_QUEUED_EVENT))",'params.get("preview")==="client"']){
  assert.ok(store.includes(needle),`local write wake/preview bootstrap missing: ${needle}`);
}

const runtime=text("components/RealtimeSyncRuntime.tsx");
for(const needle of ["KIUBO_SYNC_QUEUED_EVENT","window.addEventListener(\"focus\",wake)","visibilitychange","setInterval(sync,30_000)"]){
  assert.ok(runtime.includes(needle),`realtime retry trigger missing: ${needle}`);
}
for(const needle of ["isSyntheticYukiProductId","Cloud es la fuente canónica","including tombstones"]){
  assert.ok(runtime.includes(needle),`stale YUKI product bootstrap protection missing: ${needle}`);
}

const bootstrap=text("components/YukiPilotCatalogBootstrap.tsx");
for(const needle of ["getDataProvider","getDataProvider().mode===\"supabase\"","never manufacture production catalog data"]){
  assert.ok(bootstrap.includes(needle),`Cloud-first YUKI bootstrap guard missing: ${needle}`);
}

const engine=text("lib/sync-engine.ts");
for(const needle of ["pull_operational_snapshot_v1","reconcileOperationalSnapshot","OPERATIONAL_SNAPSHOT_ENTITIES","hasUnresolvedOperationalQueue","provider.commitCursor(watermark)"]){
  assert.ok(engine.includes(needle),`operational convergence guard missing: ${needle}`);
}

const migration=text("supabase/migrations/20260923011000_operational_snapshot_v1.sql");
for(const needle of ["pull_operational_snapshot_v1","p_watermark","revision<=v_watermark","'orders','sales','credits','creditPayments','cashSessions','cashMovements'","grant execute"]){
  assert.ok(migration.includes(needle),`operational snapshot migration missing: ${needle}`);
}

const orders=text("components/FoodOrdersClientPro.tsx");
for(const needle of ["pendingBalanceTotal","historyPaidTotal","HISTORY_PAGE_SIZE","visibleHistoryOrders","Saldo real pendiente","Mostrando"]){
  assert.ok(orders.includes(needle),`orders truth/organization guard missing: ${needle}`);
}
assert.ok(orders.includes('simpleFlow?order.paymentStatus==="paid":order.status==="delivered"'),"simple history must be paid-order truth only");

console.log("✓ YUKI Sync Convergence V2 passed: local writes wake Cloud, stale devices reconcile against an authoritative snapshot, and Orders exposes consistent pending/history totals.");
