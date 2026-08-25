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
  return <div style={{display:"grid",justifyItems:"center",gap:4,padding:"10px 8px 6px",minHeight:72}}>
    {data.logo?<img src={data.logo} alt={data.name} style={{display:"block",width:"100%",maxWidth:170,height:58,objectFit:"contain"}}/>:<strong style={{fontSize:22}}>{data.name}</strong>}
    <span style={{fontSize:12,fontWeight:750,letterSpacing:".02em"}}>{data.name}</span>
    <small style={{fontSize:9,opacity:.58,letterSpacing:".08em",textTransform:"uppercase"}}>Powered by KIUBO</small>
  </div>;
}
