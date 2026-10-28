"use client";
import { useCallback,useEffect,useState } from "react";
import { getDataProvider } from "@/lib/data-provider";
import { syncSnapshot } from "@/lib/sync-engine";
import { KIUBO_SYNC_QUEUED_EVENT } from "@/lib/local-store";
import { KIUBO_DATA_REFRESHED,KIUBO_SYNC_CYCLE_COMPLETED } from "./RealtimeSyncRuntime";

export function SyncStatus(){
  const provider=getDataProvider(),[summary,setSummary]=useState(()=>({pending:0,syncing:0,failed:0,synced:0,total:0,cursor:undefined as string|undefined})),[online,setOnline]=useState(true),[cloudVerified,setCloudVerified]=useState(false);
  const refresh=useCallback(()=>{setSummary(syncSnapshot());setOnline(typeof navigator==="undefined"?true:navigator.onLine)},[]);
  useEffect(()=>{
    refresh();
    // RealtimeSyncRuntime already owns the Cloud loop. Do not start a second
    // 20-second Cloud sync and JSON-parsing loop just to display this badge.
    const completed=(event:Event)=>{const detail=(event as CustomEvent<{ok:boolean}>).detail;setCloudVerified(Boolean(detail?.ok));refresh()};
    const connection=()=>{setCloudVerified(false);refresh()};
    const visible=()=>{if(document.visibilityState==="visible")refresh()};
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")refresh()},60_000);
    window.addEventListener(KIUBO_SYNC_CYCLE_COMPLETED,completed);
    window.addEventListener(KIUBO_DATA_REFRESHED,refresh);
    window.addEventListener(KIUBO_SYNC_QUEUED_EVENT,refresh);
    window.addEventListener("online",connection);window.addEventListener("offline",connection);
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",visible);
    return()=>{window.clearInterval(timer);window.removeEventListener(KIUBO_SYNC_CYCLE_COMPLETED,completed);window.removeEventListener(KIUBO_DATA_REFRESHED,refresh);window.removeEventListener(KIUBO_SYNC_QUEUED_EVENT,refresh);window.removeEventListener("online",connection);window.removeEventListener("offline",connection);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",visible)};
  },[refresh]);

  const waiting=summary.pending+summary.failed+summary.syncing;
  const label=!online?"Sin Internet · caja pausada":provider.mode==="local"?"Modo local":!provider.configured?"Cloud pendiente":waiting?`${waiting} por sincronizar`:cloudVerified?"Cloud conectado":"Comprobando Cloud…";
  return <div className={`sync-compact ${online?"online":"offline"}`}><span className="sync-dot" aria-hidden="true"/><span>{label}</span></div>;
}
