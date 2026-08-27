"use client";

import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import { loadLocalSession } from "@/lib/local-store";
import { KIUBO_LOGO_DARK_BG_URL } from "@/lib/kiubo-brand-assets";
import styles from "./WorkspaceSplash.module.css";

const SKIP_PREFIXES=["/login","/set-password","/auth/","/control","/leads","/demo","/precios","/como-funciona","/receipt","/order-print"];
const SESSION_SPLASH_KEY="kiubo.app.launch-splash.v2";
const STAGES=["Preparando tu espacio","Sincronizando tu negocio","Ordenando ventas e inventario","Todo listo"];
const SPLASH_MS=5600;

export function WorkspaceSplash(){
  const pathname=usePathname();
  const[show,setShow]=useState(false);
  const[stage,setStage]=useState(0);

  useEffect(()=>{
    if(SKIP_PREFIXES.some(prefix=>pathname.startsWith(prefix))||!loadLocalSession())return;
    if(window.sessionStorage.getItem(SESSION_SPLASH_KEY))return;
    window.sessionStorage.setItem(SESSION_SPLASH_KEY,"1");
    setStage(0);
    setShow(true);
    const stageTimers=[1250,2550,3900].map((delay,index)=>window.setTimeout(()=>setStage(index+1),delay));
    const closeTimer=window.setTimeout(()=>setShow(false),SPLASH_MS);
    return()=>{stageTimers.forEach(window.clearTimeout);window.clearTimeout(closeTimer)};
  },[pathname]);

  useEffect(()=>{
    if(!show)return;
    const root=document.documentElement,body=document.body;
    const rootOverflow=root.style.overflow,bodyOverflow=body.style.overflow;
    const rootOverscroll=root.style.overscrollBehavior,bodyOverscroll=body.style.overscrollBehavior;
    root.style.overflow="hidden";body.style.overflow="hidden";
    root.style.overscrollBehavior="none";body.style.overscrollBehavior="none";
    return()=>{root.style.overflow=rootOverflow;body.style.overflow=bodyOverflow;root.style.overscrollBehavior=rootOverscroll;body.style.overscrollBehavior=bodyOverscroll};
  },[show]);

  if(!show)return null;
  return <div className={styles.backdrop} role="status" aria-live="polite" aria-label="KIUBO está iniciando">
    <div className={styles.ambientOne}/><div className={styles.ambientTwo}/>
    <div className={styles.orbit} aria-hidden="true"><i/><i/><i/></div>
    <div className={styles.stage}>
      <div className={styles.logoHalo}><img src={KIUBO_LOGO_DARK_BG_URL} className={styles.logo} alt="KIUBO" draggable={false}/></div>
      <div className={styles.tagline}>Todo tu negocio, <strong>en orden.</strong></div>
      <div className={styles.progress} aria-hidden="true"><span/></div>
      <div className={styles.status} key={stage}>{STAGES[stage]}</div>
      <div className={styles.trustRow} aria-hidden="true"><span>Seguro</span><i/><span>En la nube</span><i/><span>Listo para vender</span></div>
    </div>
  </div>;
}
