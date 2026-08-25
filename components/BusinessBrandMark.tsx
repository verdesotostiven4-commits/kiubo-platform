"use client";

import { useEffect,useState } from "react";
import { getTenantBranding,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { KiuboMark } from "./Logo";

export function BusinessBrandMark(){
  const[data,setData]=useState<{custom:boolean;name:string;logo:string}|null>(null);
  useEffect(()=>{
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db),branding=getTenantBranding(db,ctx.tenantId);
    setData({custom:ctx.tenant?.plan==="Custom",name:branding.businessName||ctx.tenant?.name||"Negocio",logo:branding.logoUrl||""});
  },[]);
  if(!data||!data.custom)return <KiuboMark/>;
  return <div className="business-brand-mark">
    {data.logo?<img src={data.logo} alt={data.name}/>:<strong>{data.name}</strong>}
    <span>{data.name}</span>
    <small>Powered by KIUBO</small>
  </div>;
}
