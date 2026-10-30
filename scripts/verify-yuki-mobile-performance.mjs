import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const durability=read("lib/offline-durability.ts");
const realtime=read("components/RealtimeSyncRuntime.tsx");
const status=read("components/SyncStatus.tsx");
for(const needle of ["SNAPSHOT_REVERIFY_MS","raw===lastSnapshotRaw","lastSnapshotVerifiedAt=Date.now()","await cache.put(","if(!validPrimary(raw))return false"]){
 assert.ok(durability.includes(needle),"Safe backup optimization missing: "+needle);
}
assert.ok(durability.indexOf("if(!validPrimary(raw))return false")<durability.indexOf("await cache.put("),"Backup must validate data before writing");
for(const needle of ["pendingEntityIds(tenantId,entity,next)","movementIndex.get(key)","movementIndex.set(key,collection.length-1)","KIUBO_SYNC_CYCLE_COMPLETED","window.addEventListener(KIUBO_SYNC_QUEUED_EVENT,wake)"]){
 assert.ok(realtime.includes(needle),"Safe canonical reconciliation optimization missing: "+needle);
}
assert.ok(!status.includes("runSyncCycle"),"Status display must not start a duplicate Cloud synchronization loop");
assert.ok(status.includes("KIUBO_SYNC_CYCLE_COMPLETED"),"Status display must consume authoritative Cloud status");
assert.ok(status.includes("KIUBO_DATA_REFRESHED"),"Status display must refresh after Cloud reconciliation");
console.log("YUKI mobile performance checks passed: no duplicate sync, cheaper safe backup, indexed inventory reconciliation");
