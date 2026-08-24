import type {
  CashMovementRecord,
  CashSessionRecord,
  CreditPaymentRecord,
  CreditRecord,
  PurchaseRecord,
  SaleRecord,
  StockMovementRecord,
  SupplierPaymentRecord,
  TenantProduct,
} from "./local-store";
import { getWorkspaceContext,loadLocalDatabase } from "./local-store";
import type { SyncPullResult, SyncPushResult, SyncQueueRecord } from "./sync-types";
import { getSupabaseBrowserClient,isSupabaseConfigured } from "./supabase-browser";

export type DataMode = "local" | "supabase";
export type ProviderHealth = { ok:boolean; mode:DataMode; configured:boolean; message?:string };
export type KiuboDataProvider = {
  mode:DataMode;
  configured:boolean;
  healthcheck():Promise<ProviderHealth>;
  pushOperations(operations:SyncQueueRecord[]):Promise<SyncPushResult[]>;
  pullChanges(cursor?:string):Promise<SyncPullResult>;
  commitCursor(cursor?:string):void;
};

type SaleTransactionPayload={sale?:SaleRecord;productSnapshots?:TenantProduct[];stockMovements?:StockMovementRecord[];credit?:CreditRecord};
type CashTransactionPayload=| {kind:"open"|"close";session?:CashSessionRecord}| {kind:"movement";movement?:CashMovementRecord};
type CreditPaymentTransactionPayload={payment?:CreditPaymentRecord;creditSnapshot?:CreditRecord;cashMovement?:CashMovementRecord};
type PurchaseTransactionPayload={purchase?:PurchaseRecord;productSnapshots?:TenantProduct[];stockMovements?:StockMovementRecord[];initialPayment?:SupplierPaymentRecord};
type SupplierPaymentTransactionPayload={payment?:SupplierPaymentRecord;purchaseAfter?:PurchaseRecord};

