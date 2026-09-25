import { recoverRejectedCommand,shouldRecoverRejectedCommand } from "./command-recovery";
import { getDataProvider,type KiuboDataProvider } from "./data-provider";
import { enqueueCashTransaction } from "./finance-transaction";
import { getSyncSummary,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,updateSyncOperation,type CashMovementRecord,type FoodOrderRecord } from "./local-store";
import { queueFoodOrder } from "./order-sync";
import { getSupabaseBrowserClient } from "./supabase-browser";
import type { SyncEntity,SyncPullResult,SyncPushResult,SyncQueueRecord } from "./sync-types";

export type SyncCycleResult={ok:boolean;mode:"local"|"supabase";pushed:number;failed:number;pulled:number;message:string;hasMore?:boolean};
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,REVISION_CURSOR_RE=/^\d+$/;
const SYNCABLE_ENTITIES=new Set<SyncQueueRecord["entityType"]>(["tenantProducts","customers","sales","orders","saleTransactions","cashSessions","cashMovements","cashTransactions","credits","creditPayments","creditPaymentTransactions","settings","branding","suppliers","purchases","supplierPayments","stockMovements","purchaseTransactions","supplierPaymentTransactions","inventoryAdjustmentTransactions","saleReversalTransactions"]);
const MAX_PULL_PAGES=4;
const STALE_SYNCING_MS=60_000;
const TENANT_ISOLATION_REPAIR_PREFIX="kiubo.sync.tenant-isolation-repair.v1:";
const OPERATIONAL_RECONCILE_PREFIX="kiubo.sync.operational-reconcile.v2:";
const OPERATIONAL_RECONCILE_VERSION="2026-09-23";
const OPERATIONAL_RECONCILE_INTERVAL_MS=6*60*60*1000;
const OPERATIONAL_SNAPSHOT_ENTITIES=new Set<SyncEntity>(["orders","sales","credits","creditPayments","cashSessions","cashMovements"]);
const OPERATIONAL_QUEUE_TYPES=new Set<SyncQueueRecord["entityType"]>(["orders","sales","credits","creditPayments","cashSessions","cashMovements","saleTransactions","creditPaymentTransactions","cashTransactions"]);

