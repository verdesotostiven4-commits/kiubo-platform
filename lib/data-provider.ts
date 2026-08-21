import type { SyncPullResult, SyncPushResult, SyncQueueRecord } from "./sync-types";
import { getSupabaseBrowserClient,isSupabaseConfigured } from "./supabase-browser";

export type DataMode = "local" | "supabase";
export type ProviderHealth = { ok:boolean; mode:DataMode; configured:boolean; message?:string };
export type KiuboDataProvider = {mode:DataMode;configured:boolean;healthcheck():Promise<ProviderHealth>;pushOperations(operations:SyncQueueRecord[]):Promise<SyncPushResult[]>;pullChanges(cursor?:string):Promise<SyncPullResult>};

export const localProvider:KiuboDataProvider={mode:"local",configured:false,async healthcheck(){return{ok:true,mode:"local",configured:false,message:"Backend cloud todavía no conectado"}},async pushOperations(operations){return operations.map(item=>({operationId:item.operationId,ok:false,error:"Backend cloud no configurado"}))},async pullChanges(cursor){return{cursor,changes:[]}}};

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
  async pullChanges(cursor){
    const client=getSupabaseBrowserClient();if(!client)return{cursor,changes:[]};
    const result=await client.rpc("pull_sync_changes",{p_cursor:cursor||"1970-01-01T00:00:00.000Z"});
    if(result.error)throw new Error(result.error.message);
    const payload=result.data&&typeof result.data==="object"?result.data as {cursor?:string;changes?:SyncPullResult["changes"]}:{};
    return{cursor:payload.cursor||cursor,changes:Array.isArray(payload.changes)?payload.changes:[]};
  }
};

export function getDataProvider():KiuboDataProvider{return process.env.NEXT_PUBLIC_KIUBO_DATA_MODE==="supabase"?supabaseProvider:localProvider}
