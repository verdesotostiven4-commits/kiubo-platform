"use client";
import { useEffect,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { PLAN_CATALOG,type CommercialPlan } from "@/lib/entitlements";
import { KiuboWordmark } from "./KiuboWordmark";

export function PlanGateClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null),[message,setMessage]=useState("");
  useEffect(()=>setDb(loadLocalDatabase()),[]);
  if(!db)return <div className="loading-card">Preparando planes…</div>;
  const ctx=getWorkspaceContext(db),current=ctx.tenant?.plan as CommercialPlan|undefined,currentData=current?PLAN_CATALOG[current]:undefined;
  const request=(plan:CommercialPlan)=>setMessage(`Cambio a KIUBO ${plan} preparado. La activación debe ser confirmada por KIUBO Admin para no alterar el negocio mientras está operando.`);
  return <div className="plan-studio">
    <section className="plan-hero"><div><span className="plan-kicker">PLAN Y MÓDULOS</span><h1>Tu KIUBO, a la medida del negocio.</h1><p>Revisa lo que tienes activo y compara capacidades sin tocar la operación actual.</p><div className="plan-hero-brand"><span>Powered by</span><KiuboWordmark/></div></div><div className="plan-current-orbit"><span>PLAN ACTUAL</span><strong>{current||"—"}</strong><small>{currentData?.price||""}/mes</small><i/></div></section>
    {message&&<div className="plan-message">✓ {message}</div>}
    <section className="plan-overview"><article><span>Negocio</span><strong>{ctx.tenant?.name||"Negocio"}</strong></article><article><span>Capacidades incluidas</span><strong>{currentData?.features.length||0}</strong></article><article><span>Estado</span><strong className="ok">Activo</strong></article><article><span>Factura electrónica</span><strong>Módulo aparte</strong></article></section>
    <section className="plan-cards">{(Object.keys(PLAN_CATALOG) as CommercialPlan[]).map((plan,index)=>{const data=PLAN_CATALOG[plan],active=current===plan;return <article className={`plan-card-v2 tone-${index%3} ${active?"active":""}`} key={plan}><div className="plan-card-top"><span>{active?"TU PLAN":"KIUBO"}</span>{active&&<b>Activo</b>}</div><h2>{plan}</h2><div className="plan-price"><strong>{data.price}</strong><small>/mes*</small></div><p>{data.tagline}</p><div className="plan-feature-stack">{data.features.map(item=><div key={item}><i>✓</i><span>{item}</span></div>)}</div>{active?<button className="plan-current-button" disabled>Este es tu plan</button>:<button className="plan-request-button" onClick={()=>request(plan)}>Consultar cambio →</button>}</article>})}</section>
    <section className="plan-module-note"><div className="plan-module-icon">◇</div><div><span>MÓDULO ESPECIAL</span><strong>Facturación electrónica</strong><p>Se configura por separado porque requiere datos tributarios, firma y validaciones del SRI. Cambiar de plan no la activa automáticamente.</p></div><div className="plan-module-status">Configuración independiente</div></section>
    <small className="plan-footnote">* Valores comerciales de referencia hasta el cierre oficial de planes.</small>
  </div>
}
