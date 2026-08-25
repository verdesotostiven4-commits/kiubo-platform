"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { getDataProvider } from "@/lib/data-provider";
import { runSyncCycle,syncSnapshot } from "@/lib/sync-engine";

export function SyncStatus(){
  const provider=getDataProvider(),[summary,setSummary]=useState(()=>({pending:0,syncing:0,failed:0,synced:0,total:0,cursor:undefined as string|undefined})),[online,setOnline]=useState(true),[busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const refresh=useCallback(()=>{setSummary(syncSnapshot());setOnline(typeof navigator==="undefined"?true:navigator.onLine)},[]);
  const sync=useCallback(async()=>{
    if(provider.mode==="local"||!provider.configured||busyRef.current||typeof navigator!=="undefined"&&!navigator.onLine)return;
    busyRef.current=true;setBusy(true);
    try{await runSyncCycle()}catch{}finally{busyRef.current=false;refresh();setBusy(false)}
  },[provider,refresh]);
  useEffect(()=>{
    refresh();if(typeof navigator!=="undefined"&&navigator.onLine&&provider.configured)void sync();
    const timer=window.setInterval(()=>{refresh();if(navigator.onLine&&provider.configured&&!busyRef.current)void sync()},20000);
    const onOnline=()=>{refresh();if(provider.configured)void sync()};
    const onFocus=()=>{if(navigator.onLine&&provider.configured)void sync()};
    const onVisibility=()=>{if(document.visibilityState==="visible"&&navigator.onLine&&provider.configured)void sync()};
    window.addEventListener("online",onOnline);window.addEventListener("offline",refresh);window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.clearInterval(timer);window.removeEventListener("online",onOnline);window.removeEventListener("offline",refresh);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisibility)}
  },[provider.configured,provider.mode,refresh,sync]);
  const waiting=summary.pending+summary.failed+summary.syncing;
  const label=!online?"Sin internet":provider.mode==="local"?"Modo local":!provider.configured?"Cloud pendiente":waiting?`${waiting} por sincronizar`:"Cloud conectado";
  return <div className={`sync-compact ${online?"online":"offline"}`}><span className="sync-dot" aria-hidden="true"/><span>{label}</span>{provider.configured&&provider.mode!=="local"&&<button type="button" aria-label="Sincronizar ahora" title="Sincronizar ahora" onClick={()=>void sync()} disabled={busy||!online}>{busy?"…":"↻"}</button>}</div>;
}
