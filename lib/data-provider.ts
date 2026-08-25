import {getWorkspaceContext,loadLocalDatabase} from "./local-store";
import type {SyncPullResult,SyncPushResult,SyncQueueRecord} from "./sync-types";
import {getSupabaseBrowserClient,isSupabaseConfigured} from "./supabase-browser";

export type DataMode="local"|"supabase";
export type ProviderHealth={ok:boolean;mode:DataMode;configured:boolean;message?:string};
export type KiuboDataProvider={mode:DataMode;configured:boolean;healthcheck():Promise<ProviderHealth>;pushOperations(operations:SyncQueueRecord[]):Promise<SyncPushResult[]>;pullChanges(cursor?:string):Promise<SyncPullResult>;commitCursor(cursor?:string):void};

export const localProvider:KiuboDataProvider={mode:"local",configured:false,async healthcheck(){return{ok:true,mode:"local",configured:false,message:"Backend cloud todavía no conectado"}},async pushOperations(operations){return operations.map(item=>({operationId:item.operationId,ok:false,error:"Backend cloud no configurado"}))},async pullChanges(cursor){return{cursor,changes:[]}},commitCursor(){}};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,REVISION_RE=/^\d+$/;
const CURSOR_V1_PREFIX="kiubo.cloud.cursor.v1:",CURSOR_V2_PREFIX="kiubo.cloud.cursor.v2:";
function activeTenant(){const ctx=getWorkspaceContext(loadLocalDatabase());return ctx.tenant&&ctx.tenant.plan!=="Internal"&&UUID_RE.test(ctx.tenantId)?ctx.tenantId:null}
function read(prefix:string,tenant:string,fallback:string){return typeof window==="undefined"?fallback:window.localStorage.getItem(prefix+tenant)||fallback}
function write(prefix:string,tenant:string,cursor?:string){if(typeof window!=="undefined"&&cursor)window.localStorage.setItem(prefix+tenant,cursor)}
function missingRpc(message:string,name:string){const text=message.toLowerCase();return text.includes(name.toLowerCase())&&(text.includes("could not find")||text.includes("does not exist")||text.includes("schema cache"))}
function isMissingV2Rpc(message:string){return missingRpc(message,"pull_sync_changes_v2")}
function normalize(ops:SyncQueueRecord[],data:unknown,error?:string):SyncPushResult[]{if(error)return ops.map(x=>({operationId:x.operationId,ok:false,error}));const rows=Array.isArray(data)?data as {operationId?:string;ok?:boolean;error?:string}[]:[];return ops.map(op=>{const row=rows.find(x=>x.operationId===op.operationId);return{operationId:op.operationId,ok:Boolean(row?.ok),error:row?.error||(!row?"Backend no confirmó la operación":undefined)}})}
async function generic(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,ops:SyncQueueRecord[]){if(!ops.length)return[];const r=await client.rpc("apply_sync_operations",{p_operations:ops});return normalize(ops,r.data,r.error?.message)}
async function atomicOnlyCommand(client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,ops:SyncQueueRecord[],rpc:string,missingMessage:string){if(!ops.length)return[];const r=await client.rpc(rpc,{p_operations:ops});if(r.error&&missingRpc(r.error.message,rpc))return ops.map(x=>({operationId:x.operationId,ok:false,error:missingMessage}));return normalize(ops,r.data,r.error?.message)}

