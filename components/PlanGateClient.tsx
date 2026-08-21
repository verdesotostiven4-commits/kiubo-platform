"use client";
import { useEffect,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { PLAN_CATALOG,type CommercialPlan } from "@/lib/entitlements";

export function PlanGateClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null),[message,setMessage]=useState("");
  useEffect(()=>setDb(loadLocalDatabase()),[]);
  if(!db)return <div className="loading-card">Preparando planes…</div>;
  const ctx=getWorkspaceContext(db),current=ctx.tenant?.plan;
  const request=(plan:CommercialPlan)=>setMessage(`Solicitud preparada: cambiar ${ctx.tenant?.name} de ${current} a ${plan}. En producción esto llegará automáticamente a KIUBO Control.`);
  return <><header className="topbar"><div><span className="eyebrow">PLAN Y MÓDULOS</span><h1>{ctx.tenant?.name}</h1></div><span className="pill">Plan actual: {current}</span></header>{message&&<div className="pos-message">{message}</div>}<section className="upgrade-grid">{(Object.keys(PLAN_CATALOG) as CommercialPlan[]).map(plan=>{const data=PLAN_CATALOG[plan],active=current===plan;return <article className={`upgrade-card ${active?"active":""}`} key={plan}><span className="eyebrow">{active?"TU PLAN":"PLAN"}</span><h2>{plan}</h2><strong>{data.price}<small>/mes*</small></strong><p>{data.tagline}</p><ul>{data.features.map(item=><li key={item}>✓ {item}</li>)}</ul>{active?<button className="button secondary" disabled>Plan actual</button>:<button className="button primary" onClick={()=>request(plan)}>Solicitar {plan}</button>}</article>})}</section><section className="panel upgrade-note"><strong>Factura electrónica es un módulo aparte.</strong><span>No se activa solo por cambiar de plan. Se habilita después de configurar el negocio y completar la etapa SRI de forma segura.</span><small>* Los valores siguen siendo precios de preview comercial y se cerrarán antes del lanzamiento público.</small></section></>
}
