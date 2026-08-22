import type { SyncPullResult, SyncPushResult, SyncQueueRecord } from "./sync-types";
import { getSupabaseBrowserClient,isSupabaseConfigured } from "./supabase-browser";
import { getWorkspaceContext,loadLocalDatabase } from "./local-store";

export type DataMode = "local" | "supabase";
export type ProviderHealth = { ok:boolean; mode:DataMode; configured:boolean; message?:string };
export type KiuboDataProvider = {mode:DataMode;configured:boolean;healthcheck():Promise<ProviderHealth>;pushOperations(operations:SyncQueueRecord[]):Promise<SyncPushResult[]>;pullChanges(cursor?:string):Promise<SyncPullResult>};

export const localProvider:KiuboDataProvider={mode:"local",configured:false,async healthcheck(){return{ok:true,mode:"local",configured:false,message:"Backend cloud todavía no conectado"}},async pushOperations(operations){return operations.map(item=>({operationId:item.operationId,ok:false,error:"Backend cloud no configurado"}))},async pullChanges(cursor){return{cursor,changes:[]}}};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURSOR_PREFIX="kiubo.cloud.cursor.v1:";
function activeCloudTenant(){const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);if(!ctx.tenant||ctx.tenant.plan==="Internal"||!UUID_RE.test(ctx.tenantId))return null;return ctx.tenantId}
function readTenantCursor(tenantId:string){if(typeof window==="undefined")return"1970-01-01T00:00:00.000Z";return window.localStorage.getItem(`${CURSOR_PREFIX}${tenantId}`)||"1970-01-01T00:00:00.000Z"}
function writeTenantCursor(tenantId:string,cursor?:string){if(typeof window!=="undefined"&&cursor)window.localStorage.setItem(`${CURSOR_PREFIX}${tenantId}`,cursor)}

const supabaseProvider:KiuboDataProvider={
  mode:"supabase",configured:isSupabaseConfigured(),
  async healthcheck(){const client=getSupabaseBrowserClient();if(!client)return{ok:false,mode:"supabase",configured:false,message:"Faltan URL o publishable key de KIUBO"};const result=await client.from("plans").select("code").limit(1);return result.error?{ok:false,mode:"supabase",configured:true,message:result.error.message}:{ok:true,mode:"supabase",configured:true,message:"KIUBO Cloud conectado"}},
  async pushOperations(operations){
    if(!operations.length)return[];const client=getSupabaseBrowserClient();if(!client)return operations.map(item=>({operationId:item.operationId,ok:false,error:"Cloud no configurado"}));
    const result=await client.rpc("apply_sync_operations",{p_operations:operations});
    if(result.error)return operations.map(item=>({operationId:item.operationId,ok:false,error:result.error.message}));
    const rows=Array.isArray(result.data)?result.data as Array<{operationId?:string;ok?:boolean;error?:string}>:[];
    return operations.map(item=>{const row=rows.find(candidate=>candidate.operationId===item.operationId);return{operationId:item.operationId,ok:Boolean(row?.ok),error:row?.error||(!row?"Backend no confirmó la operación":undefined)}});
  },
  async pullChanges(){
    const client=getSupabaseBrowserClient(),tenantId=activeCloudTenant();if(!client||!tenantId)return{changes:[]};
    const cursor=readTenantCursor(tenantId);
    const result=await client.rpc("pull_sync_changes",{p_tenant:tenantId,p_cursor:cursor});
    if(result.error)throw new Error(result.error.message);
    const payload=result.data&&typeof result.data==="object"?result.data as {cursor?:string;changes?:SyncPullResult["changes"]}:{};
    const nextCursor=payload.cursor||cursor;writeTenantCursor(tenantId,nextCursor);
    return{cursor:nextCursor,changes:Array.isArray(payload.changes)?payload.changes:[]};
  }
};

function cloudDataEnabled(){
  if(process.env.NEXT_PUBLIC_KIUBO_DATA_MODE==="supabase")return true;
  return process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase"&&isSupabaseConfigured();
}

export function getDataProvider():KiuboDataProvider{return cloudDataEnabled()?supabaseProvider:localProvider}