export const localProvider:KiuboDataProvider={
  mode:"local",configured:false,
  async healthcheck(){return{ok:true,mode:"local",configured:false,message:"Backend cloud todavía no conectado"}},
  async pushOperations(operations){return operations.map(item=>({operationId:item.operationId,ok:false,error:"Backend cloud no configurado"}))},
  async pullChanges(cursor){return{cursor,changes:[]}},commitCursor(){}
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVISION_RE=/^\d+$/;
const CURSOR_V1_PREFIX="kiubo.cloud.cursor.v1:";
const CURSOR_V2_PREFIX="kiubo.cloud.cursor.v2:";

function activeCloudTenant(){const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);if(!ctx.tenant||ctx.tenant.plan==="Internal"||!UUID_RE.test(ctx.tenantId))return null;return ctx.tenantId}
function readStoredCursor(prefix:string,tenantId:string,fallback:string){if(typeof window==="undefined")return fallback;return window.localStorage.getItem(`${prefix}${tenantId}`)||fallback}
function readRevisionCursor(tenantId:string){const cursor=readStoredCursor(CURSOR_V2_PREFIX,tenantId,"0");return REVISION_RE.test(cursor)?cursor:"0"}
function readTimestampCursor(tenantId:string){return readStoredCursor(CURSOR_V1_PREFIX,tenantId,"1970-01-01T00:00:00.000Z")}
function writeStoredCursor(prefix:string,tenantId:string,cursor?:string){if(typeof window!=="undefined"&&cursor)window.localStorage.setItem(`${prefix}${tenantId}`,cursor)}
function isMissingRpc(message:string,name:string){const lower=message.toLowerCase();return lower.includes(name.toLowerCase())&&(lower.includes("could not find")||lower.includes("does not exist")||lower.includes("schema cache"))}
function isMissingV2Rpc(message:string){return isMissingRpc(message,"pull_sync_changes_v2")}
function normalizeRpcResults(operations:SyncQueueRecord[],data:unknown,error?:string):SyncPushResult[]{
  if(error)return operations.map(item=>({operationId:item.operationId,ok:false,error}));
  const rows=Array.isArray(data)?data as Array<{operationId?:string;ok?:boolean;error?:string}>:[];
  return operations.map(item=>{const row=rows.find(candidate=>candidate.operationId===item.operationId);return{operationId:item.operationId,ok:Boolean(row?.ok),error:row?.error||(!row?"Backend no confirmó la operación":undefined)}})
}
async function pushGeneric(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,operations:SyncQueueRecord[]):Promise<SyncPushResult[]>{if(!operations.length)return[];const result=await client.rpc("apply_sync_operations",{p_operations:operations});return normalizeRpcResults(operations,result.data,result.error?.message)}
function makeFallbackOperation(command:SyncQueueRecord,entityType:SyncQueueRecord["entityType"],entityId:string,body:unknown,index:string,branchId?:string):SyncQueueRecord{
  const now=command.createdAt||new Date().toISOString();return{id:`${command.id}:${index}`,operationId:`${command.operationId}:${index}`,tenantId:command.tenantId,branchId,entityType,entityId,action:"upsert",payload:body,status:"pending",attempts:0,createdAt:now,updatedAt:now}
}
function fallbackSaleOperations(command:SyncQueueRecord):SyncQueueRecord[]{
  if(!command.payload||typeof command.payload!=="object")return[];const payload=command.payload as SaleTransactionPayload,sale=payload.sale;if(!sale||typeof sale!=="object"||!sale.id)return[];
  const ops:SyncQueueRecord[]=[makeFallbackOperation(command,"sales",sale.id,sale,"sale",sale.branchId)];
  (payload.productSnapshots||[]).forEach((product,index)=>ops.push(makeFallbackOperation(command,"tenantProducts",product.id,product,`product-${index}`,product.branchId)));
  (payload.stockMovements||[]).forEach((movement,index)=>ops.push(makeFallbackOperation(command,"stockMovements",movement.id,movement,`stock-${index}`,movement.branchId)));
  if(payload.credit)ops.push(makeFallbackOperation(command,"credits",payload.credit.id,payload.credit,"credit",payload.credit.branchId));return ops
}
function fallbackFinanceOperations(command:SyncQueueRecord):SyncQueueRecord[]{
  if(!command.payload||typeof command.payload!=="object")return[];
  if(command.entityType==="cashTransactions"){
    const payload=command.payload as CashTransactionPayload;
    if((payload.kind==="open"||payload.kind==="close")&&payload.session)return[makeFallbackOperation(command,"cashSessions",payload.session.id,payload.session,"session",payload.session.branchId)];
    if(payload.kind==="movement"&&payload.movement)return[makeFallbackOperation(command,"cashMovements",payload.movement.id,payload.movement,"movement",payload.movement.branchId)];return[]
  }
  if(command.entityType==="creditPaymentTransactions"){
    const payload=command.payload as CreditPaymentTransactionPayload;if(!payload.payment||!payload.creditSnapshot)return[];
    const ops:SyncQueueRecord[]=[makeFallbackOperation(command,"creditPayments",payload.payment.id,payload.payment,"payment",payload.payment.branchId),makeFallbackOperation(command,"credits",payload.creditSnapshot.id,payload.creditSnapshot,"credit",payload.creditSnapshot.branchId)];
    if(payload.cashMovement)ops.push(makeFallbackOperation(command,"cashMovements",payload.cashMovement.id,payload.cashMovement,"cash",payload.cashMovement.branchId));return ops
  }
  return[]
}
function fallbackPurchaseOperations(command:SyncQueueRecord):SyncQueueRecord[]{
  if(!command.payload||typeof command.payload!=="object")return[];
  if(command.entityType==="purchaseTransactions"){
    const payload=command.payload as PurchaseTransactionPayload,purchase=payload.purchase;if(!purchase?.id)return[];
    const ops:SyncQueueRecord[]=[makeFallbackOperation(command,"purchases",purchase.id,purchase,"purchase",purchase.branchId)];
    (payload.productSnapshots||[]).forEach((product,index)=>ops.push(makeFallbackOperation(command,"tenantProducts",product.id,product,`product-${index}`,product.branchId)));
    (payload.stockMovements||[]).forEach((movement,index)=>ops.push(makeFallbackOperation(command,"stockMovements",movement.id,movement,`stock-${index}`,movement.branchId)));
    if(payload.initialPayment)ops.push(makeFallbackOperation(command,"supplierPayments",payload.initialPayment.id,payload.initialPayment,"initial-payment",payload.initialPayment.branchId));
    return ops
  }
  if(command.entityType==="supplierPaymentTransactions"){
    const payload=command.payload as SupplierPaymentTransactionPayload;if(!payload.payment||!payload.purchaseAfter)return[];
    return[makeFallbackOperation(command,"supplierPayments",payload.payment.id,payload.payment,"payment",payload.payment.branchId),makeFallbackOperation(command,"purchases",payload.purchaseAfter.id,payload.purchaseAfter,"purchase",payload.purchaseAfter.branchId)]
  }
  return[]
}
async function pushCommandWithFallback(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,commands:SyncQueueRecord[],rpcName:string,fallbackBuilder:(command:SyncQueueRecord)=>SyncQueueRecord[],invalidMessage:string):Promise<SyncPushResult[]>{
  if(!commands.length)return[];const result=await client.rpc(rpcName,{p_operations:commands});
  if(!result.error)return normalizeRpcResults(commands,result.data);
  if(!isMissingRpc(result.error.message,rpcName))return normalizeRpcResults(commands,undefined,result.error.message);
  const grouped=commands.map(command=>({command,operations:fallbackBuilder(command)})),fallback=grouped.flatMap(group=>group.operations),fallbackResults=await pushGeneric(client,fallback),byId=new Map(fallbackResults.map(item=>[item.operationId,item]));
  return grouped.map(({command,operations})=>{if(!operations.length)return{operationId:command.operationId,ok:false,error:invalidMessage};const failed=operations.map(item=>byId.get(item.operationId)).find(item=>!item?.ok);return failed?{operationId:command.operationId,ok:false,error:failed.error||"No se pudo sincronizar en modo compatible"}:{operationId:command.operationId,ok:true}})
}
async function pushSaleTransactions(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,commands:SyncQueueRecord[]){return pushCommandWithFallback(client,commands,"apply_sale_transactions_v2",fallbackSaleOperations,"Venta local inválida para sincronizar")}
async function pushFinanceTransactions(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,commands:SyncQueueRecord[]){return pushCommandWithFallback(client,commands,"apply_finance_transactions_v2",fallbackFinanceOperations,"Operación financiera local inválida para sincronizar")}
async function pushPurchaseTransactions(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,commands:SyncQueueRecord[]){return pushCommandWithFallback(client,commands,"apply_purchase_transactions_v2",fallbackPurchaseOperations,"Compra o pago local inválido para sincronizar")}
async function pullLegacy(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,tenantId:string,cursor:string):Promise<SyncPullResult>{
  const result=await client.rpc("pull_sync_changes",{p_tenant:tenantId,p_cursor:cursor});if(result.error)throw new Error(result.error.message);
  const payload=result.data&&typeof result.data==="object"?result.data as {cursor?:string;changes?:SyncPullResult["changes"]}:{};const nextCursor=payload.cursor||cursor;return{cursor:nextCursor,hasMore:false,changes:Array.isArray(payload.changes)?payload.changes:[]}
}

