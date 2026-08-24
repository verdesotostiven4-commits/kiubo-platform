import { getDataProvider,type KiuboDataProvider } from "./data-provider";
import { getSyncSummary,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,updateSyncOperation } from "./local-store";
import type { SyncEntity,SyncPullResult,SyncPushResult,SyncQueueRecord } from "./sync-types";

export type SyncCycleResult={ok:boolean;mode:"local"|"supabase";pushed:number;failed:number;pulled:number;message:string};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYNCABLE_ENTITIES=new Set<SyncQueueRecord["entityType"]>(["tenantProducts","customers","sales","saleTransactions","cashSessions","cashMovements","credits","creditPayments","settings","branding","suppliers","purchases","supplierPayments","stockMovements"]);
const MAX_PULL_PAGES=4;

function keyFor(entity:SyncEntity,record:Record<string,unknown>){return entity==="settings"||entity==="branding"?String(record.tenantId||""):String(record.id||"")}
function safeOperation(item:SyncQueueRecord):SyncQueueRecord{
  if(!item.payload||typeof item.payload!=="object")return item;
  const payload={...(item.payload as Record<string,unknown>)};
  delete payload.pin;
  delete payload.password;
  delete payload.service_role;
  delete payload.serviceRole;
  delete payload.platformAdmin;
  delete payload.platform_admin;
  return{...item,payload};
}
function applyPulled(db:ReturnType<typeof loadLocalDatabase>,changes:SyncPullResult["changes"]){
  const mutable=db as unknown as Record<SyncEntity,Record<string,unknown>[]>;
  for(const change of changes){
    const collection=mutable[change.entityType];
    if(!Array.isArray(collection))continue;
    const index=collection.findIndex(record=>keyFor(change.entityType,record)===change.entityId);
    if(change.action==="delete"){
      if(index>=0)collection.splice(index,1);
      continue;
    }
    if(!change.payload||typeof change.payload!=="object")continue;
    const record=change.payload as Record<string,unknown>;
    if(index>=0)collection[index]=record;
    else collection.push(record);
  }
}
async function pullAvailable(provider:KiuboDataProvider):Promise<SyncPullResult>{
  let cursor:string|undefined;
  let hasMore=false;
  const changes:SyncPullResult["changes"]=[];
  for(let page=0;page<MAX_PULL_PAGES;page++){
    const result=await provider.pullChanges(cursor);
    cursor=result.cursor??cursor;
    changes.push(...result.changes);
    hasMore=Boolean(result.hasMore);
    if(!hasMore||!result.changes.length)break;
  }
  return{cursor,hasMore,changes};
}
function persistPulled(provider:KiuboDataProvider,db:ReturnType<typeof loadLocalDatabase>,pulled:SyncPullResult){
  if(pulled.changes.length){
    applyPulled(db,pulled.changes);
    db.syncCursor=pulled.cursor??db.syncCursor;
    saveLocalDatabase(db,{trackChanges:false});
  }
  provider.commitCursor(pulled.cursor);
}

export async function runSyncCycle():Promise<SyncCycleResult>{
  const provider=getDataProvider(),health=await provider.healthcheck();
  if(provider.mode==="local"||!provider.configured||!health.ok)return{ok:health.ok,mode:provider.mode,pushed:0,failed:0,pulled:0,message:health.message||"Backend cloud pendiente"};
  const db=loadLocalDatabase();
  const syncableTenants=new Set(db.tenants.filter(t=>t.plan!=="Internal"&&UUID_RE.test(t.id)).map(t=>t.id));
  const pending=db.syncQueue.filter(item=>syncableTenants.has(item.tenantId)&&SYNCABLE_ENTITIES.has(item.entityType)&&(item.status==="pending"||item.status==="failed")).slice(0,100);

  if(!pending.length){
    const pulled=await pullAvailable(provider);
    persistPulled(provider,db,pulled);
    return{
      ok:true,
      mode:provider.mode,
      pushed:0,
      failed:0,
      pulled:pulled.changes.length,
      message:pulled.hasMore?"KIUBO sigue poniéndose al día":pulled.changes.length?"Datos cloud actualizados":"Todo sincronizado"
    };
  }

  for(const item of pending)updateSyncOperation(item.operationId,"syncing");
  let results:SyncPushResult[];
  try{
    results=await provider.pushOperations(pending.map(safeOperation));
  }catch(error){
    const message=error instanceof Error?error.message:"No se pudo contactar al backend";
    for(const item of pending)updateSyncOperation(item.operationId,"failed",message);
    return{ok:false,mode:provider.mode,pushed:0,failed:pending.length,pulled:0,message};
  }

  const byId=new Map(results.map(result=>[result.operationId,result]));
  let pushed=0,failed=0;
  for(const item of pending){
    const result=byId.get(item.operationId);
    if(result?.ok){
      updateSyncOperation(item.operationId,"synced");
      pushed++;
    }else{
      updateSyncOperation(item.operationId,"failed",result?.error||"El backend no confirmó la operación");
      failed++;
    }
  }

  const afterPush=loadLocalDatabase();
  if(afterPush.syncQueue.some(item=>syncableTenants.has(item.tenantId)&&SYNCABLE_ENTITIES.has(item.entityType)&&(item.status==="pending"||item.status==="syncing"||item.status==="failed"))){
    return{ok:false,mode:provider.mode,pushed,failed,pulled:0,message:failed?"Quedaron cambios pendientes":"Cambios locales enviados"};
  }

  const pulled=await pullAvailable(provider);
  persistPulled(provider,afterPush,pulled);
  return{
    ok:true,
    mode:provider.mode,
    pushed,
    failed,
    pulled:pulled.changes.length,
    message:pulled.hasMore?"Cambios enviados; KIUBO sigue poniéndose al día":"Sincronización completada"
  };
}

export function syncSnapshot(){
  const provider=getDataProvider(),db=loadLocalDatabase();
  if(provider.mode==="local")return getSyncSummary(db);
  const ctx=getWorkspaceContext(db),items=db.syncQueue.filter(item=>item.tenantId===ctx.tenantId&&UUID_RE.test(item.tenantId)&&SYNCABLE_ENTITIES.has(item.entityType));
  return{
    pending:items.filter(item=>item.status==="pending").length,
    syncing:items.filter(item=>item.status==="syncing").length,
    failed:items.filter(item=>item.status==="failed").length,
    synced:items.filter(item=>item.status==="synced").length,
    total:items.length,
    cursor:db.syncCursor
  };
}
