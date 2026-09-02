"use client";

import { FormEvent,useEffect,useMemo,useState } from "react";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
import { normalizeTableLabel,tableLabelsFromSettings,withTableLabels } from "@/lib/table-settings";
import { runSyncCycle } from "@/lib/sync-engine";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./TableManager.module.css";

export function TableManager(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[input,setInput]=useState("");
  const[message,setMessage]=useState("Agrega o retira mesas cuando cambie la distribución del local.");
  const[isError,setIsError]=useState(false);
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  const ctx=useMemo(()=>db?getWorkspaceContext(db):null,[db]);
  if(!db||!ctx)return null;
  const settings=getTenantSettings(db,ctx.tenantId);
  if(settings.businessType!=="food_service"||!settings.serviceModes.includes("table"))return null;
  const labels=tableLabelsFromSettings(settings);
  const openOrders=db.orders.filter(order=>order.tenantId===ctx.tenantId&&order.branchId===ctx.branchId&&order.serviceMode==="table"&&order.paymentStatus==="unpaid"&&order.status!=="cancelled"&&order.status!=="delivered");
  const occupied=new Set(openOrders.map(order=>order.tableLabel).filter((label):label is string=>Boolean(label)));

  const persist=(nextLabels:string[],status:string)=>{
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),current=getTenantSettings(next,workspace.tenantId),index=next.settings.findIndex(item=>item.tenantId===workspace.tenantId);
    const updated=withTableLabels(current,nextLabels);
    if(index>=0)next.settings[index]=updated;else next.settings.push(updated);
    saveLocalDatabase(next);
    setDb(next);setMessage(status);setIsError(false);
    window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"table-manager"}}));
    void runSyncCycle().then(result=>{if(result.pulled>0||result.pushed>0)window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:result}))}).catch(()=>undefined);
  };

  const add=(event:FormEvent)=>{
    event.preventDefault();
    const label=normalizeTableLabel(input);
    if(!label||Number(label)<1){setMessage("Escribe un número de mesa válido.");setIsError(true);return}
    if(labels.includes(label)){setMessage(`La Mesa ${label} ya existe.`);setIsError(true);return}
    persist([...labels,label],`Mesa ${label} agregada. Ya aparece en Ventas / POS.`);setInput("");
  };

  const remove=(label:string)=>{
    if(occupied.has(label)){setMessage(`No puedes quitar la Mesa ${label} porque tiene un pedido pendiente. Primero cóbralo o cancélalo.`);setIsError(true);return}
    if(labels.length<=1){setMessage("Debe quedar al menos una mesa mientras el modo Local / mesa esté activo.");setIsError(true);return}
    persist(labels.filter(item=>item!==label),`Mesa ${label} retirada. El historial anterior se conserva.`);
  };

  return <section className={styles.card}>
    <div className={styles.head}><div><span>MESAS DEL LOCAL</span><h3>Agregar o quitar mesas</h3><p>Esto cambia únicamente las mesas disponibles para nuevos pedidos. Las ventas e historial anteriores no se borran.</p></div><div className={styles.count}>{labels.length}</div></div>
    <form className={styles.add} onSubmit={add}><input value={input} onChange={event=>setInput(event.target.value)} type="number" min="1" max="999" inputMode="numeric" placeholder="Número de mesa, ej. 8"/><button type="submit">+ Agregar mesa</button></form>
    {labels.length?<div className={styles.grid}>{labels.map(label=>{const busy=occupied.has(label);return <div key={label} className={`${styles.table} ${busy?styles.occupied:""}`}><div><strong>Mesa {label}</strong><small>{busy?"Pedido pendiente":"Disponible"}</small></div><button type="button" disabled={busy} onClick={()=>remove(label)} aria-label={`Quitar Mesa ${label}`}>×</button></div>})}</div>:<div className={styles.empty}>No hay mesas configuradas.</div>}
    <p className={`${styles.message} ${isError?styles.danger:""}`}>{message}</p>
  </section>;
}
