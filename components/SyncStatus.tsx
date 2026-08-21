"use client";
import { useCallback,useEffect,useState } from "react";
import { getDataProvider } from "@/lib/data-provider";
import { runSyncCycle,syncSnapshot } from "@/lib/sync-engine";

export function SyncStatus(){
  const provider=getDataProvider(),[summary,setSummary]=useState(()=>({pending:0,syncing:0,failed:0,synced:0,total:0,cursor:undefined as string|undefined})),[online,setOnline]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const refresh=useCallback(()=>{setSummary(syncSnapshot());setOnline(typeof navigator==="undefined"?true:navigator.onLine)},[]);
  const sync=useCallback(async()=>{if(provider.mode==="local"||!provider.configured||busy||typeof navigator!=="undefined"&&!navigator.onLine)return;setBusy(true);try{const result=await runSyncCycle();setMessage(result.message)}catch(error){setMessage(error instanceof Error?error.message:"No se pudo sincronizar")}finally{refresh();setBusy(false)}},[busy,provider,refresh]);
  useEffect(()=>{
    refresh();if(typeof navigator!=="undefined"&&navigator.onLine&&provider.configured)void sync();
    const timer=window.setInterval(()=>{refresh();if(navigator.onLine&&provider.configured&&!busy)void sync()},20000);
    const onOnline=()=>{refresh();if(provider.configured)void sync()};
    const onFocus=()=>{if(navigator.onLine&&provider.configured)void sync()};
    const onVisibility=()=>{if(document.visibilityState==="visible"&&navigator.onLine&&provider.configured)void sync()};
    window.addEventListener("online",onOnline);window.addEventListener("offline",refresh);window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.clearInterval(timer);window.removeEventListener("online",onOnline);window.removeEventListener("offline",refresh);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisibility)}
  },[busy,provider,refresh,sync]);
  const waiting=summary.pending+summary.failed+summary.syncing;
  return <div className="sync-card"><div><strong>{online?"Dispositivo listo":"Sin internet"}</strong><span>{provider.mode==="local"?"Modo local · nube pendiente":provider.configured?"Cloud conectado":"Cloud sin configurar"}</span></div><div className="sync-row"><span className={summary.failed?"sync-badge error":"sync-badge"}>{waiting} pendientes</span><button onClick={()=>void sync()} disabled={busy||!online||provider.mode==="local"||!provider.configured}>{busy?"Sincronizando…":provider.mode==="local"?"Cloud pendiente":!provider.configured?"Configurar cloud":"Sincronizar ahora"}</button></div>{message&&<small>{message}</small>}</div>
}