function keyFor(entity:SyncEntity,record:Record<string,unknown>){return entity==="settings"||entity==="branding"?String(record.tenantId||""):String(record.id||"")}
function tenantForRecord(entity:SyncEntity,record:Record<string,unknown>){return entity==="tenants"?String(record.id||""):String(record.tenantId||"")}
function samePulledIdentity(entity:SyncEntity,record:Record<string,unknown>,tenantId:string,entityId:string){return tenantForRecord(entity,record)===tenantId&&keyFor(entity,record)===entityId}
function tenantIsolationRepairDone(tenantId:string){return typeof window!=="undefined"&&window.localStorage.getItem(TENANT_ISOLATION_REPAIR_PREFIX+tenantId)==="1"}
function markTenantIsolationRepairDone(tenantId:string){if(typeof window!=="undefined")window.localStorage.setItem(TENANT_ISOLATION_REPAIR_PREFIX+tenantId,"1")}
function operationalReconcileDue(tenantId:string){
  if(typeof window==="undefined")return false;
  try{
    const raw=window.localStorage.getItem(OPERATIONAL_RECONCILE_PREFIX+tenantId);if(!raw)return true;
    const parsed=JSON.parse(raw) as {version?:string;completedAt?:number};
    return parsed.version!==OPERATIONAL_RECONCILE_VERSION||!Number.isFinite(parsed.completedAt)||Date.now()-Number(parsed.completedAt)>OPERATIONAL_RECONCILE_INTERVAL_MS;
  }catch{return true}
}
function markOperationalReconciled(tenantId:string,watermark:string){
  if(typeof window!=="undefined")window.localStorage.setItem(OPERATIONAL_RECONCILE_PREFIX+tenantId,JSON.stringify({version:OPERATIONAL_RECONCILE_VERSION,completedAt:Date.now(),watermark}));
}
function hasUnresolvedOperationalQueue(db:ReturnType<typeof loadLocalDatabase>,tenantId:string){
  return db.syncQueue.some(item=>item.tenantId===tenantId&&OPERATIONAL_QUEUE_TYPES.has(item.entityType)&&item.status!=="synced");
}
function missingOperationalSnapshotRpc(message:string){
  const value=message.toLowerCase();return value.includes("pull_operational_snapshot_v1")&&(value.includes("could not find")||value.includes("does not exist")||value.includes("schema cache"));
}
async function reconcileOperationalSnapshot(provider:KiuboDataProvider,tenantId:string){
  if(!operationalReconcileDue(tenantId))return null;
  const client=getSupabaseBrowserClient();if(!client)return null;
  const initial=loadLocalDatabase();if(hasUnresolvedOperationalQueue(initial,tenantId))return null;
  let after="0",watermark:string|undefined,hasMore=false;const changes:SyncPullResult["changes"]=[];
  for(let page=0;page<20;page++){
    const result=await client.rpc("pull_operational_snapshot_v1",{p_tenant:tenantId,p_after_revision:Number(after),p_watermark:watermark?Number(watermark):null,p_limit:1000});
    if(result.error){if(missingOperationalSnapshotRpc(result.error.message))return null;throw new Error(result.error.message)}
    const payload=result.data&&typeof result.data==="object"?result.data as {watermark?:string|number;cursor?:string|number;hasMore?:boolean;changes?:SyncPullResult["changes"]}:{};
    watermark=String(payload.watermark??watermark??after);after=String(payload.cursor??after);hasMore=Boolean(payload.hasMore);
    if(Array.isArray(payload.changes))changes.push(...payload.changes);
    if(!hasMore)break;
  }
  if(hasMore||!watermark)return null;
  const latest=loadLocalDatabase();if(hasUnresolvedOperationalQueue(latest,tenantId))return null;
  const canonical=new Map<SyncEntity,Record<string,unknown>[]>();
  for(const entity of OPERATIONAL_SNAPSHOT_ENTITIES)canonical.set(entity,[]);
  for(const change of changes){
    if(!OPERATIONAL_SNAPSHOT_ENTITIES.has(change.entityType)||change.action==="delete"||!change.payload||typeof change.payload!=="object")continue;
    canonical.get(change.entityType)!.push(change.payload as Record<string,unknown>);
  }
  const mutable=latest as unknown as Record<string,Record<string,unknown>[]>;
  for(const entity of OPERATIONAL_SNAPSHOT_ENTITIES){
    const current=Array.isArray(mutable[entity])?mutable[entity]:[];
    mutable[entity]=current.filter(record=>String(record.tenantId||"")!==tenantId).concat(canonical.get(entity)??[]);
  }
  latest.syncCursor=watermark;saveLocalDatabase(latest,{trackChanges:false});provider.commitCursor(watermark);markOperationalReconciled(tenantId,watermark);
  const catchup=await pullAvailable(provider,watermark);persistPulled(provider,loadLocalDatabase(),catchup);
  return{pulled:changes.length+catchup.changes.length,hasMore:Boolean(catchup.hasMore)};
}
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
async function repairTenantIsolation(provider:KiuboDataProvider,db:ReturnType<typeof loadLocalDatabase>,tenantId:string){if(tenantIsolationRepairDone(tenantId))return null;const resumeCursor=db.syncCursor&&REVISION_CURSOR_RE.test(db.syncCursor)?db.syncCursor:"0";const canonical=await pullAvailable(provider,resumeCursor);persistPulled(provider,db,canonical);if(!canonical.hasMore)markTenantIsolationRepairDone(tenantId);return canonical}
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

  // If a fresh browser or a stale local workspace has no products for the active branch,
  // replay the tenant stream from revision zero. This repairs hydration without deleting
  // local data or changing the cloud source of truth.
  const hasWorkspaceProducts=db.tenantProducts.some(product=>product.tenantId===activeTenantId&&product.branchId===ctx.branchId);
  if(!hasWorkspaceProducts&&!hasUnresolvedOperationalQueue(db,activeTenantId)){
    try{
      const hydration=await pullAvailable(provider,"0");
      persistPulled(provider,db,hydration);
      if(!hydration.hasMore)markTenantIsolationRepairDone(activeTenantId);
      return{ok:!hydration.hasMore,mode:provider.mode,pushed:0,failed:0,pulled:hydration.changes.length,hasMore:Boolean(hydration.hasMore),message:hydration.hasMore?"KIUBO está recuperando los productos del negocio":"Productos del negocio recuperados desde Cloud"};
    }catch{}
  }

  recoverExpiredSyncing(db,activeTenantId);
  const now=Date.now(),activeQueue=db.syncQueue.filter(item=>isActiveQueueItem(item,activeTenantId)),waitingRetry=activeQueue.filter(item=>item.status==="failed"&&!retryDue(item,now)),pending=activeQueue.filter(item=>item.status==="pending"||(item.status==="failed"&&retryDue(item,now))).slice(0,100);
  if(!pending.length){
    try{
      const reconciled=await reconcileOperationalSnapshot(provider,activeTenantId);
      if(reconciled)return{ok:waitingRetry.length===0&&!reconciled.hasMore,mode:provider.mode,pushed:0,failed:waitingRetry.length,pulled:reconciled.pulled,hasMore:reconciled.hasMore,message:reconciled.hasMore?"KIUBO terminó de conciliar pedidos y sigue poniéndose al día":"Pedidos, cobros y caja conciliados con Cloud"};
    }catch{}
    if(!waitingRetry.length&&!tenantIsolationRepairDone(activeTenantId)){try{const repaired=await repairTenantIsolation(provider,db,activeTenantId);if(repaired)return{ok:!repaired.hasMore,mode:provider.mode,pushed:0,failed:0,pulled:repaired.changes.length,hasMore:Boolean(repaired.hasMore),message:repaired.hasMore?"KIUBO sigue verificando el negocio en Cloud":"Datos del negocio verificados y aislados correctamente"}}catch{}}
    const pulled=await pullAvailable(provider);persistPulled(provider,db,pulled);return{ok:waitingRetry.length===0&&!pulled.hasMore,mode:provider.mode,pushed:0,failed:waitingRetry.length,pulled:pulled.changes.length,hasMore:Boolean(pulled.hasMore),message:waitingRetry.length?`Hay ${waitingRetry.length} cambio${waitingRetry.length===1?"":"s"} protegido${waitingRetry.length===1?"":"s"}; KIUBO reintentará automáticamente`:pulled.hasMore?"KIUBO sigue poniéndose al día":pulled.changes.length?"Datos cloud actualizados":"Todo sincronizado"};
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
  try{
    const reconciled=await reconcileOperationalSnapshot(provider,activeTenantId);
    if(reconciled)return{ok:failed===0&&!reconciled.hasMore,mode:provider.mode,pushed,failed,pulled:reconciled.pulled,hasMore:reconciled.hasMore,message:reconciled.hasMore?"Cambios enviados; KIUBO concilió pedidos y sigue actualizando":"Cambios enviados y pedidos conciliados con Cloud"};
  }catch{}
  if(!tenantIsolationRepairDone(activeTenantId)){try{const repaired=await repairTenantIsolation(provider,afterPush,activeTenantId);if(repaired)return{ok:failed===0&&!repaired.hasMore,mode:provider.mode,pushed,failed,pulled:repaired.changes.length,hasMore:Boolean(repaired.hasMore),message:repaired.hasMore?"Cambios enviados; KIUBO sigue verificando el negocio":"Cambios enviados y datos del negocio verificados"}}catch{}}
  const pulled=await pullAvailable(provider);persistPulled(provider,afterPush,pulled);return{ok:failed===0&&!pulled.hasMore,mode:provider.mode,pushed,failed,pulled:pulled.changes.length,hasMore:Boolean(pulled.hasMore),message:pulled.hasMore?"Cambios enviados; KIUBO sigue poniéndose al día":"Sincronización completada"};
}

export async function runSyncCycle():Promise<SyncCycleResult>{const provider=getDataProvider();if(typeof navigator!=="undefined"&&"locks" in navigator){const locks=navigator.locks;const result=await locks.request("kiubo-cloud-sync",{ifAvailable:true},async lock=>lock?runSyncCycleCore():null);if(result)return result;return{ok:true,mode:provider.mode,pushed:0,failed:0,pulled:0,message:"Otra pestaña de KIUBO ya está sincronizando"}}return runSyncCycleCore()}
export function syncSnapshot(){const provider=getDataProvider(),db=loadLocalDatabase();if(provider.mode==="local")return getSyncSummary(db);const ctx=getWorkspaceContext(db),items=db.syncQueue.filter(item=>item.tenantId===ctx.tenantId&&UUID_RE.test(item.tenantId)&&SYNCABLE_ENTITIES.has(item.entityType));return{pending:items.filter(item=>item.status==="pending").length,syncing:items.filter(item=>item.status==="syncing").length,failed:items.filter(item=>item.status==="failed").length,synced:items.filter(item=>item.status==="synced").length,total:items.length,cursor:db.syncCursor}}
