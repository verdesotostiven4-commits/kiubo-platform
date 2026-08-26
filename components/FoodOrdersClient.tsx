"use client";

import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { FoodOrderRecord,FoodOrderStatus,getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./FoodOrdersClient.module.css";

const CHECKOUT_KEY="kiubo.food.checkout.order.v1";
const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const activeMeta:{key:FoodOrderStatus;label:string;hint:string;next:FoodOrderStatus;action:string}[]=[
  {key:"new",label:"Por preparar",hint:"Pedidos que acaba de recibir cocina",next:"preparing",action:"Empezar preparación"},
  {key:"preparing",label:"En preparación",hint:"Lo que se está preparando ahora",next:"ready",action:"Marcar listo"},
  {key:"ready",label:"Listos",hint:"Esperando entrega al cliente",next:"delivered",action:"Entregar"},
];
const modeLabel:Record<FoodOrderRecord["serviceMode"],string>={counter:"Mostrador",table:"Mesa",takeaway:"Para llevar",delivery:"Domicilio"};

export function FoodOrdersClient(){
  const router=useRouter();
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[filter,setFilter]=useState<"all"|FoodOrderRecord["serviceMode"]>("all");
  const[view,setView]=useState<"active"|"history">("active");
  const[message,setMessage]=useState("");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  if(!db)return <div className="loading-card">Preparando pedidos…</div>;

  const ctx=getWorkspaceContext(db),settings=getTenantSettings(db,ctx.tenantId);
  if(settings.businessType!=="food_service")return <div className="panel"><h2>Pedidos no está activado</h2><p>Este espacio no utiliza el perfil Food Service.</p></div>;

  const orders=db.orders.filter(order=>order.tenantId===ctx.tenantId&&order.branchId===ctx.branchId&&order.status!=="cancelled").sort((a,b)=>Date.parse(b.updatedAt||b.createdAt)-Date.parse(a.updatedAt||a.createdAt));
  const filteredOrders=filter==="all"?orders:orders.filter(order=>order.serviceMode===filter);
  const activeOrders=filteredOrders.filter(order=>order.status!=="delivered");
  const delivered=filteredOrders.filter(order=>order.status==="delivered");
  const grouped=useMemo(()=>new Map(activeMeta.map(meta=>[meta.key,activeOrders.filter(order=>order.status===meta.key)])),[activeOrders]);

  const changeStatus=(order:FoodOrderRecord,status:FoodOrderStatus)=>{
    const next=loadLocalDatabase(),index=next.orders.findIndex(item=>item.id===order.id);if(index<0)return;
    next.orders[index]={...next.orders[index],status,updatedAt:new Date().toISOString()};
    saveLocalDatabase(next);refresh();setMessage(`Pedido #${String(order.number).padStart(4,"0")} · ${status==="preparing"?"en preparación":status==="ready"?"listo":status==="delivered"?"entregado":"actualizado"}.`);
  };
  const checkout=(order:FoodOrderRecord)=>{window.sessionStorage.setItem(CHECKOUT_KEY,order.id);router.push("/pos")};
  const print=(order:FoodOrderRecord)=>{
    const url=`${window.location.origin}/order-print?order=${encodeURIComponent(order.id)}`;
    const opened=window.open(url,"_blank","noopener,noreferrer");
    if(!opened)setMessage("El navegador bloqueó la pestaña de impresión. Permite ventanas emergentes para KIUBO.");
  };
  const openPos=()=>{window.sessionStorage.removeItem(CHECKOUT_KEY);router.push("/pos")};

  const orderCard=(order:FoodOrderRecord,meta:typeof activeMeta[number])=><article className={styles.card} key={order.id}>
    <div className={styles.cardTop}><strong>#{String(order.number).padStart(4,"0")}</strong><span className={styles.mode}>{order.serviceMode==="table"&&order.tableLabel?`Mesa ${order.tableLabel}`:modeLabel[order.serviceMode]}</span></div>
    <div className={styles.customer}><strong>{order.customerName||order.tableLabel&&`Mesa ${order.tableLabel}`||"Cliente en local"}</strong>{order.phone&&<span>{order.phone}</span>}{order.address&&<span>{order.address}</span>}</div>
    <div className={styles.items}>{order.items.slice(0,6).map((item,index)=><div className={styles.item} key={`${item.productId}-${index}`}><span><b>{item.qty}×</b> {item.name}</span><span>{money(item.qty*item.unitPrice)}</span></div>)}{order.items.length>6&&<div className={styles.item}><span>+ {order.items.length-6} productos</span></div>}</div>
    {order.notes&&<div className={styles.orderNote}>Nota: {order.notes}</div>}
    <div className={styles.total}><span className={order.paymentStatus==="paid"?styles.paid:styles.pending}>{order.paymentStatus==="paid"?"✓ Pagado":"Pendiente de cobro"}</span><strong>{money(order.total)}</strong></div>
    <div className={styles.actions}>{order.paymentStatus!=="paid"&&<button className={styles.checkout} aria-label="Cobrar en POS" onClick={()=>checkout(order)}>Cobrar en POS</button>}<button className={styles.action} onClick={()=>changeStatus(order,meta.next)}>{meta.action}</button><button className={styles.print} onClick={()=>print(order)}>Imprimir</button></div>
  </article>;

  return <div className={styles.page}>
    <section className={styles.hero}><div><span className={styles.kicker}>FOOD SERVICE · {ctx.branch?.code} {ctx.branch?.name}</span><h1>Pedidos</h1><p>Una cola simple para cocina: recibe, prepara, marca listo y entrega. El cobro se controla por separado desde POS.</p></div><button className={styles.primary} onClick={openPos}>＋ Nuevo pedido</button></section>
    {message&&<div className={styles.notice}>✓ {message}</div>}
    <section className={styles.controlBar}><div className={styles.viewTabs}><button className={view==="active"?styles.viewActive:""} onClick={()=>setView("active")}>Activos <b>{activeOrders.length}</b></button><button className={view==="history"?styles.viewActive:""} onClick={()=>setView("history")}>Historial <b>{delivered.length}</b></button></div><div className={styles.filters}><button className={`${styles.filter} ${filter==="all"?styles.active:""}`} onClick={()=>setFilter("all")}>Todos</button>{settings.serviceModes.map(mode=><button key={mode} className={`${styles.filter} ${filter===mode?styles.active:""}`} onClick={()=>setFilter(mode)}>{modeLabel[mode]}</button>)}</div></section>
    {view==="active"?<section className={styles.board}>{activeMeta.map(meta=>{const list=grouped.get(meta.key)??[];return <div className={styles.column} key={meta.key}><div className={styles.columnHead}><div><strong>{meta.label}</strong><small>{meta.hint}</small></div><span className={styles.count}>{list.length}</span></div><div className={styles.columnBody}>{list.map(order=>orderCard(order,meta))}{!list.length&&<div className={styles.empty}><span>✓</span><strong>Todo al día</strong><small>No hay pedidos en esta etapa.</small></div>}</div></div>})}</section>:<section className={styles.historyPanel}><div className={styles.historyHead}><div><span className={styles.kicker}>HISTORIAL</span><h2>Pedidos entregados</h2></div><span>{delivered.length} pedidos</span></div><div className={styles.historyList}>{delivered.slice(0,80).map(order=><article className={styles.historyRow} key={order.id}><div><strong>#{String(order.number).padStart(4,"0")}</strong><span>{order.serviceMode==="table"&&order.tableLabel?`Mesa ${order.tableLabel}`:modeLabel[order.serviceMode]} · {new Date(order.updatedAt||order.createdAt).toLocaleString("es-EC")}</span></div><div className={styles.historyCustomer}><strong>{order.customerName||"Cliente"}</strong><span>{order.items.reduce((sum,item)=>sum+item.qty,0)} productos</span></div><strong>{money(order.total)}</strong><button className={styles.print} onClick={()=>print(order)}>Reimprimir</button></article>)}{!delivered.length&&<div className={styles.emptyHistory}>Todavía no hay pedidos entregados con este filtro.</div>}</div></section>}
  </div>;
}
