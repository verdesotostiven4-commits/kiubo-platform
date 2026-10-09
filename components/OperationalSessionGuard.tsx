"use client";

import { useCallback,useEffect,useRef,useState } from "react";
import { usePathname } from "next/navigation";
import { getLocalDeviceId,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { claimOperationalSession,heartbeatOperationalSession,rememberOperationalLease,forgetOperationalLease,transferOperationalSession,type OperationalSessionState } from "@/lib/operational-session";
import styles from "./OperationalSessionGuard.module.css";

const HEARTBEAT_MS=20_000;
const platformPath=(path:string)=>path.startsWith("/control")||path.startsWith("/leads");

export function OperationalSessionGuard(){
  const path=usePathname();
  const[checking,setChecking]=useState(false);
  const[conflict,setConflict]=useState<OperationalSessionState|null>(null);
  const[busy,setBusy]=useState(false);
  const[tenantId,setTenantId]=useState("");
  const[deviceId,setDeviceId]=useState("");
  const claimedKey=useRef("");

  const verify=useCallback(async(currentTenant:string,currentDevice:string)=>{
    // A single transient request timeout must not abruptly block a busy POS.
    // Do not permit new transactions offline: operation push also has its own
    // lease check, independent of this UI's heartbeat.
    for(let attempt=0;attempt<2;attempt++){
      try{
        const state=await heartbeatOperationalSession(currentTenant,currentDevice);
        if(state.granted||state.bypassed)rememberOperationalLease(currentTenant,currentDevice);
        else forgetOperationalLease(currentTenant,currentDevice);
        setConflict(state.granted||state.bypassed?null:state);
        return state;
      }catch{
        if(attempt===0&&typeof navigator!=="undefined"&&navigator.onLine){
          await new Promise(resolve=>window.setTimeout(resolve,700));
          continue;
        }
      }
    }
    const offline={granted:false,conflict:true,offline:true} satisfies OperationalSessionState;
    setConflict(offline);
    return offline;
  },[]);

  useEffect(()=>{
    let cancelled=false;
    if(platformPath(path)){claimedKey.current="";setChecking(false);setConflict(null);return}
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
    if(!ctx.user||ctx.user.platformAdmin||ctx.tenant?.plan==="Internal"){setChecking(false);setConflict(null);return}

    const tenant=ctx.tenantId,device=getLocalDeviceId();
    const key=`${tenant}:${ctx.user.id}:${device}`;
    // Navigation must preserve the heartbeat. Previously this early return
    // silently disabled cross-device enforcement after the first route change.
    const mustClaim=claimedKey.current!==key;
    claimedKey.current=key;
    setTenantId(tenant);setDeviceId(device);
    setChecking(mustClaim);

    void(async()=>{
      try{
        const state=mustClaim?await claimOperationalSession(tenant,device):await heartbeatOperationalSession(tenant,device);
        if(cancelled)return;
        if(state.granted||state.bypassed)rememberOperationalLease(tenant,device);
        else forgetOperationalLease(tenant,device);
        setConflict(!state.granted&&!state.bypassed?state:null);
      }catch{
        if(!cancelled)setConflict({granted:false,conflict:true,offline:true});
      }finally{
        if(!cancelled)setChecking(false);
      }
    })();

    const timer=window.setInterval(()=>{if(!cancelled)void verify(tenant,device)},HEARTBEAT_MS);
    const onVisible=()=>{if(!cancelled&&document.visibilityState==="visible")void verify(tenant,device)};
    document.addEventListener("visibilitychange",onVisible);
    const onOnline=()=>{if(!cancelled)void verify(tenant,device)};
    const onLeaseBlocked=()=>{if(!cancelled)void verify(tenant,device)};
    window.addEventListener("online",onOnline);
    window.addEventListener("kiubo:operational-session-blocked",onLeaseBlocked);
    return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("online",onOnline);window.removeEventListener("kiubo:operational-session-blocked",onLeaseBlocked)};
  },[path,verify]);

  useEffect(()=>{
    if(!conflict)return;
    const block=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation()};
    window.addEventListener("keydown",block,true);
    return()=>window.removeEventListener("keydown",block,true);
  },[conflict]);

  const takeOver=async()=>{
    if(!tenantId||!deviceId||busy)return;
    setBusy(true);
    try{
      const state=await transferOperationalSession(tenantId,deviceId);
      if(state.granted||state.bypassed)rememberOperationalLease(tenantId,deviceId);
      setConflict(!state.granted&&!state.bypassed?state:null);
    }catch{
      setConflict(current=>current??{granted:false,conflict:true});
    }finally{setBusy(false)}
  };

  const retry=async()=>{
    if(!tenantId||!deviceId||busy)return;
    setBusy(true);
    try{
      const state=await claimOperationalSession(tenantId,deviceId);
      if(state.granted||state.bypassed)rememberOperationalLease(tenantId,deviceId);
      setConflict(!state.granted&&!state.bypassed?state:null);
    }catch{setConflict({granted:false,conflict:true,offline:true})}finally{setBusy(false)}
  };

  // The initial claim runs in the background. Showing a full-screen loader on
  // every route change made the POS feel blocked even when validation was
  // already succeeding. A real conflict still renders the blocking dialog.
  if(checking&&!conflict)return <div className={styles.backdrop} role="status" aria-live="polite">
    <section className={styles.card}><div className={styles.icon}>K</div><h2>Verificando dispositivo autorizado…</h2>
      <p>Confirmando que esta caja no esté activa en otro dispositivo.</p></section>
  </div>;
  if(!conflict)return null;

  return <div className={styles.backdrop} role="presentation">
    <section className={styles.card} role="dialog" aria-modal="true" aria-labelledby="kiubo-device-title">
      <div className={styles.icon}>K</div>
      <span className={styles.kicker}>SESIÓN OPERATIVA</span>
      {conflict.offline?<>
        <h2 id="kiubo-device-title">No se pudo validar este dispositivo</h2>
        <p>KIUBO necesita conexión para asegurar que esta caja no está activa en otro equipo. Sin conexión no puede garantizarse el bloqueo exclusivo.</p>
        <p className={styles.hint}>Los pedidos y cobros ya guardados se conservan. Al volver Internet, KIUBO intentará validar automáticamente esta caja; si continúa el aviso, pulsa <strong>Reintentar</strong>. No borres datos del navegador ni cambies de dispositivo con cobros sin sincronizar.</p>
      </>:<>
        <h2 id="kiubo-device-title">KIUBO ya está activo en otro dispositivo</h2>
        <p>Este negocio tiene <strong>un único dispositivo operativo</strong>, incluso si ingresan usuarios distintos. Para continuar aquí debes transferir el control; el equipo anterior quedará bloqueado al detectar el cambio.</p>
        <div className={styles.device}>
          <span>Dispositivo activo</span>
          <strong>{conflict.activeDeviceLabel||"Otro dispositivo"}</strong>
          <small>{conflict.lastSeenAt?"Con actividad reciente en KIUBO":"Sesión Cloud activa"}</small>
        </div>
        <p className={styles.hint}>Antes de cambiar de equipo, verifica en el dispositivo anterior que KIUBO indique sincronización completa y que no queden cobros ni pedidos pendientes de envío. Si hay operaciones sin sincronizar, primero recupéralas en ese equipo; cambiar de dispositivo no las copia automáticamente. Después puedes transferir el control aquí.</p>
      </>}
      <div className={styles.actions}>
        {!conflict.offline&&<button className={styles.primary} disabled={busy} onClick={()=>void takeOver()}>{busy?"Transfiriendo…":"Usar KIUBO en este dispositivo"}</button>}
        <button className={styles.secondary} disabled={busy} onClick={()=>void retry()}>Reintentar</button>
      </div>
    </section>
  </div>;
}
