import type { SyncPullResult, SyncPushResult, SyncQueueRecord } from "./sync-types";

export type DataMode = "local" | "supabase";
export type ProviderHealth = { ok:boolean; mode:DataMode; configured:boolean; message?:string };

export type KiuboDataProvider = {
  mode: DataMode;
  configured: boolean;
  healthcheck(): Promise<ProviderHealth>;
  pushOperations(operations:SyncQueueRecord[]): Promise<SyncPushResult[]>;
  pullChanges(cursor?:string): Promise<SyncPullResult>;
};

export const localProvider:KiuboDataProvider={
  mode:"local",
  configured:false,
  async healthcheck(){return{ok:true,mode:"local",configured:false,message:"Backend cloud todavía no conectado"}},
  async pushOperations(operations){return operations.map(item=>({operationId:item.operationId,ok:false,error:"Backend cloud no configurado"}))},
  async pullChanges(cursor){return{cursor,changes:[]}}
};

const pendingSupabaseProvider:KiuboDataProvider={
  mode:"supabase",
  configured:false,
  async healthcheck(){return{ok:false,mode:"supabase",configured:false,message:"Faltan credenciales y adaptador Supabase del proyecto KIUBO"}},
  async pushOperations(operations){return operations.map(item=>({operationId:item.operationId,ok:false,error:"Adaptador Supabase pendiente"}))},
  async pullChanges(cursor){return{cursor,changes:[]}}
};

/**
 * El modo se puede preparar con NEXT_PUBLIC_KIUBO_DATA_MODE=supabase sin
 * acoplar la UI a Supabase. Hasta que exista el proyecto dedicado se usa local.
 */
export function getDataProvider():KiuboDataProvider{
  return process.env.NEXT_PUBLIC_KIUBO_DATA_MODE==="supabase"?pendingSupabaseProvider:localProvider;
}
