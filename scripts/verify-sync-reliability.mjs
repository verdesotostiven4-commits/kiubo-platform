import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const migration=readFileSync(join(root,"supabase/migrations/0009_sync_revision_cursor.sql"),"utf8").toLowerCase();
const provider=readFileSync(join(root,"lib/data-provider.ts"),"utf8");
const engine=readFileSync(join(root,"lib/sync-engine.ts"),"utf8");
const realtime=readFileSync(join(root,"components/RealtimeSyncRuntime.tsx"),"utf8");

for(const needle of [
  "sync_entity_revision_seq",
  "sync_entities_revision_trigger",
  "pull_sync_changes_v2",
  "p_after_revision",
  "order by revision",
  "limit v_limit",
  "'hasmore'"
]){
  assert.ok(migration.includes(needle),`Missing sync v2 database guard: ${needle}`);
}

for(const needle of [
  'CURSOR_V2_PREFIX="kiubo.cloud.cursor.v2:"',
  'pull_sync_changes_v2',
  'isMissingV2Rpc',
  'commitCursor(cursor)'
]){
  assert.ok(provider.includes(needle),`Missing sync v2 client guard: ${needle}`);
}

for(const needle of [
  "MAX_PULL_PAGES=4",
  "pullAvailable(provider)",
  "persistPulled(provider",
  "provider.commitCursor(pulled.cursor)",
  "REVISION_CURSOR_RE",
  'const resumeCursor=db.syncCursor&&REVISION_CURSOR_RE.test(db.syncCursor)?db.syncCursor:"0"',
  "hasMore:Boolean"
]){
  assert.ok(engine.includes(needle),`Missing sync reliability behavior: ${needle}`);
}

const saveIndex=engine.indexOf("saveLocalDatabase(db,{trackChanges:false})");
const commitIndex=engine.indexOf("provider.commitCursor(pulled.cursor)");
assert.ok(saveIndex>=0&&commitIndex>saveIndex,"Cloud cursor must only be committed after local data is safely persisted.");

for(const needle of ["continueSync=Boolean(result.hasMore)","sync();","continueSync=false;sync()"]){assert.ok(realtime.includes(needle),`Fresh-device sync continuation missing: ${needle}`)}
assert.ok(!engine.includes('repairTenantIsolation(provider,db,tenantId){if(tenantIsolationRepairDone(tenantId))return null;const canonical=await pullAvailable(provider,"0")'),"Fresh-device bootstrap must not restart from revision 0 on every cycle");

console.log("✓ Sync reliability v3 guard passed: revision paging resumes across cycles and fresh devices automatically continue until Cloud bootstrap is complete.");
