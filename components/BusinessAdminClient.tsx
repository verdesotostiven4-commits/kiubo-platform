"use client";

import { FormEvent,useEffect,useState } from "react";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type KiuboLocalDatabase } from "@/lib/local-store";

export function BusinessAdminClient(){
  const[db,setDb]=useState<KiuboLocalDatabase|null>(null);
  const[message,setMessage]=useState("Configuración lista");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(refresh,[]);
  if(!db)return <div className="loading-card">Preparando administración…</div>;

  const ctx=getWorkspaceContext(db);
  const settings=getTenantSettings(db,ctx.tenantId);

  const saveSettings=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),current=getTenantSettings(next,workspace.tenantId),f=new FormData(e.currentTarget);
    const updated={
      ...current,
      tradeName:String(f.get("tradeName")||"").trim(),
      legalName:String(f.get("legalName")||"").trim(),
      ruc:String(f.get("ruc")||"").trim(),
      establishment:String(f.get("establishment")||"001").trim()||"001",
      emissionPoint:String(f.get("emissionPoint")||"001").trim()||"001",
      receiptFooter:String(f.get("receiptFooter")||"").trim(),
      accent:String(f.get("accent")||"#ff5b55"),
      requireCashSession:f.get("requireCashSession")==="on",
      allowCredit:f.get("allowCredit")==="on"
    };
    if(!updated.tradeName){setMessage("Escribe el nombre comercial");return}
    next.settings=next.settings.filter(s=>s.tenantId!==workspace.tenantId);
    next.settings.push(updated);
    saveLocalDatabase(next);
    refresh();
    setMessage("Configuración guardada · KIUBO la sincronizará automáticamente");
  };

  return <>
    <div className="workspace-banner"><div><span>NEGOCIO</span><strong>{ctx.tenant?.name}</strong></div><div><span>SUCURSAL ACTIVA</span><strong>{ctx.branch?.code} · {ctx.branch?.name}</strong></div><div><span>ESTADO</span><strong>{message}</strong></div></div>
    <header className="topbar"><div><span className="eyebrow">KIUBO ADMINISTRACIÓN</span><h1>Reglas generales del negocio</h1><p>Configura el comportamiento que aplica a tu operación sin mezclarlo con el turno de caja.</p></div></header>
    <form className="panel ops-settings" onSubmit={saveSettings}>
      <div className="panel-head"><div><span className="eyebrow">NEGOCIO</span><h3>Identidad y operación</h3></div><span className="pill">Cloud</span></div>
      <div className="settings-grid">
        <label>Nombre comercial<input name="tradeName" defaultValue={settings.tradeName} required/></label>
        <label>Razón social<input name="legalName" defaultValue={settings.legalName}/></label>
        <label>RUC<input name="ruc" defaultValue={settings.ruc}/></label>
        <label>Establecimiento<input name="establishment" defaultValue={settings.establishment}/></label>
        <label>Punto de emisión<input name="emissionPoint" defaultValue={settings.emissionPoint}/></label>
        <label>Color de marca<input name="accent" type="color" defaultValue={settings.accent}/></label>
        <label className="settings-wide">Pie de comprobante<input name="receiptFooter" defaultValue={settings.receiptFooter}/></label>
        <label className="switch-row"><input name="requireCashSession" type="checkbox" defaultChecked={settings.requireCashSession}/>Exigir caja abierta para cobros en efectivo</label>
        <label className="switch-row"><input name="allowCredit" type="checkbox" defaultChecked={settings.allowCredit}/>Permitir ventas a crédito / fiado</label>
      </div>
      <button className="button primary" type="submit">Guardar configuración</button>
      <small className="ops-note">Los cambios quedan vinculados al negocio activo y se sincronizan con KIUBO Cloud.</small>
    </form>
  </>;
}