const supabaseProvider:KiuboDataProvider={
  mode:"supabase",
  configured:isSupabaseConfigured(),
  async healthcheck(){
    const c=getSupabaseBrowserClient();
    if(!c)return{ok:false,mode:"supabase",configured:false,message:"Faltan URL o publishable key de KIUBO"};
    const r=await c.from("plans").select("code").limit(1);
    return r.error?{ok:false,mode:"supabase",configured:true,message:r.error.message}:{ok:true,mode:"supabase",configured:true,message:"KIUBO Cloud conectado"};
  },
  async pushOperations(ops){
    if(!ops.length)return[];
    const c=getSupabaseBrowserClient();
    if(!c)return ops.map(x=>({operationId:x.operationId,ok:false,error:"Cloud no configurado"}));
    const commands=new Set(["saleTransactions","saleReversalTransactions","cashTransactions","creditPaymentTransactions","purchaseTransactions","supplierPaymentTransactions","inventoryAdjustmentTransactions"]);
    const genericOps=ops.filter(x=>!commands.has(x.entityType));
    const sales=ops.filter(x=>x.entityType==="saleTransactions");
    const reversals=ops.filter(x=>x.entityType==="saleReversalTransactions");
    const finance=ops.filter(x=>x.entityType==="cashTransactions"||x.entityType==="creditPaymentTransactions");
    const purchases=ops.filter(x=>x.entityType==="purchaseTransactions"||x.entityType==="supplierPaymentTransactions");
    const adjustments=ops.filter(x=>x.entityType==="inventoryAdjustmentTransactions");
    const all=[
      ...(await generic(c,genericOps)),
      ...(await atomicOnlyCommand(c,sales,"apply_sale_transactions_v2","Motor Cloud de ventas pendiente de activación")),
      ...(await atomicOnlyCommand(c,reversals,"apply_sale_reversals_v1","Motor Cloud de anulaciones pendiente de activación")),
      ...(await atomicOnlyCommand(c,finance,"apply_finance_transactions_v2","Motor Cloud de caja y fiados pendiente de activación")),
      ...(await atomicOnlyCommand(c,purchases,"apply_purchase_transactions_v3","Motor Cloud de compras y pagos pendiente de activación")),
      ...(await atomicOnlyCommand(c,adjustments,"apply_inventory_adjustments_v2","Motor Cloud de ajustes de inventario pendiente de activación")),
    ];
    const byId=new Map(all.map(x=>[x.operationId,x]));
    return ops.map(x=>byId.get(x.operationId)??{operationId:x.operationId,ok:false,error:"Backend no confirmó la operación"});
  },
  async pullChanges(cursor){
    const c=getSupabaseBrowserClient(),tenant=activeTenant();
    if(!c||!tenant)return{changes:[]};
    const revision=Boolean(cursor&&REVISION_RE.test(cursor));
    if(!cursor||revision){
      const after=revision?String(cursor):read(CURSOR_V2_PREFIX,tenant,"0"),r=await c.rpc("pull_sync_changes_v2",{p_tenant:tenant,p_after_revision:Number(after),p_limit:500});
      if(!r.error){
        const p=r.data&&typeof r.data==="object"?r.data as {cursor?:string|number;hasMore?:boolean;changes?:SyncPullResult["changes"]}:{};
        const next=String(p.cursor??after);
        if(!REVISION_RE.test(next))throw new Error("KIUBO Cloud devolvió un cursor de sincronización inválido.");
        return{cursor:next,hasMore:Boolean(p.hasMore),changes:Array.isArray(p.changes)?p.changes:[]};
      }
      if(!isMissingV2Rpc(r.error.message))throw new Error(r.error.message);
    }
    const legacy=cursor&&!REVISION_RE.test(cursor)?cursor:read(CURSOR_V1_PREFIX,tenant,"1970-01-01T00:00:00.000Z"),r=await c.rpc("pull_sync_changes",{p_tenant:tenant,p_cursor:legacy});
    if(r.error)throw new Error(r.error.message);
    const p=r.data&&typeof r.data==="object"?r.data as {cursor?:string;changes?:SyncPullResult["changes"]}:{};
    return{cursor:p.cursor||legacy,hasMore:false,changes:Array.isArray(p.changes)?p.changes:[]};
  },
  commitCursor(cursor){const tenant=activeTenant();if(!tenant||!cursor)return;write(REVISION_RE.test(cursor)?CURSOR_V2_PREFIX:CURSOR_V1_PREFIX,tenant,cursor)}
};

function cloud(){return process.env.NEXT_PUBLIC_KIUBO_DATA_MODE==="supabase"||(process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase"&&isSupabaseConfigured())}
export function getDataProvider():KiuboDataProvider{return cloud()?supabaseProvider:localProvider}
