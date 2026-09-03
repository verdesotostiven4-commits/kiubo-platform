"use client";

import { useEffect,useMemo,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type SaleRecord } from "@/lib/local-store";
import { saleLifecycle } from "@/lib/sale-reversal";
import { operationalDiscountAmount,parseOperationalItemName } from "@/lib/sale-adjustments";
import { runSyncCycle } from "@/lib/sync-engine";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./OperationalSalesInsights.module.css";

const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const paymentLabel:Record<SaleRecord["payment"],string>={cash:"Efectivo",transfer:"Transferencia",mixed:"Mixto",credit:"Fiado"};
const localDate=(value:Date)=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
const saleDay=(iso:string)=>localDate(new Date(iso));
const currentMonth=()=>localDate(new Date()).slice(0,7);

function saleFlags(sale:SaleRecord){
  const parsed=sale.items.map(item=>({...item,meta:parseOperationalItemName(item.name)}));
  const courtesy=parsed.reduce((sum,item)=>sum+(item.meta.mode==="courtesy"?item.qty:0),0);
  const internal=parsed.reduce((sum,item)=>sum+(item.meta.mode==="internal"?item.qty:0),0);
  const discount=parsed.reduce((sum,item)=>sum+operationalDiscountAmount(item.unitPrice,item.qty,item.meta.discountPercent),0);
  return{parsed,courtesy,internal,discount};
}

