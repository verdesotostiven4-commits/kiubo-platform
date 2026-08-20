"use client";
import { useCallback,useEffect,useState } from "react";
import { getDataProvider } from "@/lib/data-provider";
import { runSyncCycle,syncSnapshot } from "@/lib/sync-engine";

export function SyncStatus(){
  const provider=getDataProvider(),[summary,setSummary]=useState(()=>({pending:0,syncing:0,failed:0,synced:0,total:0,cursor:undefined as string|undefined})),[online,setOnline]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const refresh=useCallback(()=>{setSummary(syncSnapshot());setOnline(typeof navigator==="undefined"?true:navigator.onLine)},[]);
  const sync=useCallback(async()=>{if(provider.mode==="local"||!provider.configured||busy)return;setBusy(true);try{const result=await runSyncCycle();setMessage(result.message)}finally{refresh();setBusy(false)}},[busy,provider,refresh]);
  useEffect(()=>{refresh();const timer=window.setInterval(()=>{refresh();if(navigator.onLine&&provider.configured&&!busy&&syncSnapshot().pending>0)void sync()},8000);const onOnline=()=>{refresh();if(provider.configured)void sync()};window.addEventListener("online",onOnline);window.addEventListener("offline",refresh);return()=>{window.clearInterval(timer);window.removeEventListener("online",onOnline);window.removeEventListener("offline",refresh)}},[busy,provider,refresh,sync]);
  const waiting=summary.pending+summary.failed+summary.syncing;
  return <div className="sync-card"><div><strong>{online?"Dispositivo listo":"Sin internet"}</strong><span>{provider.mode==="local"?"Modo local · nube pendiente":provider.configured?"Cloud conectado":"Cloud sin configurar"}</span></div><div className="sync-row"><span className={summary.failed?"sync-badge error":"sync-badge"}>{waiting} pendientes</span><button onClick={()=>void sync()} disabled={busy||!online||provider.mode==="local"||!provider.configured}>{busy?"Sincronizando…":provider.mode==="local"?"Cloud pendiente":!provider.configured?"Configurar cloud":"Sincronizar"}</button></div>{message&&<small>{message}</small>}</div>
}
