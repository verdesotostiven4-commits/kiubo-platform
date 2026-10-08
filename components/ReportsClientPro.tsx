"use client";

import { useEffect,useState } from "react";
import { SaleRecord,getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
import { historyRecordVisibleAfterReset,saleVisibleAfterHistoryReset } from "@/lib/sale-adjustments";
import { outstandingBalanceKind,salePaymentSummary } from "@/lib/order-payments";
import { reconcileCashSession } from "@/lib/cash-reconciliation";
import { reverseSaleLocally,saleLifecycle,type SaleWithLifecycle } from "@/lib/sale-reversal";
import { formatStock } from "@/lib/recipe-inventory";
import { ingredientConsumptionRows } from "@/lib/report-inventory";
import { addBusinessDays,businessDateKey,businessDateLabel,businessTimeZone,businessTodayKey } from "@/lib/business-time";
import { parseOperationalItemName } from "@/lib/sale-adjustments";
import { productKind } from "@/lib/product-classification";
import { transferPaymentEvents } from "@/lib/transfer-events";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./ReportsClientPro.module.css";

const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);

export function ReportsClientPro(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[from,setFrom]=useState("");const[to,setTo]=useState("");const[scope,setScope]=useState<"branch"|"tenant">("branch");
  const[voidSaleId,setVoidSaleId]=useState("");const[voidReason,setVoidReason]=useState("");const[actionMessage,setActionMessage]=useState("");
  const refresh=()=>setDb(loadLocalDatabase());
  useEffect(()=>{refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  if(!db)return <div className="loading-card">Preparando reportes…</div>;

  const ctx=getWorkspaceContext(db),settings=getTenantSettings(db,ctx.tenantId),timeZone=businessTimeZone(settings.timeZone),canConsolidate=Boolean(ctx.user?.platformAdmin||ctx.user?.role==="owner"||ctx.user?.role==="admin"),canReverse=canConsolidate,effectiveScope=canConsolidate?scope:"branch";
  const inPeriod=(iso:string)=>{const day=businessDateKey(iso,timeZone);return(!from||day>=from)&&(!to||day<=to)},branchAllowed=(branchId:string)=>effectiveScope==="tenant"||branchId===ctx.branchId;
  const saleHistory=db.sales.filter(s=>s.tenantId===ctx.tenantId&&branchAllowed(s.branchId)&&saleVisibleAfterHistoryReset(s,settings)&&inPeriod(s.createdAt)),sales=saleHistory.filter(s=>saleLifecycle(s)==="completed");
  const purchases=db.purchases.filter(p=>p.tenantId===ctx.tenantId&&branchAllowed(p.branchId)&&p.status!=="cancelled"&&inPeriod(p.createdAt)),supplierPayments=db.supplierPayments.filter(p=>p.tenantId===ctx.tenantId&&branchAllowed(p.branchId)&&inPeriod(p.createdAt)),cashSessions=db.cashSessions.filter(s=>s.tenantId===ctx.tenantId&&branchAllowed(s.branchId)&&historyRecordVisibleAfterReset(s,settings)&&inPeriod(s.openedAt)),cashMovements=db.cashMovements.filter(m=>m.tenantId===ctx.tenantId&&branchAllowed(m.branchId)&&historyRecordVisibleAfterReset(m,settings)&&inPeriod(m.createdAt)),credits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&branchAllowed(c.branchId)&&c.status==="open"&&outstandingBalanceKind(db,c)!=="partial");
  const revenue=sales.reduce((sum,s)=>sum+s.total,0),avg=sales.length?revenue/sales.length:0;
  const soldItemRows=sales.flatMap(s=>s.items),missingCostLines=soldItemRows.filter(i=>Number(i.unitCost??db.tenantProducts.find(p=>p.id===i.productId)?.cost??0)<=0).length,cost=soldItemRows.reduce((sum,i)=>sum+i.qty*Number(i.unitCost??db.tenantProducts.find(p=>p.id===i.productId)?.cost??0),0),gross=revenue-cost,grossReliable=missingCostLines===0;
  const purchased=purchases.reduce((n,p)=>n+p.total,0),payable=purchases.reduce((n,p)=>n+Math.max(0,p.total-(p.paidAmount??0)),0),receivable=credits.reduce((n,c)=>n+c.balance,0),supplierPaid=supplierPayments.reduce((n,p)=>n+p.amount,0),cashNet=cashMovements.reduce((n,m)=>n+(m.type==="in"?m.amount:-m.amount),0),closedCash=cashSessions.filter(s=>s.status==="closed").length;
  const validTransfers=transferPaymentEvents(db,ctx.tenantId,effectiveScope==="branch"?ctx.branchId:undefined)
    .filter(entry=>entry.status==="registrada"&&inPeriod(entry.at)&&historyRecordVisibleAfterReset({branchId:entry.branchId,createdAt:entry.at},settings));
  const creditPaymentsInPeriod=db.creditPayments.filter(p=>p.tenantId===ctx.tenantId&&branchAllowed(p.branchId)&&inPeriod(p.createdAt)&&historyRecordVisibleAfterReset(p,settings));
  const creditsById=new Map(db.credits.filter(c=>c.tenantId===ctx.tenantId).map(c=>[`${c.branchId}:${c.id}`,c]));
  const salesById=new Map(db.sales.filter(s=>s.tenantId===ctx.tenantId).map(s=>[`${s.branchId}:${s.id}`,s]));
  const countedPayments=new Set<string>();
  const cashFromAbonos=creditPaymentsInPeriod.reduce((sum,p)=>{
    const key=`${p.branchId}:${p.id}`;
    if(countedPayments.has(key)||p.method!=="cash"||!Number.isFinite(p.amount)||p.amount<=0)return sum;
    countedPayments.add(key);
    const credit=creditsById.get(`${p.branchId}:${p.creditId}`);
    const sale=credit?.saleId?salesById.get(`${p.branchId}:${credit.saleId}`):undefined;
    return credit&&(!sale||saleLifecycle(sale)==="completed")?sum+p.amount:sum;
  },0);
  const cashFromSales=sales.reduce((sum,sale)=>{
    if(sale.payment==="cash")return sum+sale.total;
    if(sale.payment!=="mixed")return sum;
    const transfer=validTransfers.find(entry=>entry.saleId===sale.id&&entry.branchId===sale.branchId&&entry.id.startsWith("sale:"));
    return transfer?sum+Math.max(0,sale.total-transfer.amount):sum;
  },0);
  const transferReceived=validTransfers.reduce((sum,entry)=>sum+entry.amount,0);
  const pendingBalances=sales.reduce((sum,sale)=>{
    if(sale.payment!=="partial"&&sale.payment!=="credit")return sum;
    const credit=db.credits.find(c=>c.tenantId===ctx.tenantId&&c.branchId===sale.branchId&&c.saleId===sale.id);
    return sum+Math.max(0,credit?.balance??sale.total);
  },0);
  const paymentTotals=[
    {method:"Efectivo recibido",total:cashFromSales+cashFromAbonos},
    {method:"Transferencias recibidas",total:transferReceived},
    {method:"Saldo pendiente actual",total:pendingBalances},
  ];
  const reportProductKinds=new Map(db.tenantProducts.filter(p=>p.tenantId===ctx.tenantId).map(p=>[`${p.branchId}:${p.id}`,productKind(p)]));
  const excludedProductLines={courtesy:0,internal:0,charge:0};
  const productSummary=(()=>{
    const map=new Map<string,{id:string;name:string;qty:number;revenue:number;tickets:Set<string>}>();
    const visited=new Set<string>();
    for(const sale of sales){
      const saleKey=`${sale.branchId}:${sale.id}`;
      if(visited.has(saleKey))continue;
      visited.add(saleKey);
      for(const item of sale.items){
        const meta=parseOperationalItemName(item.name);
        const kind=reportProductKinds.get(`${sale.branchId}:${item.productId}`);
        if(meta.mode==="courtesy"){excludedProductLines.courtesy+=item.qty;continue}
        if(meta.mode==="internal"){excludedProductLines.internal+=item.qty;continue}
        if(kind==="charge"||item.productId==="yuki-service-packaging"){excludedProductLines.charge+=item.qty;continue}
        if(kind==="ingredient"||kind==="option")continue;
        const key=`${sale.branchId}:${item.productId}`;
        const row=map.get(key)||{id:key,name:meta.displayName,qty:0,revenue:0,tickets:new Set<string>()};
        row.qty+=item.qty;
        row.revenue+=item.qty*item.unitPrice;
        row.tickets.add(saleKey);
        map.set(key,row);
      }
    }
    return [...map.values()].sort((a,b)=>b.qty-a.qty||b.revenue-a.revenue||a.name.localeCompare(b.name,"es"));
  })();
  const topProducts=productSummary.slice(0,6),totalUnits=productSummary.reduce((sum,item)=>sum+item.qty,0);
  const ingredientRows=ingredientConsumptionRows(sales,db.tenantProducts,db.stockMovements);
  const closedReconciliations=cashSessions.filter(s=>s.status==="closed").map(session=>({session,reconciliation:reconcileCashSession(db,session)})).sort((a,b)=>(b.session.closedAt??b.session.openedAt).localeCompare(a.session.closedAt??a.session.openedAt)),cashDifferenceTotal=closedReconciliations.reduce((sum,row)=>sum+(row.reconciliation.difference??0),0);
  const branches=db.branches.filter(b=>b.tenantId===ctx.tenantId&&b.active),branchSummary=branches.map(branch=>{const branchSales=db.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===branch.id&&saleVisibleAfterHistoryReset(s,settings)&&inPeriod(s.createdAt)&&saleLifecycle(s)==="completed"),branchPurchases=db.purchases.filter(p=>p.tenantId===ctx.tenantId&&p.branchId===branch.id&&p.status!=="cancelled"&&inPeriod(p.createdAt)),branchCredits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&c.branchId===branch.id&&c.status==="open"&&outstandingBalanceKind(db,c)!=="partial"),salesTotal=branchSales.reduce((n,s)=>n+s.total,0);return{branch,sales:branchSales.length,revenue:salesTotal,purchases:branchPurchases.reduce((n,p)=>n+p.total,0),payable:branchPurchases.reduce((n,p)=>n+Math.max(0,p.total-(p.paidAmount??0)),0),receivable:branchCredits.reduce((n,c)=>n+c.balance,0)}});

  const setPreset=(kind:"today"|"week"|"month"|"all")=>{const today=businessTodayKey(timeZone);if(kind==="all"){setFrom("");setTo("");return}setTo(today);if(kind==="today")setFrom(today);if(kind==="week")setFrom(addBusinessDays(today,-6));if(kind==="month")setFrom(`${today.slice(0,7)}-01`)};
  const confirmVoid=()=>{if(!voidSaleId)return;const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),sale=next.sales.find(s=>s.id===voidSaleId&&s.tenantId===workspace.tenantId);if(!sale){setActionMessage("La venta ya no está disponible en este dispositivo");setVoidSaleId("");return}const result=reverseSaleLocally(next,sale.id,voidReason);setActionMessage(result.message);if(!result.ok)return;saveLocalDatabase(next,{trackChanges:false});refresh();setVoidSaleId("");setVoidReason("")};

  return <div className={styles.page}>
    <section className={styles.context}><div><span>NEGOCIO</span><strong>{ctx.tenant?.name}</strong></div><div><span>VISTA</span><strong>{effectiveScope==="tenant"?"Consolidado":"Sucursal actual"}</strong></div><div><span>PERÍODO · HORA DEL NEGOCIO</span><strong>{from||to?`${from||"Inicio"} → ${to||"Hoy"}`:"Todo el historial"}</strong></div></section>
    <section className={styles.filters}><div className={styles.presets}><button onClick={()=>setPreset("today")}>Hoy</button><button onClick={()=>setPreset("week")}>7 días</button><button onClick={()=>setPreset("month")}>Este mes</button><button onClick={()=>setPreset("all")}>Todo</button></div><label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{canConsolidate&&<label>Alcance<select value={scope} onChange={e=>setScope(e.target.value as "branch"|"tenant")}><option value="branch">Sucursal actual</option><option value="tenant">Todo el negocio</option></select></label>}</section>
    {actionMessage&&<div className={styles.notice}>{actionMessage}</div>}
    <section className={styles.metrics}><article><span>Ventas</span><strong>{money(revenue)}</strong><small>{sales.length} ventas válidas</small></article><article><span>Ticket promedio</span><strong>{money(avg)}</strong><small>Promedio por venta</small></article><article className={!grossReliable?styles.metricWarn:""}><span>Utilidad bruta</span><strong>{grossReliable?money(gross):"—"}</strong><small>{grossReliable?"Venta menos costo histórico":`${missingCostLines} líneas sin costo · completa costos para estimar`}</small></article><article><span>Por cobrar</span><strong>{money(receivable)}</strong><small>Fiados abiertos</small></article></section>
    <section className={styles.mainGrid}><article className={styles.panel}><header><div><span>PRODUCTOS</span><h2>Más vendidos</h2><a className={styles.allProductsLink} href="#total-productos-vendidos">Ver todos los productos vendidos ↓</a></div><b>{sales.length} ventas</b></header><div className={styles.topList}>{topProducts.length?topProducts.map((item,index)=><div key={`${item.name}-${index}`}><span className={styles.rank}>{index+1}</span><div><strong>{item.name}</strong><small>{item.qty} unidades · {money(item.revenue)}</small></div><div className={styles.bar}><i style={{width:`${Math.max(8,(item.qty/(topProducts[0]?.qty||1))*100)}%`}}/></div></div>):<div className={styles.empty}>No hay ventas en este período.</div>}</div></article><article className={styles.panel}><header><div><span>MEDIOS DE PAGO</span><h2>Cómo pagaron</h2></div></header><div className={styles.paymentList}>{paymentTotals.map(item=><div key={item.method}><span>{item.method}</span><strong>{money(item.total)}</strong></div>)}</div></article></section>
    <section id="total-productos-vendidos" className={styles.panel}><header><div><span>LISTADO COMPLETO DEL PERÍODO</span><h2>Total vendido por producto</h2></div><b>{totalUnits} unidades comerciales</b></header><p className={styles.productReportNote}>Aquí aparecen todos los productos vendidos en el período seleccionado, no solo los más populares. Excluye {excludedProductLines.courtesy} unidades de cortesía, {excludedProductLines.internal} de consumo interno y {excludedProductLines.charge} cargos/servicios.</p>{productSummary.length?<div className={styles.productTable}><div className={styles.productHead}><span>Producto</span><span>Cantidad</span><span>Tickets</span><span>Total</span></div>{productSummary.map(item=><div className={styles.productRow} key={item.id}><strong>{item.name}</strong><b>{item.qty}</b><span>{item.tickets.size}</span><span>{money(item.revenue)}</span></div>)}</div>:<div className={styles.empty}>No hay productos vendidos en este período.</div>}</section>
    <section className={styles.panel}><header><div><span>INVENTARIO</span><h2>Ingredientes consumidos</h2></div><b>{ingredientRows.length} insumos</b></header>{ingredientRows.length?<div className={styles.ingredientTable}><div className={styles.ingredientHead}><span>Ingrediente</span><span>Consumo</span><span>Movimientos</span></div>{ingredientRows.map(row=><div className={styles.ingredientRow} key={row.name}><strong>{row.name}</strong><b>{formatStock(row.qty,row.unit)}</b><span>{row.sourceCount}</span></div>)}</div>:<div className={styles.empty}>No hay recetas o consumo registrado en este período.</div>}</section>
    <section className={styles.opsGrid}><article className={styles.panel}><header><div><span>CAJA</span><h2>Control operativo</h2></div></header><div className={styles.paymentList}><div><span>Sesiones</span><strong>{cashSessions.length}</strong></div><div><span>Cajas cerradas</span><strong>{closedCash}</strong></div><div><span>Movimientos netos</span><strong>{money(cashNet)}</strong></div><div><span>Diferencia de cierres</span><strong>{money(cashDifferenceTotal)}</strong></div></div></article><article className={styles.panel}><header><div><span>COMPRAS</span><h2>Compromisos</h2></div></header><div className={styles.paymentList}><div><span>Comprado</span><strong>{money(purchased)}</strong></div><div><span>Por pagar</span><strong>{money(payable)}</strong></div><div><span>Pagado a proveedores</span><strong>{money(supplierPaid)}</strong></div><div><span>Fiados por cobrar</span><strong>{money(receivable)}</strong></div></div></article></section>
    {canConsolidate&&effectiveScope==="tenant"&&<section className={styles.panel}><header><div><span>SUCURSALES</span><h2>Comparativo</h2></div></header><div className={styles.branchTable}><div className={styles.branchHead}><span>Sucursal</span><span>Ventas</span><span>Ingresos</span><span>Compras</span><span>Por cobrar</span></div>{branchSummary.map(row=><div className={styles.branchRow} key={row.branch.id}><strong>{row.branch.code} · {row.branch.name}</strong><span>{row.sales}</span><span>{money(row.revenue)}</span><span>{money(row.purchases)}</span><span>{money(row.receivable)}</span></div>)}</div></section>}
    <section className={styles.panel}><header><div><span>HISTORIAL</span><h2>Ventas recientes</h2></div><b>{saleHistory.length}</b></header>{voidSaleId&&<div className={styles.voidBox}><strong>Anular venta</strong><p>La venta seguirá visible para auditoría. Si corresponde, KIUBO restaura stock y registra la devolución.</p><input value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Motivo de anulación" maxLength={240}/><div><button onClick={confirmVoid}>Confirmar anulación</button><button onClick={()=>{setVoidSaleId("");setVoidReason("")}}>Cancelar</button></div></div>}<div className={styles.salesList}>{saleHistory.length===0?<div className={styles.empty}>No hay ventas para este filtro.</div>:saleHistory.slice(0,80).map(s=>{const lifecycle=saleLifecycle(s),details=s as SaleWithLifecycle,payment=salePaymentSummary(db,s),reversible=canReverse&&lifecycle==="completed"&&(s.payment==="cash"||s.payment==="transfer")&&(Date.now()-Date.parse(s.createdAt)<=24*60*60*1000);return <article className={styles.saleRow} key={s.id}><div className={styles.saleMain}><strong>{money(s.total)}</strong><span>{businessDateLabel(s.createdAt,timeZone,{dateStyle:"short",timeStyle:"short"})}</span></div><span className={lifecycle==="voided"?styles.voided:styles.payBadge}>{lifecycle==="voided"?"ANULADA":payment.label}</span><div className={styles.saleDetails}><small>{s.items.map(i=>`${i.qty}× ${i.name}`).join(" · ")}</small>{lifecycle!=="voided"&&<div className={styles.paymentFacts}><span>Pagado <b>{money(payment.paid)}</b></span>{payment.cash>0&&<span>Efectivo <b>{money(payment.cash)}</b></span>}{payment.transfer>0&&<span>Transferencia <b>{money(payment.transfer)}</b></span>}{payment.balance>0&&<span className={styles.pendingFact}>Pendiente <b>{money(payment.balance)}</b></span>}</div>}{details.voidReason&&<small>Motivo: {details.voidReason}</small>}</div><div className={styles.saleActions}>{lifecycle!=="voided"&&<a href={`/receipt?sale=${encodeURIComponent(s.id)}`} target="_blank" rel="noreferrer">Ver / imprimir</a>}{reversible&&<button onClick={()=>{setVoidSaleId(s.id);setVoidReason("");setActionMessage("")}}>Anular</button>}</div></article>})}</div></section>
  </div>;
}
