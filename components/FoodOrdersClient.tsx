"use client";

import { useEffect,useState } from "react";
import { FoodOrderRecord,FoodOrderStatus,getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./FoodOrdersClient.module.css";

const CHECKOUT_KEY="kiubo.food.checkout.order.v1";
const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const statusMeta:{key:FoodOrderStatus;label:string;next?:FoodOrderStatus;action?:string}[]=[
  {key:"new",label:"Nuevos",next:"preparing",action:"Preparar"},
  {key:"preparing",label:"En preparación",next:"ready",action:"Marcar listo"},
  {key:"ready",label:"Listos",next:"delivered",action:"Entregar"},
  {key:"delivered",label:"Entregados"}
];
const modeLabel:Record<FoodOrderRecord["serviceMode"],string>={counter:"Mostrador",table:"Mesa",takeaway:"Para llevar",delivery:"Domicilio"};

export function FoodOrdersClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null),[filter,setFilter]=useState<"all"|FoodOrderRecord["serviceMode"]>("all"),[message,setMessage]=useState("");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  if(!db)return <div className="loading-card">Preparando pedidos…</div>;
  const ctx=getWorkspaceContext(db),settings=getTenantSettings(db,ctx.tenantId);
  if(settings.businessType!=="food_service")return <div className="panel"><h2>Pedidos no está activado</h2><p>Este espacio no utiliza el perfil Food Service.</p></div>;
  const orders=db.orders.filter(order=>order.tenantId===ctx.tenantId&&order.branchId===ctx.branchId&&order.status!=="cancelled").sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const visible=filter==="all"?orders:orders.filter(order=>order.serviceMode===filter);
  const grouped=new Map(statusMeta.map(meta=>[meta.key,visible.filter(order=>order.status===meta.key)]));

  const changeStatus=(order:FoodOrderRecord,status:FoodOrderStatus)=>{const next=loadLocalDatabase(),index=next.orders.findIndex(item=>item.id===order.id);if(index<0)return;next.orders[index]={...next.orders[index],status,updatedAt:new Date().toISOString()};saveLocalDatabase(next);refresh();setMessage(`Pedido #${String(order.number).padStart(4,"0")} actualizado.`)};
  const checkout=(order:FoodOrderRecord)=>{window.sessionStorage.setItem(CHECKOUT_KEY,order.id);window.location.href="/pos"};
  const print=(order:FoodOrderRecord)=>window.open(`/order-print?order=${encodeURIComponent(order.id)}`,"_blank","noopener,noreferrer");
  const openPos=()=>{window.sessionStorage.removeItem(CHECKOUT_KEY);window.location.href="/pos"};

  return <div className={styles.page}><section className={styles.hero}><div><span className={styles.kicker}>FOOD SERVICE · {ctx.branch?.code} {ctx.branch?.name}</span><h1>Pedidos</h1><p>La misma cola para caja, meseros y preparación. Los cambios Cloud llegan automáticamente.</p></div><button className={styles.primary} onClick={openPos}>＋ Nuevo pedido</button></section>{message&&<div className={styles.notice}>✓ {message}</div>}<div className={styles.toolbar}><button className={`${styles.filter} ${filter==="all"?styles.active:""}`} onClick={()=>setFilter("all")}>Todos</button>{settings.serviceModes.map(mode=><button key={mode} className={`${styles.filter} ${filter===mode?styles.active:""}`} onClick={()=>setFilter(mode)}>{modeLabel[mode]}</button>)}</div><section className={styles.board}>{statusMeta.map(meta=>{const list=grouped.get(meta.key)??[];return <div className={styles.column} key={meta.key}><div className={styles.columnHead}><strong>{meta.label}</strong><span className={styles.count}>{list.length}</span></div>{list.slice(0,40).map(order=><article className={styles.card} key={order.id}><div className={styles.cardTop}><strong>#{String(order.number).padStart(4,"0")}</strong><span className={styles.mode}>{order.serviceMode==="table"&&order.tableLabel?order.tableLabel:modeLabel[order.serviceMode]}</span></div><div className={styles.customer}><strong>{order.customerName||order.tableLabel||"Cliente en local"}</strong>{order.phone&&<span>{order.phone}</span>}{order.address&&<span>{order.address}</span>}</div><div className={styles.items}>{order.items.slice(0,5).map((item,index)=><div className={styles.item} key={`${item.productId}-${index}`}><span><b>{item.qty}×</b> {item.name}</span><span>{money(item.qty*item.unitPrice)}</span></div>)}{order.items.length>5&&<div className={styles.item}><span>+ {order.items.length-5} productos</span></div>}</div>{order.notes&&<small>Nota: {order.notes}</small>}<div className={styles.total}><span>{order.paymentStatus==="paid"?"Pagado":"Pendiente de cobro"}</span><strong>{money(order.total)}</strong></div><div className={styles.actions}>{order.paymentStatus!=="paid"?<button className={styles.action} onClick={()=>checkout(order)}>Cobrar en POS</button>:meta.next?<button className={styles.action} onClick={()=>changeStatus(order,meta.next!)}>{meta.action}</button>:<span/>}<button className={styles.secondary} onClick={()=>print(order)}>Imprimir</button></div>{order.paymentStatus!=="paid"&&meta.next&&<button className={styles.secondary} onClick={()=>changeStatus(order,meta.next!)}>{meta.action}</button>}</article>)}{!list.length&&<div className={styles.empty}>No hay pedidos aquí.</div>}</div>})}</section></div>;
}
