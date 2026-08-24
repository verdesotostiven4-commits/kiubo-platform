import type { SyncPullResult, SyncPushResult, SyncQueueRecord } from "./sync-types";
import { getSupabaseBrowserClient,isSupabaseConfigured } from "./supabase-browser";
import { getWorkspaceContext,loadLocalDatabase } from "./local-store";

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

export const localProvider:KiuboDataProvider={
  mode:"local",
  configured:false,
  async healthcheck(){return{ok:true,mode:"local",configured:false,message:"Backend cloud todavía no conectado"}},
  async pushOperations(operations){return operations.map(item=>({operationId:item.operationId,ok:false,error:"Backend cloud no configurado"}))},
  async pullChanges(cursor){return{cursor,changes:[]}},
  commitCursor(){}
};

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVISION_RE=/^\d+$/;
const CURSOR_V1_PREFIX="kiubo.cloud.cursor.v1:";
const CURSOR_V2_PREFIX="kiubo.cloud.cursor.v2:";

function activeCloudTenant(){
  const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
  if(!ctx.tenant||ctx.tenant.plan==="Internal"||!UUID_RE.test(ctx.tenantId))return null;
  return ctx.tenantId;
}
function readStoredCursor(prefix:string,tenantId:string,fallback:string){
  if(typeof window==="undefined")return fallback;
  return window.localStorage.getItem(`${prefix}${tenantId}`)||fallback;
}
function readRevisionCursor(tenantId:string){
  const cursor=readStoredCursor(CURSOR_V2_PREFIX,tenantId,"0");
  return REVISION_RE.test(cursor)?cursor:"0";
}
function readTimestampCursor(tenantId:string){
  return readStoredCursor(CURSOR_V1_PREFIX,tenantId,"1970-01-01T00:00:00.000Z");
}
function writeStoredCursor(prefix:string,tenantId:string,cursor?:string){
  if(typeof window!=="undefined"&&cursor)window.localStorage.setItem(`${prefix}${tenantId}`,cursor);
}
function isMissingV2Rpc(message:string){
  const lower=message.toLowerCase();
  return lower.includes("pull_sync_changes_v2")&&(lower.includes("could not find")||lower.includes("does not exist")||lower.includes("schema cache"));
}
async function pullLegacy(
  client:NonNullable<ReturnType<typeof getSupabaseBrowserClient>>,
  tenantId:string,
  cursor:string
):Promise<SyncPullResult>{
  const result=await client.rpc("pull_sync_changes",{p_tenant:tenantId,p_cursor:cursor});
  if(result.error)throw new Error(result.error.message);
  const payload=result.data&&typeof result.data==="object"?result.data as {cursor?:string;changes?:SyncPullResult["changes"]}:{};
  const nextCursor=payload.cursor||cursor;
  return{cursor:nextCursor,hasMore:false,changes:Array.isArray(payload.changes)?payload.changes:[]};
}

const supabaseProvider:KiuboDataProvider={
  mode:"supabase",
  configured:isSupabaseConfigured(),
  async healthcheck(){
    const client=getSupabaseBrowserClient();
    if(!client)return{ok:false,mode:"supabase",configured:false,message:"Faltan URL o publishable key de KIUBO"};
    const result=await client.from("plans").select("code").limit(1);
    return result.error?{ok:false,mode:"supabase",configured:true,message:result.error.message}:{ok:true,mode:"supabase",configured:true,message:"KIUBO Cloud conectado"};
  },
  async pushOperations(operations){
    if(!operations.length)return[];
    const client=getSupabaseBrowserClient();
    if(!client)return operations.map(item=>({operationId:item.operationId,ok:false,error:"Cloud no configurado"}));
    const result=await client.rpc("apply_sync_operations",{p_operations:operations});
    if(result.error)return operations.map(item=>({operationId:item.operationId,ok:false,error:result.error.message}));
    const rows=Array.isArray(result.data)?result.data as Array<{operationId?:string;ok?:boolean;error?:string}>:[];
    return operations.map(item=>{
      const row=rows.find(candidate=>candidate.operationId===item.operationId);
      return{operationId:item.operationId,ok:Boolean(row?.ok),error:row?.error||(!row?"Backend no confirmó la operación":undefined)};
    });
  },
  async pullChanges(cursor){
    const client=getSupabaseBrowserClient(),tenantId=activeCloudTenant();
    if(!client||!tenantId)return{changes:[]};

    const cursorIsRevision=Boolean(cursor&&REVISION_RE.test(cursor));
    if(!cursor||cursorIsRevision){
      const revisionCursor=cursorIsRevision?String(cursor):readRevisionCursor(tenantId);
      const result=await client.rpc("pull_sync_changes_v2",{
        p_tenant:tenantId,
        p_after_revision:Number(revisionCursor),
        p_limit:500
      });
      if(!result.error){
        const payload=result.data&&typeof result.data==="object"
          ? result.data as {cursor?:string|number;hasMore?:boolean;changes?:SyncPullResult["changes"]}
          : {};
        const nextCursor=String(payload.cursor??revisionCursor);
        if(!REVISION_RE.test(nextCursor))throw new Error("KIUBO Cloud devolvió un cursor de sincronización inválido.");
        return{
          cursor:nextCursor,
          hasMore:Boolean(payload.hasMore),
          changes:Array.isArray(payload.changes)?payload.changes:[]
        };
      }
      if(!isMissingV2Rpc(result.error.message))throw new Error(result.error.message);
    }

    const legacyCursor=cursor&&!REVISION_RE.test(cursor)?cursor:readTimestampCursor(tenantId);
    return pullLegacy(client,tenantId,legacyCursor);
  },
  commitCursor(cursor){
    const tenantId=activeCloudTenant();
    if(!tenantId||!cursor)return;
    if(REVISION_RE.test(cursor))writeStoredCursor(CURSOR_V2_PREFIX,tenantId,cursor);
    else writeStoredCursor(CURSOR_V1_PREFIX,tenantId,cursor);
  }
};

function cloudDataEnabled(){
  if(process.env.NEXT_PUBLIC_KIUBO_DATA_MODE==="supabase")return true;
  return process.env.NEXT_PUBLIC_KIUBO_AUTH_MODE==="supabase"&&isSupabaseConfigured();
}

export function getDataProvider():KiuboDataProvider{return cloudDataEnabled()?supabaseProvider:localProvider}
