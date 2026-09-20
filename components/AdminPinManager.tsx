"use client";

import { FormEvent,useEffect,useState } from "react";
import { getOpenCashSession,getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";

export function AdminPinManager(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[message,setMessage]=useState("");
  const[protectedOpen,setProtectedOpen]=useState(false);
  const[resetPin,setResetPin]=useState("");
  const[resetPhrase,setResetPhrase]=useState("");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  if(!db)return null;

  const ctx=getWorkspaceContext(db),user=ctx.user,settings=getTenantSettings(db,ctx.tenantId);
  const allowed=Boolean(user&&(user.platformAdmin||user.role==="owner"||user.role==="admin"));
  if(!allowed)return null;
  const configured=Boolean(user?.pin&&user.pin!=="1234");
  const lastReset=ctx.branchId?settings.salesHistoryResetAtByBranch?.[ctx.branchId]:"";
  const openCash=Boolean(ctx.branchId&&getOpenCashSession(db,ctx.tenantId,ctx.branchId));
  const unresolvedOrders=db.orders.filter(order=>order.tenantId===ctx.tenantId&&order.branchId===ctx.branchId&&order.status!=="cancelled"&&order.paymentStatus!=="paid").length;
  const openCredits=db.credits.filter(credit=>credit.tenantId===ctx.tenantId&&credit.branchId===ctx.branchId&&credit.status==="open"&&credit.balance>.001).length;
  const notify=(source:string)=>{refresh();window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source}}))};

  const savePin=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget),pin=String(form.get("pin")||"").trim(),confirm=String(form.get("confirm")||"").trim();
    if(!/^\d{4,8}$/.test(pin)){setMessage("Usa de 4 a 8 números.");return}
    if(pin==="1234"){setMessage("Elige un código distinto de 1234.");return}
    if(pin!==confirm){setMessage("Los códigos no coinciden.");return}
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),index=next.users.findIndex(item=>item.id===workspace.user?.id&&item.tenantId===workspace.user?.tenantId);
    if(index<0){setMessage("No encontramos tu usuario administrador.");return}
    const current=next.users[index];
    if(!(current.platformAdmin||current.role==="owner"||current.role==="admin")){setMessage("Solo propietario o administrador puede cambiar este código.");return}
    next.users[index]={...current,pin};
    saveLocalDatabase(next,{trackChanges:false});
    event.currentTarget.reset();setMessage("Código configurado correctamente.");notify("admin-pin");
  };

  const resetVisibleHistory=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),actor=workspace.user;
    if(!actor||!workspace.branchId){setMessage("No encontramos la sucursal activa.");return}
    if(!(actor.platformAdmin||actor.role==="owner"||actor.role==="admin")){setMessage("Solo propietario o administrador puede reiniciar el historial.");return}
    if(!actor.pin||actor.pin==="1234"){setMessage("Configura primero un código de autorización.");return}
    if(resetPin!==actor.pin){setMessage("Código de autorización incorrecto.");return}
    if(resetPhrase.trim().toUpperCase()!=="REINICIAR"){setMessage("Escribe REINICIAR para confirmar.");return}
    const currentCash=getOpenCashSession(next,workspace.tenantId,workspace.branchId);
    const pending=next.orders.filter(order=>order.tenantId===workspace.tenantId&&order.branchId===workspace.branchId&&order.status!=="cancelled"&&order.paymentStatus!=="paid");
    const debts=next.credits.filter(credit=>credit.tenantId===workspace.tenantId&&credit.branchId===workspace.branchId&&credit.status==="open"&&credit.balance>.001);
    if(currentCash){setMessage("Cierra la caja antes de reiniciar el historial visible.");return}
    if(pending.length||debts.length){setMessage(`Antes de reiniciar resuelve ${pending.length} pedido(s) pendiente(s) y ${debts.length} fiado(s) abierto(s). No ocultaremos obligaciones reales.`);return}
    const cutoff=new Date().toISOString(),current=getTenantSettings(next,workspace.tenantId),resets={...(current.salesHistoryResetAtByBranch||{}),[workspace.branchId]:cutoff};
    next.settings=next.settings.filter(item=>item.tenantId!==workspace.tenantId);
    next.settings.push({...current,salesHistoryResetAtByBranch:resets});
    saveLocalDatabase(next);
    setResetPin("");setResetPhrase("");setProtectedOpen(false);
    setMessage("Historial visible reiniciado. Productos, fotos, stock, clientes y configuración quedaron intactos.");
    notify("sales-history-reset");
  };

  return <section id="authorization-code" className="panel admin-pin-panel">
    <div className="panel-head"><div><span className="eyebrow">SEGURIDAD</span><h3>Código de autorización</h3><p className="admin-pin-intro">{configured?"Tu código ya está configurado. Puedes cambiarlo aquí cuando quieras.":"Aún no tienes un código configurado. Créalo aquí antes de usar acciones protegidas."}</p></div><span className={`pill ${configured?"admin-pin-ready":""}`}>{configured?"Configurado":"Pendiente"}</span></div>
    <form className="admin-pin-form" onSubmit={savePin}>
      <label>Nuevo código<input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} placeholder="4–8 números" autoComplete="new-password" required/></label>
      <label>Repetir<input name="confirm" type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} placeholder="Repite el código" autoComplete="new-password" required/></label>
      <button className="button primary" type="submit">{configured?"Cambiar código":"Configurar código"}</button>
    </form>
    <small className="ops-note">Este código protege acciones sensibles. Nunca borra productos, fotos o inventario.</small>
    <div className="protected-actions">
      <button className="protected-actions-toggle" type="button" onClick={()=>setProtectedOpen(value=>!value)}>{protectedOpen?"Ocultar acciones protegidas":"Acciones protegidas"}</button>
      {protectedOpen&&<div className="history-reset-box">
        <div><span>REINICIO COMERCIAL</span><strong>Empezar historial visible desde cero</strong><p>Oculta del Dashboard, Reportes e Historial de pedidos todo lo anterior a este momento. Los registros antiguos se conservan en Cloud para auditoría. No toca productos, fotos, stock, clientes, configuración ni compras.</p></div>
        <div className="history-reset-status"><span>Caja</span><b>{openCash?"Abierta":"Cerrada"}</b><span>Pedidos pendientes</span><b>{unresolvedOrders}</b><span>Fiados abiertos</span><b>{openCredits}</b></div>
        {lastReset&&<small>Último reinicio visible: {new Date(lastReset).toLocaleString("es-EC")}</small>}
        <form className="history-reset-form" onSubmit={resetVisibleHistory}>
          <label>Código de autorización<input value={resetPin} onChange={e=>setResetPin(e.target.value)} type="password" inputMode="numeric" placeholder="Tu PIN" disabled={!configured} required/></label>
          <label>Confirmación<input value={resetPhrase} onChange={e=>setResetPhrase(e.target.value)} placeholder="Escribe REINICIAR" autoComplete="off" disabled={!configured} required/></label>
          <button type="submit" disabled={!configured||openCash||unresolvedOrders>0||openCredits>0}>Reiniciar historial visible</button>
        </form>
        {(openCash||unresolvedOrders>0||openCredits>0)&&<small className="history-reset-warning">Primero cierra caja y resuelve pedidos/fiados pendientes. Así nunca desaparece una obligación real.</small>}
      </div>}
    </div>
    {message&&<div className="admin-pin-status">{message}</div>}
  </section>;
}
