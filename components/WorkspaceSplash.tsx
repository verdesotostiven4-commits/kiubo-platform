"use client";

import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import { getTenantBranding,getTenantSettings,getWorkspaceContext,loadLocalDatabase,loadLocalSession } from "@/lib/local-store";
import styles from "./WorkspaceSplash.module.css";

const SKIP_PREFIXES=["/login","/set-password","/auth/","/control","/leads","/demo","/precios","/como-funciona"];
const SIX_HOURS=6*60*60*1000;

export function WorkspaceSplash(){
  const pathname=usePathname();
  const[state,setState]=useState<{show:boolean;name:string;logo:string;color:string}>({show:false,name:"",logo:"",color:"#0b5a42"});
  useEffect(()=>{
    if(SKIP_PREFIXES.some(prefix=>pathname.startsWith(prefix)))return;
    if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db),session=loadLocalSession();
    if(!ctx.tenant||ctx.tenant.plan==="Internal"||!session)return;
    const settings=getTenantSettings(db,ctx.tenantId);if(!settings.splashEnabled)return;
    const branding=getTenantBranding(db,ctx.tenantId),today=new Date().toISOString().slice(0,10);
    const key=`kiubo.workspace.splash.v2:${ctx.tenantId}`;
    let prior:{day?:string;shownAt?:number;sessionStartedAt?:string}|null=null;
    try{prior=JSON.parse(window.localStorage.getItem(key)||"null") as typeof prior}catch{prior=null}
    const now=Date.now(),freshSession=prior?.sessionStartedAt!==session.startedAt,stale=!prior?.shownAt||now-prior.shownAt>SIX_HOURS;
    if(prior?.day===today&&!freshSession&&!stale)return;
    window.localStorage.setItem(key,JSON.stringify({day:today,shownAt:now,sessionStartedAt:session.startedAt}));
    setState({show:true,name:branding.businessName||settings.tradeName||ctx.tenant.name,logo:branding.logoUrl||"",color:branding.primaryColor||settings.accent||"#0b5a42"});
    const timer=window.setTimeout(()=>setState(current=>({...current,show:false})),1450);
    return()=>window.clearTimeout(timer);
  },[pathname]);
  if(!state.show)return null;
  return <div className={styles.backdrop} style={{"--brand":state.color} as React.CSSProperties} aria-hidden="true">
    <div className={styles.card}>
      {state.logo?<img className={styles.logo} src={state.logo} alt=""/>:<div className={styles.monogram}>{state.name.slice(0,2).toUpperCase()}</div>}
      <strong>{state.name}</strong>
      <span>Todo listo para trabajar.</span>
      <small>Gestionado con KIUBO</small>
    </div>
  </div>;
}
