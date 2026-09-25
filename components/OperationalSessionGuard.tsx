"use client";

import { useCallback,useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import { getLocalDeviceId,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { claimOperationalSession,heartbeatOperationalSession,transferOperationalSession,type OperationalSessionState } from "@/lib/operational-session";
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

  const verify=useCallback(async(currentTenant:string,currentDevice:string)=>{
    try{
      const state=await heartbeatOperationalSession(currentTenant,currentDevice);
      if(!state.granted&&!state.bypassed)setConflict(state);
      else setConflict(null);
      return state;
    }catch{
      // Fail closed: without Cloud validation we cannot guarantee one-device operation.
      return {granted:false,conflict:true,offline:true} satisfies OperationalSessionState;
    }
  },[]);

  useEffect(()=>{
    let cancelled=false;
    if(platformPath(path)){setChecking(false);setConflict(null);return}
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
    if(!ctx.user||ctx.user.platformAdmin||ctx.tenant?.plan==="Internal"){setChecking(false);setConflict(null);return}

    const tenant=ctx.tenantId,device=getLocalDeviceId();
    setTenantId(tenant);setDeviceId(device);setChecking(true);

    void(async()=>{
      try{
        const state=await claimOperationalSession(tenant,device);
        if(cancelled)return;
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
    return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible)};
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
      setConflict(!state.granted&&!state.bypassed?state:null);
    }catch{setConflict({granted:false,conflict:true,offline:true})}finally{setBusy(false)}
  };

  if(checking&&!conflict)return <div className={styles.checking} role="status"><span className={styles.spinner}/><strong>Confirmando dispositivo…</strong></div>;
  if(!conflict)return null;

  return <div className={styles.backdrop} role="presentation">
    <section className={styles.card} role="dialog" aria-modal="true" aria-labelledby="kiubo-device-title">
      <div className={styles.icon}>K</div>
      <span className={styles.kicker}>SESIÓN OPERATIVA</span>
      {conflict.offline?<>
        <h2 id="kiubo-device-title">No se pudo validar este dispositivo</h2>
        <p>KIUBO necesita conexión con el servidor para confirmar que esta cuenta no esté activa en otro equipo.</p>
        <p className={styles.hint}>Cuando vuelva la conexión, pulsa <strong>Reintentar</strong>. El sistema queda bloqueado hasta validar la sesión.</p>
      </>:<>
        <h2 id="kiubo-device-title">KIUBO ya está activo en otro dispositivo</h2>
        <p>Este acceso puede trabajar operativamente en <strong>un dispositivo a la vez</strong>. Así evitamos pedidos, caja o mesas duplicadas con la misma cuenta.</p>
        <div className={styles.device}>
          <span>Dispositivo activo</span>
          <strong>{conflict.activeDeviceLabel||"Otro dispositivo"}</strong>
          <small>{conflict.lastSeenAt?"Con actividad reciente en KIUBO":"Sesión Cloud activa"}</small>
        </div>
        <p className={styles.hint}>Si cerraste KIUBO en el otro equipo o ahora necesitas continuar aquí, puedes transferir el control. El otro dispositivo quedará bloqueado para operar, pero sus cambios pendientes podrán terminar de sincronizarse.</p>
      </>}
      <div className={styles.actions}>
        {!conflict.offline&&<button className={styles.primary} disabled={busy} onClick={()=>void takeOver()}>{busy?"Transfiriendo…":"Usar KIUBO en este dispositivo"}</button>}
        <button className={styles.secondary} disabled={busy} onClick={()=>void retry()}>Reintentar</button>
      </div>
    </section>
  </div>;
}
