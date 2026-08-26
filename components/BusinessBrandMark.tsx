"use client";

import { useEffect,useState } from "react";
import { getTenantBranding,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { KiuboMark } from "./Logo";
import { KiuboWordmark } from "./KiuboWordmark";

export function BusinessBrandMark(){
  const[data,setData]=useState<{custom:boolean;name:string;logo:string}|null>(null);
  useEffect(()=>{
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db),branding=getTenantBranding(db,ctx.tenantId);
    setData({custom:ctx.tenant?.plan==="Custom",name:branding.businessName||ctx.tenant?.name||"Negocio",logo:branding.logoUrl||""});
  },[]);
  if(!data||!data.custom)return <KiuboMark/>;
  return <div className="business-brand business-brand-custom">
    <div className="business-brand-logo">{data.logo?<img src={data.logo} alt={data.name}/>:<strong>{data.name.slice(0,1).toUpperCase()}</strong>}</div>
    <div className="business-brand-copy"><small>NEGOCIO</small><strong>{data.name}</strong><span>Gestionado con <KiuboWordmark/></span></div>
  </div>;
}
