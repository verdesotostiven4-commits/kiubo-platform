"use client";

import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import { loadLocalSession } from "@/lib/local-store";
import { KiuboMark } from "./Logo";
import styles from "./WorkspaceSplash.module.css";

const SKIP_PREFIXES=["/login","/set-password","/auth/","/control","/leads","/demo","/precios","/como-funciona","/receipt","/order-print"];
const SESSION_SPLASH_KEY="kiubo.app.launch-splash.v1";

export function WorkspaceSplash(){
  const pathname=usePathname();
  const[show,setShow]=useState(false);
  useEffect(()=>{
    if(SKIP_PREFIXES.some(prefix=>pathname.startsWith(prefix))||!loadLocalSession())return;
    if(window.sessionStorage.getItem(SESSION_SPLASH_KEY))return;
    window.sessionStorage.setItem(SESSION_SPLASH_KEY,"1");
    setShow(true);
    const timer=window.setTimeout(()=>setShow(false),1050);
    return()=>window.clearTimeout(timer);
  },[pathname]);
  if(!show)return null;
  return <div className={styles.backdrop} aria-hidden="true"><div className={styles.card}><KiuboMark/><span>Todo tu negocio, en orden.</span></div></div>;
}
