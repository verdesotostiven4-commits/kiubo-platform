"use client";
import { useEffect,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { PLAN_CATALOG,type CommercialPlan } from "@/lib/entitlements";
import { KIUBO_LOGO_DARK_BG_URL } from "@/lib/kiubo-brand-assets";

const planTone:Record<CommercialPlan,string>={Start:"start",Pro:"pro",Custom:"custom"};

export function PlanGateClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null),[message,setMessage]=useState("");
  useEffect(()=>setDb(loadLocalDatabase()),[]);
  if(!db)return <div className="loading-card">Preparando planes…</div>;
  const ctx=getWorkspaceContext(db),current=ctx.tenant?.plan as CommercialPlan|undefined,currentData=current?PLAN_CATALOG[current]:undefined;
  const request=(plan:CommercialPlan)=>setMessage(`Cambio a KIUBO ${plan} preparado. Nada cambia en ${ctx.tenant?.name||"el negocio"} hasta confirmar la activación.`);
  return <div className="plan-studio plan-studio-v3">
    <section className="plan-hero plan-hero-v3">
      <div className="plan-hero-copy"><img className="plan-hero-logo" src={KIUBO_LOGO_DARK_BG_URL} alt="KIUBO"/><span className="plan-kicker">PLAN Y MÓDULOS</span><h1>Más capacidad cuando la necesites. Sin complicarte.</h1><p>Compara lo que incluye cada plan y revisa qué está activo sin tocar ventas, caja ni inventario.</p><div className="plan-hero-trust"><span>✓ Sin interrupciones</span><span>✓ Tus datos se mantienen</span><span>✓ Cambio controlado</span></div></div>
      <div className="plan-current-panel"><span>PLAN ACTUAL</span><strong>{current||"—"}</strong><small>{currentData?.price?`${currentData.price}/mes`:""}</small><div><i/>Activo</div></div>
    </section>

    {message&&<div className="plan-message">✓ {message}</div>}

    <section className="plan-overview plan-overview-v3"><article><span>Negocio</span><strong>{ctx.tenant?.name||"Negocio"}</strong></article><article><span>Capacidades activas</span><strong>{currentData?.features.length||0}</strong></article><article><span>Estado del servicio</span><strong className="ok">Operando</strong></article><article><span>Facturación electrónica</span><strong>Módulo independiente</strong></article></section>

    <div className="plan-section-heading"><div><span>COMPARA</span><h2>Elige el nivel de KIUBO</h2><p>Empieza simple y sube solo cuando el negocio lo necesite.</p></div><small>Tu operación actual no cambia al revisar opciones.</small></div>

    <section className="plan-cards plan-cards-v3">{(Object.keys(PLAN_CATALOG) as CommercialPlan[]).map(plan=>{const data=PLAN_CATALOG[plan],active=current===plan;return <article className={`plan-card-v3 ${planTone[plan]} ${active?"active":""}`} key={plan}><div className="plan-card-v3-head"><span>KIUBO</span>{active?<b>Tu plan actual</b>:<small>{plan==="Start"?"Para comenzar":plan==="Pro"?"Para crecer":"A tu medida"}</small>}</div><h2>{plan}</h2><div className="plan-price"><strong>{data.price}</strong><small>/mes*</small></div><p>{data.tagline}</p><div className="plan-feature-stack">{data.features.map(item=><div key={item}><i>✓</i><span>{item}</span></div>)}</div>{active?<button className="plan-current-button" disabled>Activo ahora</button>:<button className="plan-request-button" onClick={()=>request(plan)}>Consultar cambio <span>→</span></button>}</article>})}</section>

    <section className="plan-module-note plan-module-note-v3"><div className="plan-module-icon">◇</div><div><span>MÓDULO ADICIONAL</span><strong>Facturación electrónica</strong><p>Se configura aparte porque requiere datos tributarios, firma electrónica y validaciones del SRI. Puedes activarla cuando el negocio esté listo.</p></div><div className="plan-module-status"><b>No altera tu plan</b><span>Configuración independiente</span></div></section>

    <small className="plan-footnote">* Valores comerciales de referencia hasta el cierre oficial de planes.</small>
  </div>;
}
