import { getDataProvider } from "./data-provider";
import { getSyncSummary,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,updateSyncOperation } from "./local-store";
import type { SyncEntity,SyncPushResult,SyncQueueRecord } from "./sync-types";

export type SyncCycleResult={ok:boolean;mode:"local"|"supabase";pushed:number;failed:number;pulled:number;message:string};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function keyFor(entity:SyncEntity,record:Record<string,unknown>){return entity==="settings"||entity==="branding"?String(record.tenantId||""):String(record.id||"")}
function safeOperation(item:SyncQueueRecord):SyncQueueRecord{if(item.entityType!=="users"||!item.payload||typeof item.payload!=="object")return item;const payload={...(item.payload as Record<string,unknown>)};delete payload.pin;delete payload.platformAdmin;return{...item,payload}}
function applyPulled(db:ReturnType<typeof loadLocalDatabase>,changes:Array<{tenantId:string;branchId?:string;entityType:SyncEntity;entityId:string;action:"upsert"|"delete";payload?:unknown;updatedAt:string}>){const mutable=db as unknown as Record<SyncEntity,Record<string,unknown>[]>;for(const change of changes){const collection=mutable[change.entityType];if(!Array.isArray(collection))continue;const index=collection.findIndex(record=>keyFor(change.entityType,record)===change.entityId);if(change.action==="delete"){if(index>=0)collection.splice(index,1);continue}if(!change.payload||typeof change.payload!=="object")continue;const record=change.payload as Record<string,unknown>;if(index>=0)collection[index]=record;else collection.push(record)}}

export async function runSyncCycle():Promise<SyncCycleResult>{
  const provider=getDataProvider(),health=await provider.healthcheck();
  if(provider.mode==="local"||!provider.configured||!health.ok)return{ok:health.ok,mode:provider.mode,pushed:0,failed:0,pulled:0,message:health.message||"Backend cloud pendiente"};
  const db=loadLocalDatabase(),syncableTenants=new Set(db.tenants.filter(t=>t.plan!=="Internal"&&UUID_RE.test(t.id)).map(t=>t.id)),pending=db.syncQueue.filter(item=>syncableTenants.has(item.tenantId)&&(item.status==="pending"||item.status==="failed")).slice(0,100);
  if(!pending.length){const pulled=await provider.pullChanges(db.syncCursor);if(pulled.changes.length){applyPulled(db,pulled.changes);db.syncCursor=pulled.cursor??db.syncCursor;saveLocalDatabase(db,{trackChanges:false})}return{ok:true,mode:provider.mode,pushed:0,failed:0,pulled:pulled.changes.length,message:pulled.changes.length?"Datos cloud actualizados":"Todo sincronizado"}}
  for(const item of pending)updateSyncOperation(item.operationId,"syncing");
  let results:SyncPushResult[];try{results=await provider.pushOperations(pending.map(safeOperation))}catch(error){const message=error instanceof Error?error.message:"No se pudo contactar al backend";for(const item of pending)updateSyncOperation(item.operationId,"failed",message);return{ok:false,mode:provider.mode,pushed:0,failed:pending.length,pulled:0,message}}
  const byId=new Map(results.map(result=>[result.operationId,result]));let pushed=0,failed=0;
  for(const item of pending){const result=byId.get(item.operationId);if(result?.ok){updateSyncOperation(item.operationId,"synced");pushed++}else{updateSyncOperation(item.operationId,"failed",result?.error||"El backend no confirmó la operación");failed++}}
  const afterPush=loadLocalDatabase();if(afterPush.syncQueue.some(item=>syncableTenants.has(item.tenantId)&&(item.status==="pending"||item.status==="syncing"||item.status==="failed")))return{ok:false,mode:provider.mode,pushed,failed,pulled:0,message:failed?"Quedaron cambios pendientes":"Cambios locales enviados"};
  const pulled=await provider.pullChanges(afterPush.syncCursor);if(pulled.changes.length){applyPulled(afterPush,pulled.changes);afterPush.syncCursor=pulled.cursor??afterPush.syncCursor;saveLocalDatabase(afterPush,{trackChanges:false})}return{ok:true,mode:provider.mode,pushed,failed,pulled:pulled.changes.length,message:"Sincronización completada"};
}

export function syncSnapshot(){const provider=getDataProvider(),db=loadLocalDatabase();if(provider.mode==="local")return getSyncSummary(db);const ctx=getWorkspaceContext(db),items=db.syncQueue.filter(item=>item.tenantId===ctx.tenantId&&UUID_RE.test(item.tenantId));return{pending:items.filter(item=>item.status==="pending").length,syncing:items.filter(item=>item.status==="syncing").length,failed:items.filter(item=>item.status==="failed").length,synced:items.filter(item=>item.status==="synced").length,total:items.length,cursor:db.syncCursor}}