const supabaseProvider:KiuboDataProvider={
  mode:"supabase",configured:isSupabaseConfigured(),
  async healthcheck(){const client=getSupabaseBrowserClient();if(!client)return{ok:false,mode:"supabase",configured:false,message:"Faltan URL o publishable key de KIUBO"};const result=await client.from("plans").select("code").limit(1);return result.error?{ok:false,mode:"supabase",configured:true,message:result.error.message}:{ok:true,mode:"supabase",configured:true,message:"KIUBO Cloud conectado"}},
  async pushOperations(operations){
    if(!operations.length)return[];const client=getSupabaseBrowserClient();if(!client)return operations.map(item=>({operationId:item.operationId,ok:false,error:"Cloud no configurado"}));
    const commandTypes=["saleTransactions","cashTransactions","creditPaymentTransactions","purchaseTransactions","supplierPaymentTransactions"] as string[];
    const generic=operations.filter(item=>!commandTypes.includes(item.entityType));
    const sales=operations.filter(item=>item.entityType==="saleTransactions");
    const finance=operations.filter(item=>item.entityType==="cashTransactions"||item.entityType==="creditPaymentTransactions");
    const purchases=operations.filter(item=>item.entityType==="purchaseTransactions"||item.entityType==="supplierPaymentTransactions");
    const results=[...(await pushGeneric(client,generic)),...(await pushSaleTransactions(client,sales)),...(await pushFinanceTransactions(client,finance)),...(await pushPurchaseTransactions(client,purchases))];
    const byId=new Map(results.map(item=>[item.operationId,item]));return operations.map(item=>byId.get(item.operationId)??{operationId:item.operationId,ok:false,error:"Backend no confirmó la operación"})
  },
  async pullChanges(cursor){
    const client=getSupabaseBrowserClient(),tenantId=activeCloudTenant();if(!client||!tenantId)return{changes:[]};
    const cursorIsRevision=Boolean(cursor&&REVISION_RE.test(cursor));
    if(!cursor||cursorIsRevision){
      const revisionCursor=cursorIsRevision?String(cursor):readRevisionCursor(tenantId);const result=await client.rpc("pull_sync_changes_v2",{p_tenant:tenantId,p_after_revision:Number(revisionCursor),p_limit:500});
      if(!result.error){const payload=result.data&&typeof result.data==="object"?result.data as {cursor?:string|number;hasMore?:boolean;changes?:SyncPullResult["changes"]}:{};const nextCursor=String(payload.cursor??revisionCursor);if(!REVISION_RE.test(nextCursor))throw new Error("KIUBO Cloud devolvió un cursor de sincronización inválido.");return{cursor:nextCursor,hasMore:Boolean(payload.hasMore),changes:Array.isArray(payload.changes)?payload.changes:[]}}
      if(!isMissingV2Rpc(result.error.message))throw new Error(result.error.message)
    }
    const legacyCursor=cursor&&!REVISION_RE.test(cursor)?cursor:readTimestampCursor(tenantId);return pullLegacy(client,tenantId,legacyCursor)
  },
  commitCursor(cursor){const tenantId=activeCloudTenant();if(!tenantId||!cursor)return;if(REVISION_RE.test(cursor))writeStoredCursor(CURSOR_V2_PREFIX,tenantId,cursor);else writeStoredCursor(CURSOR_V1_PREFIX,tenantId,cursor)}
};

function cloudDataEnabled(){if(process.env.NEXT_PUBLIC_KIUBO_DATA_MODE==="supabase")return true;return process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase"&&isSupabaseConfigured()}
export function getDataProvider():KiuboDataProvider{return cloudDataEnabled()?supabaseProvider:localProvider}
