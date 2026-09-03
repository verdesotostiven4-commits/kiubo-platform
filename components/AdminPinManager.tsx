"use client";

import { FormEvent,useEffect,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
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

  const savePin=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget),pin=String(form.get("pin")||"").trim(),confirm=String(form.get("confirm")||"").trim();
    if(!/^\d{4,8}$/.test(pin)){setMessage("Usa de 4 a 8 números.");return}
    if(pin!==confirm){setMessage("Los códigos no coinciden.");return}
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),index=next.users.findIndex(item=>item.id===workspace.user?.id&&item.tenantId===workspace.tenantId);
    if(index<0){setMessage("No encontramos tu usuario administrador.");return}
    const current=next.users[index];
    if(!(current.platformAdmin||current.role==="owner"||current.role==="admin")){setMessage("Solo propietario o administrador puede cambiar este código.");return}
    next.users[index]={...current,pin};
    saveLocalDatabase(next);
    event.currentTarget.reset();
    setMessage("Código actualizado.");
    refresh();
    window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"admin-pin"}}));
  };

  return <section className="panel admin-pin-panel">
    <div className="panel-head"><div><span className="eyebrow">SEGURIDAD</span><h3>Código de autorización</h3></div><span className="pill">Propietario</span></div>
    <form className="admin-pin-form" onSubmit={savePin}>
      <label>Nuevo código<input name="pin" type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} placeholder="4–8 números" autoComplete="new-password" required/></label>
      <label>Repetir<input name="confirm" type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={8} placeholder="Repite el código" autoComplete="new-password" required/></label>
      <button className="button primary" type="submit">Guardar código</button>
    </form>
    <small className="ops-note">Se usa para acciones protegidas, como reiniciar el historial visible de ventas.</small>
    {message&&<div className="admin-pin-status">{message}</div>}
  </section>;
}