export function OperationalSalesInsights(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[month,setMonth]=useState(currentMonth());
  const[selectedDay,setSelectedDay]=useState("");
  const[resetOpen,setResetOpen]=useState(false);
  const[resetCode,setResetCode]=useState("");
  const[resetMessage,setResetMessage]=useState("");
  const[resetBusy,setResetBusy]=useState(false);
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);

  const data=useMemo(()=>{
    if(!db)return null;
    const ctx=getWorkspaceContext(db),branchSales=db.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===ctx.branchId),completed=branchSales.filter(s=>saleLifecycle(s)==="completed");
    const monthSales=completed.filter(s=>saleDay(s.createdAt).startsWith(month));
    const courtesyMap=new Map<string,number>(),internalMap=new Map<string,number>();let courtesyUnits=0,internalUnits=0,discountAmount=0,discountedSales=0;
    for(const sale of monthSales){const flags=saleFlags(sale);courtesyUnits+=flags.courtesy;internalUnits+=flags.internal;discountAmount+=flags.discount;if(flags.discount>0)discountedSales++;
      for(const item of flags.parsed){if(item.meta.mode==="courtesy")courtesyMap.set(item.meta.displayName,(courtesyMap.get(item.meta.displayName)||0)+item.qty);if(item.meta.mode==="internal")internalMap.set(item.meta.displayName,(internalMap.get(item.meta.displayName)||0)+item.qty)}
    }
    const dayMap=new Map<string,SaleRecord[]>();for(const sale of completed){const day=saleDay(sale.createdAt),list=dayMap.get(day)||[];list.push(sale);dayMap.set(day,list)}
    const days=[...dayMap.entries()].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,18).map(([day,sales])=>({day,sales:[...sales].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),total:sales.reduce((sum,s)=>sum+s.total,0)}));
    const chosen=selectedDay?days.find(row=>row.day===selectedDay):days[0];
    return{ctx,branchSales,monthSales,courtesyUnits,internalUnits,discountAmount,discountedSales,courtesy:[...courtesyMap.entries()].sort((a,b)=>b[1]-a[1]),internal:[...internalMap.entries()].sort((a,b)=>b[1]-a[1]),days,chosen};
  },[db,month,selectedDay]);

  if(!db||!data)return null;
  const canReset=Boolean(data.ctx.user?.platformAdmin||data.ctx.user?.role==="owner"||data.ctx.user?.role==="admin");

  const resetSales=async()=>{
    if(resetBusy||!canReset)return;const code=resetCode.trim();if(!code){setResetMessage("Escribe el código de administrador.");return}
    const current=loadLocalDatabase(),ctx=getWorkspaceContext(current),authorized=current.users.some(user=>user.active&&user.tenantId===ctx.tenantId&&(user.role==="owner"||user.role==="admin"||user.platformAdmin)&&user.pin===code);
    if(!authorized){setResetMessage("Código incorrecto.");return}
    const targets=current.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===ctx.branchId);if(!targets.length){setResetMessage("El historial ya está vacío.");return}
    setResetBusy(true);setResetMessage("Verificando sincronización…");
    try{
      const before=await runSyncCycle();if(before.mode==="supabase"&&!before.ok&&before.failed>0){setResetMessage("Hay cambios pendientes. Espera a que KIUBO termine de sincronizar y vuelve a intentar.");return}
      const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),targetIds=new Set(next.sales.filter(s=>s.tenantId===workspace.tenantId&&s.branchId===workspace.branchId).map(s=>s.id));
      next.syncQueue=next.syncQueue.filter(item=>!(item.tenantId===workspace.tenantId&&item.branchId===workspace.branchId&&targetIds.has(item.entityId)&&(item.entityType==="saleTransactions"||item.entityType==="saleReversalTransactions")&&item.status!=="synced"));
      next.sales=next.sales.filter(s=>!(s.tenantId===workspace.tenantId&&s.branchId===workspace.branchId));
      saveLocalDatabase(next);const after=await runSyncCycle();refresh();window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"sales-history-reset"}}));
      setResetCode("");setResetOpen(false);setResetMessage(after.ok?`Historial reiniciado · ${targetIds.size} ventas eliminadas.`:"Historial vaciado; KIUBO terminará de sincronizar automáticamente.");
    }finally{setResetBusy(false)}
  };

  return <section className={styles.shell} aria-label="Control diario y cortesías">
    <article className={styles.card}>
      <div className={styles.head}><div><span>CONTROL DIARIO</span><h3>Ventas por día</h3><p>Elige un día para revisar exactamente qué se vendió.</p></div><button className={styles.refresh} type="button" onClick={refresh}>Actualizar</button></div>
      <div className={styles.days}>{data.days.length?data.days.map(row=><button type="button" key={row.day} className={`${styles.day} ${(data.chosen?.day===row.day)?styles.active:""}`} onClick={()=>setSelectedDay(row.day)}><b>{new Date(`${row.day}T12:00:00`).toLocaleDateString("es-EC",{day:"2-digit",month:"short"})}</b><span>{row.sales.length} ventas · {money(row.total)}</span></button>):<div className={styles.empty}>Todavía no hay ventas.</div>}</div>
      {data.chosen&&<div className={styles.detail}>{data.chosen.sales.map(sale=>{const flags=saleFlags(sale);return <article className={styles.sale} key={sale.id}><div className={styles.saleTop}><strong>{new Date(sale.createdAt).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})} · {paymentLabel[sale.payment]}</strong><b>{money(sale.total)}</b></div><div className={styles.saleMeta}>{flags.courtesy>0&&<span className={`${styles.tag} ${styles.courtesy}`}>{flags.courtesy} cortesía</span>}{flags.internal>0&&<span className={`${styles.tag} ${styles.internal}`}>{flags.internal} consumo interno</span>}{flags.discount>0&&<span className={`${styles.tag} ${styles.discount}`}>descuento {money(flags.discount)}</span>}<span>#{sale.id.slice(-6).toUpperCase()}</span></div><div className={styles.items}>{flags.parsed.map((item,index)=><span key={`${item.productId}-${index}`}>{item.qty}× {item.meta.displayName}{item.meta.mode==="courtesy"?" · Cortesía $0":item.meta.mode==="internal"?" · Interno $0":item.meta.discountPercent>0?` · -${item.meta.discountPercent}%`:""}</span>)}</div></article>})}</div>}
    </article>

    <article className={styles.card}>
      <div className={styles.head}><div><span>RESUMEN ESPECIAL</span><h3>Cortesías, descuentos y consumo interno</h3><p>Control mensual separado de las ventas cobradas.</p></div><input className={styles.month} type="month" value={month} onChange={e=>setMonth(e.target.value||currentMonth())}/></div>
      <div className={styles.stats}><div className={styles.stat}><span>Cortesías</span><strong>{data.courtesyUnits}</strong></div><div className={styles.stat}><span>Ventas con descuento</span><strong>{data.discountedSales}</strong></div><div className={styles.stat}><span>Descuento aplicado</span><strong>{money(data.discountAmount)}</strong></div><div className={styles.stat}><span>Consumo interno</span><strong>{data.internalUnits}</strong></div></div>
      <div className={styles.columns}><div className={styles.mini}><div className={styles.miniHead}><strong>Productos de cortesía</strong><b>{data.courtesyUnits} u.</b></div>{data.courtesy.length?<div className={styles.list}>{data.courtesy.slice(0,12).map(([name,qty])=><div className={styles.row} key={name}><span>{name}</span><b>{qty} u.</b></div>)}</div>:<div className={styles.empty}>Sin cortesías este mes.</div>}</div><div className={styles.mini}><div className={styles.miniHead}><strong>Consumo del local</strong><b>{data.internalUnits} u.</b></div>{data.internal.length?<div className={styles.list}>{data.internal.slice(0,12).map(([name,qty])=><div className={styles.row} key={name}><span>{name}</span><b>{qty} u.</b></div>)}</div>:<div className={styles.empty}>Sin consumo interno este mes.</div>}</div></div>

      {canReset&&<details className={styles.tools} open={resetOpen} onToggle={e=>setResetOpen((e.currentTarget as HTMLDetailsElement).open)}><summary>Herramientas de historial</summary><div className={styles.dangerBox}><strong>Reiniciar historial de ventas</strong><p>Vacía únicamente las ventas de esta sucursal. No cambia inventario, productos, clientes ni caja. Requiere código de propietario/administrador.</p><div className={styles.dangerForm}><input type="password" inputMode="numeric" value={resetCode} onChange={e=>setResetCode(e.target.value)} placeholder="Código" autoComplete="off"/><button type="button" disabled={resetBusy||!data.branchSales.length} onClick={()=>void resetSales()}>{resetBusy?"Verificando…":"Reiniciar"}</button></div>{resetMessage&&<div className={styles.status}>{resetMessage}</div>}</div></details>}
    </article>
  </section>;
}
