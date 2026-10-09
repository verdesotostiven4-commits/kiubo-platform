"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { getDataProvider } from "@/lib/data-provider";
import { runSyncCycle,syncSnapshot } from "@/lib/sync-engine";

export function SyncStatus(){
  const provider=getDataProvider(),[summary,setSummary]=useState(()=>({pending:0,syncing:0,failed:0,synced:0,total:0,cursor:undefined as string|undefined})),[online,setOnline]=useState(true),[cloudVerified,setCloudVerified]=useState(false),[busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const refresh=useCallback(()=>{setSummary(syncSnapshot());setOnline(typeof navigator==="undefined"?true:navigator.onLine)},[]);
  const sync=useCallback(async()=>{
    if(provider.mode==="local"||!provider.configured||busyRef.current||typeof navigator!=="undefined"&&!navigator.onLine)return;
    busyRef.current=true;setBusy(true);
    try{const result=await runSyncCycle();setCloudVerified(result.ok)}catch{setCloudVerified(false)}finally{busyRef.current=false;refresh();setBusy(false)}
  },[provider,refresh]);
  useEffect(()=>{
    refresh();if(typeof navigator!=="undefined"&&navigator.onLine&&provider.configured)void sync();
    const timer=window.setInterval(()=>{refresh();if(navigator.onLine&&provider.configured&&!busyRef.current)void sync()},20000);
    const onOnline=()=>{setCloudVerified(false);refresh();if(provider.configured)void sync()};
    const onOffline=()=>{setCloudVerified(false);refresh()};
    const onFocus=()=>{if(navigator.onLine&&provider.configured)void sync()};
    const onVisibility=()=>{if(document.visibilityState==="visible"&&navigator.onLine&&provider.configured)void sync()};
    window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVisibility);
    return()=>{window.clearInterval(timer);window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVisibility)}
  },[provider.configured,provider.mode,refresh,sync]);
  const waiting=summary.pending+summary.failed+summary.syncing;
  const label=!online?"Sin Internet · caja pausada":provider.mode==="local"?"Modo local":!provider.configured?"Cloud pendiente":waiting?`${waiting} por sincronizar`:cloudVerified?"Cloud conectado":"Comprobando Cloud…";
  return <div className={`sync-compact ${online?"online":"offline"}`}><span className="sync-dot" aria-hidden="true"/><span>{label}</span></div>;
}
