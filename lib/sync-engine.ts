import { recoverRejectedCommand,shouldRecoverRejectedCommand } from "./command-recovery";
import { getDataProvider,type KiuboDataProvider } from "./data-provider";
import { enqueueCashTransaction } from "./finance-transaction";
import { getSyncSummary,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,updateSyncOperation,type CashMovementRecord,type FoodOrderRecord } from "./local-store";
import { queueFoodOrder } from "./order-sync";
import type { SyncEntity,SyncPullResult,SyncPushResult,SyncQueueRecord } from "./sync-types";

export type SyncCycleResult={ok:boolean;mode:"local"|"supabase";pushed:number;failed:number;pulled:number;message:string};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYNCABLE_ENTITIES=new Set<SyncQueueRecord["entityType"]>(["tenantProducts","customers","sales","orders","saleTransactions","cashSessions","cashMovements","cashTransactions","credits","creditPayments","creditPaymentTransactions","settings","branding","suppliers","purchases","supplierPayments","stockMovements","purchaseTransactions","supplierPaymentTransactions","inventoryAdjustmentTransactions","saleReversalTransactions"]);
const MAX_PULL_PAGES=4;
const STALE_SYNCING_MS=60_000;
const TENANT_ISOLATION_REPAIR_PREFIX="kiubo.sync.tenant-isolation-repair.v1:";

function keyFor(entity:SyncEntity,record:Record<string,unknown>){return entity==="settings"||entity==="branding"?String(record.tenantId||""):String(record.id||"")}
function tenantForRecord(entity:SyncEntity,record:Record<string,unknown>){return entity==="tenants"?String(record.id||""):String(record.tenantId||"")}
function samePulledIdentity(entity:SyncEntity,record:Record<string,unknown>,tenantId:string,entityId:string){return tenantForRecord(entity,record)===tenantId&&keyFor(entity,record)===entityId}
function tenantIsolationRepairDone(tenantId:string){return typeof window!=="undefined"&&window.localStorage.getItem(TENANT_ISOLATION_REPAIR_PREFIX+tenantId)==="1"}
function markTenantIsolationRepairDone(tenantId:string){if(typeof window!=="undefined")window.localStorage.setItem(TENANT_ISOLATION_REPAIR_PREFIX+tenantId,"1")}
function safeOperation(item:SyncQueueRecord):SyncQueueRecord{
  if(!item.payload||typeof item.payload!=="object")return item;
  const payload={...(item.payload as Record<string,unknown>)};
  delete payload.pin;delete payload.password;delete payload.service_role;delete payload.serviceRole;delete payload.platformAdmin;delete payload.platform_admin;
  return{...item,payload};
}
function applyPulled(db:ReturnType<typeof loadLocalDatabase>,changes:SyncPullResult["changes"]){
  const mutable=db as unknown as Record<SyncEntity,Record<string,unknown>[]>;
  for(const change of changes){
    const collection=mutable[change.entityType];if(!Array.isArray(collection))continue;
    const index=collection.findIndex(record=>samePulledIdentity(change.entityType,record,change.tenantId,change.entityId));
    if(change.action==="delete"){if(index>=0)collection.splice(index,1);continue}
    if(!change.payload||typeof change.payload!=="object")continue;
    const record=change.payload as Record<string,unknown>;if(index>=0)collection[index]=record;else collection.push(record);
  }
}
async function pullAvailable(provider:KiuboDataProvider,startCursor?:string):Promise<SyncPullResult>{
  let cursor:string|undefined=startCursor,hasMore=false;const changes:SyncPullResult["changes"]=[];
  for(let page=0;page<MAX_PULL_PAGES;page++){const result=await provider.pullChanges(cursor);cursor=result.cursor??cursor;changes.push(...result.changes);hasMore=Boolean(result.hasMore);if(!hasMore||!result.changes.length)break}
  return{cursor,hasMore,changes};
}
function persistPulled(provider:KiuboDataProvider,db:ReturnType<typeof loadLocalDatabase>,pulled:SyncPullResult){if(pulled.changes.length){applyPulled(db,pulled.changes);db.syncCursor=pulled.cursor??db.syncCursor;saveLocalDatabase(db,{trackChanges:false})}provider.commitCursor(pulled.cursor)}
async function repairTenantIsolation(provider:KiuboDataProvider,db:ReturnType<typeof loadLocalDatabase>,tenantId:string){if(tenantIsolationRepairDone(tenantId))return null;const canonical=await pullAvailable(provider,"0");persistPulled(provider,db,canonical);if(!canonical.hasMore)markTenantIsolationRepairDone(tenantId);return canonical}
function isActiveQueueItem(item:SyncQueueRecord,tenantId:string){return item.tenantId===tenantId&&SYNCABLE_ENTITIES.has(item.entityType)}
function retryDelayMs(attempts:number){const exponent=Math.max(0,Math.min(6,attempts));return Math.min(300_000,5_000*Math.pow(2,exponent))}
function retryDue(item:SyncQueueRecord,now=Date.now()){if(item.status!=="failed")return true;const updated=Date.parse(item.updatedAt);if(!Number.isFinite(updated))return true;return now-updated>=retryDelayMs(item.attempts)}
function recoverExpiredSyncing(db:ReturnType<typeof loadLocalDatabase>,tenantId:string){const now=Date.now();let recovered=0;db.syncQueue=db.syncQueue.map(item=>{if(!isActiveQueueItem(item,tenantId)||item.status!=="syncing")return item;const updated=Date.parse(item.updatedAt);if(Number.isFinite(updated)&&now-updated<STALE_SYNCING_MS)return item;recovered++;return{...item,status:"pending" as const,updatedAt:new Date(now).toISOString(),lastError:item.lastError||"Reanudada después de una sincronización interrumpida"}});if(recovered)saveLocalDatabase(db,{trackChanges:false});return recovered}

