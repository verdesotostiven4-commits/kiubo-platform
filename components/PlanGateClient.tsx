"use client";
import { useEffect,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { PLAN_CATALOG,type CommercialPlan } from "@/lib/entitlements";
import { KIUBO_ICON_URL } from "@/lib/kiubo-brand-assets";
import { KiuboWordmark } from "./KiuboWordmark";

const planTone:Record<CommercialPlan,string>={Start:"start",Pro:"pro",Custom:"custom"};
const planUse:Record<CommercialPlan,string>={Start:"Para comenzar",Pro:"Para crecer",Custom:"A tu medida"};

export function PlanGateClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null),[message,setMessage]=useState("");
  useEffect(()=>setDb(loadLocalDatabase()),[]);
  if(!db)return <div className="loading-card">Preparando planes…</div>;
  const ctx=getWorkspaceContext(db),current=ctx.tenant?.plan as CommercialPlan|undefined,currentData=current?PLAN_CATALOG[current]:undefined;
  const request=(plan:CommercialPlan)=>setMessage(`Cambio a KIUBO ${plan} preparado. Nada cambia en ${ctx.tenant?.name||"el negocio"} hasta confirmar la activación.`);
  return <div className="plan-studio plan-studio-v4 plan-studio-v5">
    <section className="plan-hero plan-hero-v4 plan-hero-v5">
      <div className="plan-hero-v4-main">
        <div className="plan-brand-lockup plan-brand-lockup-v5"><img src={KIUBO_ICON_URL} alt=""/><div><KiuboWordmark/><small>PLANES QUE CRECEN CONTIGO</small></div></div>
        <span className="plan-kicker">PLAN Y MÓDULOS</span>
        <h1>El KIUBO que necesitas. Nada más.</h1>
        <p>Sube de nivel cuando el negocio lo pida. Tus ventas, datos y configuración siguen en su sitio.</p>
        <div className="plan-hero-trust"><span>✓ Sin interrupciones</span><span>✓ Tus datos se mantienen</span><span>✓ Cambio controlado</span></div>
      </div>
      <div className="plan-current-panel-v5"><span>PLAN ACTUAL</span><strong>{current||"—"}</strong><small>{currentData?.price?`${currentData.price} / mes`:""}</small><div><i/>Activo</div></div>
    </section>

    {message&&<div className="plan-message">✓ {message}</div>}

    <section className="plan-compare-v4">
      <div className="plan-section-heading plan-section-heading-v4 plan-section-heading-v5"><div><span>ELIGE TU PLAN</span><h2>Un plan claro para cada etapa</h2><p>Compara rápido y cambia solo cuando realmente lo necesites.</p></div></div>
      <div className="plan-cards plan-cards-v3 plan-cards-v4 plan-cards-v5">{(Object.keys(PLAN_CATALOG) as CommercialPlan[]).map(plan=>{const data=PLAN_CATALOG[plan],active=current===plan;return <article className={`plan-card-v3 plan-card-v4 plan-card-v5 ${planTone[plan]} ${active?"active":""}`} key={plan}>
        <div className="plan-card-kicker"><span>{planUse[plan]}</span>{active&&<b>Tu plan actual</b>}</div>
        <h2>{plan}</h2>
        <div className="plan-price plan-price-v4"><strong>{data.price}</strong><small>/mes</small></div>
        <p>{data.tagline}</p>
        <div className="plan-feature-stack">{data.features.map(item=><div key={item}><i>✓</i><span>{item}</span></div>)}</div>
        {active?<button className="plan-current-button" disabled>Activo ahora</button>:<button className="plan-request-button" onClick={()=>request(plan)}>Consultar cambio <span>→</span></button>}
      </article>})}</div>
    </section>

    <section className="plan-overview plan-overview-v4"><article><span>NEGOCIO</span><strong>{ctx.tenant?.name||"Negocio"}</strong></article><article><span>CAPACIDADES ACTIVAS</span><strong>{currentData?.features.length||0}</strong></article><article><span>SERVICIO</span><strong className="ok">Operando</strong></article><article><span>FACTURACIÓN ELECTRÓNICA</span><strong>Módulo independiente</strong></article></section>

    <section className="plan-module-note plan-module-note-v3 plan-module-note-v4"><div className="plan-module-icon">◇</div><div><span>MÓDULO ADICIONAL</span><strong>Facturación electrónica</strong><p>Se configura aparte porque requiere datos tributarios, firma electrónica y validaciones del SRI. Puedes activarla cuando el negocio esté listo.</p></div><div className="plan-module-status"><b>No altera tu plan</b><span>Configuración independiente</span></div></section>
  </div>;
}
