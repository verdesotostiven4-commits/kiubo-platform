"use client";

import { FormEvent,useEffect,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
import { adminAuthorizationConfigured,markAdminAuthorizationConfigured } from "@/lib/admin-authorization";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";

export function AdminPinManager(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[message,setMessage]=useState("");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  if(!db)return null;
  const ctx=getWorkspaceContext(db),user=ctx.user;
  const allowed=Boolean(user&&(user.platformAdmin||user.role==="owner"||user.role==="admin"));
  if(!allowed)return null;
  const configured=adminAuthorizationConfigured(ctx.tenantId,user?.id);

  const savePin=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget),pin=String(form.get("pin")||"").trim(),confirm=String(form.get("confirm")||"").trim();
    if(!/^\d{4,8}$/.test(pin)){setMessage("Usa de 4 a 8 números.");return}
    if(pin==="1234"){setMessage("Elige un código distinto de 1234.");return}
    if(pin!==confirm){setMessage("Los códigos no coinciden.");return}
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),index=next.users.findIndex(item=>item.id===workspace.user?.id&&item.tenantId===workspace.tenantId);
    if(index<0){setMessage("No encontramos tu usuario administrador.");return}
    const current=next.users[index];
    if(!(current.platformAdmin||current.role==="owner"||current.role==="admin")){setMessage("Solo propietario o administrador puede cambiar este código.");return}
    next.users[index]={...current,pin};
    saveLocalDatabase(next);
    markAdminAuthorizationConfigured(workspace.tenantId,current.id);
    event.currentTarget.reset();
    setMessage("Código configurado correctamente.");
    refresh();
    window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"admin-pin"}}));
  };

  return <section className="panel admin-pin-panel">
    <div className="panel-head"><div><span className="eyebrow">SEGURIDAD</span><h3>Código de autorización</h3><p className="admin-pin-intro">{configured?"Tu código ya está configurado. Puedes cambiarlo aquí cuando quieras.":"Aún no tienes un código configurado. Créalo aquí antes de usar acciones protegidas."}</p></div><span className={`pill ${configured?"admin-pin-ready":""}`}>{configured?"Configurado":"Pendiente"}</span></div>
    <form className="admin-pin-form" onSubmit={savePin}>
      <label>Nuevo código<input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} placeholder="4–8 números" autoComplete="new-password" required/></label>
      <label>Repetir<input name="confirm" type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} placeholder="Repite el código" autoComplete="new-password" required/></label>
      <button className="button primary" type="submit">{configured?"Cambiar código":"Configurar código"}</button>
    </form>
    <small className="ops-note">Este código protege acciones sensibles de este equipo, como reiniciar el historial visible de ventas.</small>
    {message&&<div className="admin-pin-status">{message}</div>}
  </section>;
}