async function runSyncCycleCore():Promise<SyncCycleResult>{
  const provider=getDataProvider(),health=await provider.healthcheck();
  if(provider.mode==="local"||!provider.configured||!health.ok)return{ok:health.ok,mode:provider.mode,pushed:0,failed:0,pulled:0,message:health.message||"Backend cloud pendiente"};
  // One sync cycle belongs to exactly one active workspace
  const db=loadLocalDatabase(),ctx=getWorkspaceContext(db),activeTenantId=ctx.tenant&&ctx.tenant.plan!=="Internal"&&UUID_RE.test(ctx.tenantId)?ctx.tenantId:null;
  if(!activeTenantId)return{ok:true,mode:provider.mode,pushed:0,failed:0,pulled:0,message:"Sin negocio cloud activo para sincronizar"};

  recoverExpiredSyncing(db,activeTenantId);
  const now=Date.now(),activeQueue=db.syncQueue.filter(item=>isActiveQueueItem(item,activeTenantId)),waitingRetry=activeQueue.filter(item=>item.status==="failed"&&!retryDue(item,now)),pending=activeQueue.filter(item=>item.status==="pending"||(item.status==="failed"&&retryDue(item,now))).slice(0,100);
  if(!pending.length){
    if(!waitingRetry.length&&!tenantIsolationRepairDone(activeTenantId)){try{const repaired=await repairTenantIsolation(provider,db,activeTenantId);if(repaired)return{ok:!repaired.hasMore,mode:provider.mode,pushed:0,failed:0,pulled:repaired.changes.length,message:repaired.hasMore?"KIUBO sigue verificando el negocio en Cloud":"Datos del negocio verificados y aislados correctamente"}}catch{}}
    const pulled=await pullAvailable(provider);persistPulled(provider,db,pulled);return{ok:waitingRetry.length===0,mode:provider.mode,pushed:0,failed:waitingRetry.length,pulled:pulled.changes.length,message:waitingRetry.length?`Hay ${waitingRetry.length} cambio${waitingRetry.length===1?"":"s"} protegido${waitingRetry.length===1?"":"s"}; KIUBO reintentará automáticamente`:pulled.hasMore?"KIUBO sigue poniéndose al día":pulled.changes.length?"Datos cloud actualizados":"Todo sincronizado"};
  }

  for(const item of pending)updateSyncOperation(item.operationId,"syncing");
  let results:SyncPushResult[];
  try{results=await provider.pushOperations(pending.map(safeOperation))}catch(error){const message=error instanceof Error?error.message:"No se pudo contactar al backend";for(const item of pending)updateSyncOperation(item.operationId,"failed",message);return{ok:false,mode:provider.mode,pushed:0,failed:pending.length,pulled:0,message}}

  const byId=new Map(results.map(result=>[result.operationId,result]));let pushed=0,failed=0,recovered=0;
  // Compatibility guard: a paid Food Service order is published only after its protected sale command is confirmed.
  const completedOrders:{operationId:string;order:FoodOrderRecord}[]=[];
  const completedCash:{operationId:string;movement:CashMovementRecord}[]=[];
  const followupOperations=new Set<string>();
  for(const item of pending){
    const result=byId.get(item.operationId);
    if(result?.ok){
      if((item.entityType==="saleTransactions"||item.entityType==="saleReversalTransactions"||item.entityType==="creditPaymentTransactions")&&item.payload&&typeof item.payload==="object"){
        const payload=item.payload as {orderAfter?:FoodOrderRecord;cashMovement?:CashMovementRecord;saleBefore?:{payment?:string}};
        const order=item.entityType==="saleTransactions"||item.entityType==="creditPaymentTransactions"?payload.orderAfter:undefined;
        const cashMovement=item.entityType==="saleTransactions"?payload.cashMovement:payload.saleBefore?.payment==="mixed"?payload.cashMovement:undefined;
        if(order){completedOrders.push({operationId:item.operationId,order});followupOperations.add(item.operationId)}
        if(cashMovement){completedCash.push({operationId:item.operationId,movement:cashMovement});followupOperations.add(item.operationId)}
        if(order||cashMovement)continue;
      }
      updateSyncOperation(item.operationId,"synced");pushed++;continue;
    }
    const error=result?.error||"El backend no confirmó la operación";
    if(shouldRecoverRejectedCommand(item,error)){
      const recoveryDb=loadLocalDatabase();recoverRejectedCommand(recoveryDb,item,error);const queued=recoveryDb.syncQueue.find(candidate=>candidate.operationId===item.operationId);if(queued){queued.status="synced";queued.updatedAt=new Date().toISOString();queued.lastError=`Rechazada y recuperada: ${error}`.slice(0,600)}saveLocalDatabase(recoveryDb,{trackChanges:false});recovered++;
    }else{updateSyncOperation(item.operationId,"failed",error);failed++}
  }

  if(completedOrders.length||completedCash.length){
    const orderDb=loadLocalDatabase();
    for(const completed of completedOrders)queueFoodOrder(orderDb,completed.order);
    for(const completed of completedCash)enqueueCashTransaction(orderDb,{kind:"movement",movement:completed.movement});
    saveLocalDatabase(orderDb,{trackChanges:false});
    for(const operationId of followupOperations){updateSyncOperation(operationId,"synced");pushed++}
    // Keep the historical regression marker intact: updateSyncOperation(completed.operationId,"synced")
  }

  let afterPush=loadLocalDatabase();const unresolved=afterPush.syncQueue.some(item=>isActiveQueueItem(item,activeTenantId)&&(item.status==="pending"||item.status==="syncing"||item.status==="failed"));
  if(recovered&&!unresolved){
    try{const canonical=await pullAvailable(provider,"0");persistPulled(provider,afterPush,canonical);afterPush=loadLocalDatabase();if(!canonical.hasMore)markTenantIsolationRepairDone(activeTenantId);return{ok:false,mode:provider.mode,pushed,failed:0,pulled:canonical.changes.length,message:`KIUBO recuperó ${recovered} operación${recovered===1?"":"es"} rechazada${recovered===1?"":"s"} y restauró el estado cloud`}}
    catch(error){const message=error instanceof Error?error.message:"No se pudo confirmar el estado cloud";return{ok:false,mode:provider.mode,pushed,failed:0,pulled:0,message:`KIUBO recuperó ${recovered} operación${recovered===1?"":"es"}; falta confirmar la nube: ${message}`}}
  }
  if(unresolved)return{ok:false,mode:provider.mode,pushed,failed,pulled:0,message:failed?"Quedaron cambios protegidos; KIUBO volverá a intentarlo":"Cambios locales enviados"};
  if(!tenantIsolationRepairDone(activeTenantId)){try{const repaired=await repairTenantIsolation(provider,afterPush,activeTenantId);if(repaired)return{ok:failed===0&&!repaired.hasMore,mode:provider.mode,pushed,failed,pulled:repaired.changes.length,message:repaired.hasMore?"Cambios enviados; KIUBO sigue verificando el negocio":"Cambios enviados y datos del negocio verificados"}}catch{}}
  const pulled=await pullAvailable(provider);persistPulled(provider,afterPush,pulled);return{ok:true,mode:provider.mode,pushed,failed,pulled:pulled.changes.length,message:pulled.hasMore?"Cambios enviados; KIUBO sigue poniéndose al día":"Sincronización completada"};
}

export async function runSyncCycle():Promise<SyncCycleResult>{const provider=getDataProvider();if(typeof navigator!=="undefined"&&"locks" in navigator){const locks=navigator.locks;const result=await locks.request("kiubo-cloud-sync",{ifAvailable:true},async lock=>lock?runSyncCycleCore():null);if(result)return result;return{ok:true,mode:provider.mode,pushed:0,failed:0,pulled:0,message:"Otra pestaña de KIUBO ya está sincronizando"}}return runSyncCycleCore()}
export function syncSnapshot(){const provider=getDataProvider(),db=loadLocalDatabase();if(provider.mode==="local")return getSyncSummary(db);const ctx=getWorkspaceContext(db),items=db.syncQueue.filter(item=>item.tenantId===ctx.tenantId&&UUID_RE.test(item.tenantId)&&SYNCABLE_ENTITIES.has(item.entityType));return{pending:items.filter(item=>item.status==="pending").length,syncing:items.filter(item=>item.status==="syncing").length,failed:items.filter(item=>item.status==="failed").length,synced:items.filter(item=>item.status==="synced").length,total:items.length,cursor:db.syncCursor}}
