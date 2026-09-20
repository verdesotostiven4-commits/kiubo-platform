"use client";

import { useEffect,useState } from "react";
import { SaleRecord,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase } from "@/lib/local-store";
import { reconcileCashSession } from "@/lib/cash-reconciliation";
import { reverseSaleLocally,saleLifecycle,type SaleWithLifecycle } from "@/lib/sale-reversal";

const label:Record<SaleRecord["payment"],string>={cash:"Efectivo",transfer:"Transferencia",mixed:"Mixto",partial:"Pago parcial",credit:"Fiado"};
const money=(value:number)=>`$${value.toFixed(2)}`;
const dateOnly=(iso:string)=>iso.slice(0,10);

export function ReportsClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[from,setFrom]=useState("");
  const[to,setTo]=useState("");
  const[scope,setScope]=useState<"branch"|"tenant">("branch");
  const[voidSaleId,setVoidSaleId]=useState("");
  const[voidReason,setVoidReason]=useState("");
  const[actionMessage,setActionMessage]=useState("");
  useEffect(()=>setDb(loadLocalDatabase()),[]);
  if(!db)return <div className="loading-card">Preparando reportes…</div>;

  const ctx=getWorkspaceContext(db);
  const canConsolidate=Boolean(ctx.user?.platformAdmin||ctx.user?.role==="owner"||ctx.user?.role==="admin");
  const canReverse=Boolean(ctx.user?.platformAdmin||ctx.user?.role==="owner"||ctx.user?.role==="admin");
  const effectiveScope=canConsolidate?scope:"branch";
  const inPeriod=(iso:string)=>{const day=dateOnly(iso);return(!from||day>=from)&&(!to||day<=to)};
  const branchAllowed=(branchId:string)=>effectiveScope==="tenant"||branchId===ctx.branchId;
  const saleHistory=db.sales.filter(s=>s.tenantId===ctx.tenantId&&branchAllowed(s.branchId)&&inPeriod(s.createdAt));
  const sales=saleHistory.filter(s=>saleLifecycle(s)==="completed");
  const purchases=db.purchases.filter(p=>p.tenantId===ctx.tenantId&&branchAllowed(p.branchId)&&p.status!=="cancelled"&&inPeriod(p.createdAt));
  const supplierPayments=db.supplierPayments.filter(p=>p.tenantId===ctx.tenantId&&branchAllowed(p.branchId)&&inPeriod(p.createdAt));
  const cashSessions=db.cashSessions.filter(s=>s.tenantId===ctx.tenantId&&branchAllowed(s.branchId)&&inPeriod(s.openedAt));
  const cashMovements=db.cashMovements.filter(m=>m.tenantId===ctx.tenantId&&branchAllowed(m.branchId)&&inPeriod(m.createdAt));
  const credits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&branchAllowed(c.branchId)&&c.status==="open");
  const revenue=sales.reduce((sum,s)=>sum+s.total,0);
  const cost=sales.reduce((sum,s)=>sum+s.items.reduce((n,i)=>{const product=db.tenantProducts.find(p=>p.id===i.productId);return n+i.qty*(i.unitCost??product?.cost??0)},0),0);
  const gross=revenue-cost,avg=sales.length?revenue/sales.length:0;
  const purchased=purchases.reduce((n,p)=>n+p.total,0),payable=purchases.reduce((n,p)=>n+Math.max(0,p.total-(p.paidAmount??0)),0),receivable=credits.reduce((n,c)=>n+c.balance,0),supplierPaid=supplierPayments.reduce((n,p)=>n+p.amount,0);
  const cashNet=cashMovements.reduce((n,m)=>n+(m.type==="in"?m.amount:-m.amount),0),closedCash=cashSessions.filter(s=>s.status==="closed").length;
  const paymentTotals=(Object.keys(label) as SaleRecord["payment"][]).map(method=>({method,total:sales.filter(s=>s.payment===method).reduce((n,s)=>n+s.total,0)}));
  const closedReconciliations=cashSessions.filter(s=>s.status==="closed").map(session=>({session,reconciliation:reconcileCashSession(db,session)})).sort((a,b)=>(b.session.closedAt??b.session.openedAt).localeCompare(a.session.closedAt??a.session.openedAt));
  const cashDifferenceTotal=closedReconciliations.reduce((sum,row)=>sum+(row.reconciliation.difference??0),0);
  const branches=db.branches.filter(b=>b.tenantId===ctx.tenantId&&b.active);
  const branchSummary=branches.map(branch=>{
    const branchSales=db.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===branch.id&&inPeriod(s.createdAt)&&saleLifecycle(s)==="completed");
    const branchPurchases=db.purchases.filter(p=>p.tenantId===ctx.tenantId&&p.branchId===branch.id&&p.status!=="cancelled"&&inPeriod(p.createdAt));
    const branchCredits=db.credits.filter(c=>c.tenantId===ctx.tenantId&&c.branchId===branch.id&&c.status==="open");
    const salesTotal=branchSales.reduce((n,s)=>n+s.total,0),salesCost=branchSales.reduce((sum,s)=>sum+s.items.reduce((n,i)=>n+i.qty*(i.unitCost??db.tenantProducts.find(p=>p.id===i.productId)?.cost??0),0),0);
    return{branch,sales:branchSales.length,revenue:salesTotal,gross:salesTotal-salesCost,purchases:branchPurchases.reduce((n,p)=>n+p.total,0),payable:branchPurchases.reduce((n,p)=>n+Math.max(0,p.total-(p.paidAmount??0)),0),receivable:branchCredits.reduce((n,c)=>n+c.balance,0)};
  });

  const confirmVoid=()=>{
    if(!voidSaleId)return;
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),sale=next.sales.find(s=>s.id===voidSaleId&&s.tenantId===workspace.tenantId);
    if(!sale){setActionMessage("La venta ya no está disponible en este dispositivo");setVoidSaleId("");return}
    const result=reverseSaleLocally(next,sale.id,voidReason);
    setActionMessage(result.message);
    if(!result.ok)return;
    saveLocalDatabase(next,{trackChanges:false});
    setDb(loadLocalDatabase());setVoidSaleId("");setVoidReason("");
  };

  return <>
    <div className="workspace-banner"><div><span>NEGOCIO</span><strong>{ctx.tenant?.name}</strong></div><div><span>ALCANCE</span><strong>{effectiveScope==="tenant"?"Todas las sucursales":`${ctx.branch?.code} · ${ctx.branch?.name}`}</strong></div><div><span>PERÍODO</span><strong>{from||to?`${from||"Inicio"} → ${to||"Hoy"}`:"Histórico local"}</strong></div></div>
    <section className="report-toolbar"><label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{canConsolidate&&<label>Vista<select value={scope} onChange={e=>setScope(e.target.value as "branch"|"tenant")}><option value="branch">Sucursal actual</option><option value="tenant">Consolidado negocio</option></select></label>}<button className="button secondary compact" onClick={()=>{setFrom("");setTo("")}}>Limpiar fechas</button></section>
    {actionMessage&&<p className="cart-note">{actionMessage}</p>}
    <section className="metric-grid"><article className="metric-card"><span>Total vendido</span><strong>{money(revenue)}</strong><small>{sales.length} ventas válidas · ticket {money(avg)}</small></article><article className="metric-card"><span>Utilidad bruta estimada</span><strong>{money(gross)}</strong><small>Venta menos costo histórico</small></article><article className="metric-card"><span>Compras / Por pagar</span><strong>{money(purchased)}</strong><small>{money(payable)} pendiente · {money(supplierPaid)} pagado</small></article><article className="metric-card"><span>Por cobrar</span><strong>{money(receivable)}</strong><small>Fiados abiertos del alcance</small></article></section>
    <section className="report-summary-grid"><article className="panel"><span className="eyebrow">CAJA</span><h3>Resumen operativo</h3><div className="report-payment-list"><div><span>Sesiones de caja</span><strong>{cashSessions.length}</strong></div><div><span>Cajas cerradas</span><strong>{closedCash}</strong></div><div><span>Movimientos netos</span><strong>{money(cashNet)}</strong></div><div><span>Diferencia de cierres</span><strong>{money(cashDifferenceTotal)}</strong></div></div></article><article className="panel"><span className="eyebrow">MEDIOS DE PAGO</span><h3>Distribución de ventas</h3><div className="report-payment-list">{paymentTotals.map(item=><div key={item.method}><span>{label[item.method]}</span><strong>{money(item.total)}</strong></div>)}</div></article></section>
    {closedReconciliations.length>0&&<section className="panel"><div className="panel-head"><div><span className="eyebrow">CIERRES DE CAJA</span><h3>Cuadre esperado vs. contado</h3></div><span className="pill">{closedReconciliations.length}</span></div><div className="purchase-history">{closedReconciliations.slice(0,20).map(({session,reconciliation})=>{const branch=db.branches.find(b=>b.id===session.branchId),difference=reconciliation.difference??0,balanced=Math.abs(difference)<=.005;return <div className="purchase-history-row" key={session.id}><div><strong>{branch?`${branch.code} · ${branch.name}`:"Sucursal"}</strong><span>{new Date(session.closedAt??session.openedAt).toLocaleString("es-EC")} · {session.openedBy}</span></div><div><strong>Esperado {money(reconciliation.expected)}</strong><span>Contado {money(reconciliation.counted??0)}</span></div><small className={balanced?"":"due-overdue"}>{balanced?"Cuadrada":`${difference>0?"Sobra":"Falta"} ${money(Math.abs(difference))}`}</small></div>})}</div><p className="cart-note">El cuadre conserva los flujos físicos del turno: las ventas en efectivo cuentan como entrada y una anulación en efectivo se compensa con su egreso de devolución.</p></section>}
    {canConsolidate&&<section className="panel"><div className="panel-head"><div><span className="eyebrow">SUCURSALES</span><h3>Comparativo consolidado</h3></div><span className="pill">{branches.length}</span></div><div className="branch-report-table"><div className="branch-report-head"><span>Sucursal</span><span>Ventas</span><span>Ingresos</span><span>Utilidad</span><span>Compras</span><span>Por pagar</span><span>Por cobrar</span></div>{branchSummary.map(row=><div className="branch-report-row" key={row.branch.id}><strong>{row.branch.code} · {row.branch.name}</strong><span>{row.sales}</span><span>{money(row.revenue)}</span><span>{money(row.gross)}</span><span>{money(row.purchases)}</span><span>{money(row.payable)}</span><span>{money(row.receivable)}</span></div>)}</div></section>}
    <section className="grid-two report-bottom"><article className="panel"><div className="panel-head"><div><span className="eyebrow">VENTAS</span><h3>Historial filtrado</h3></div><span className="pill">{saleHistory.length}</span></div>{voidSaleId&&<div className="report-note"><strong>Anular venta</strong><span>Solo propietario o administrador. La anulación conserva el historial, devuelve el stock y solo está disponible durante las primeras 24 horas. Si fue efectivo, exige caja abierta y registra la devolución como egreso.</span><input value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Motivo de anulación" maxLength={240}/><div><button className="button primary compact" onClick={confirmVoid}>Confirmar anulación</button><button className="button secondary compact" onClick={()=>{setVoidSaleId("");setVoidReason("")}}>Cancelar</button></div></div>}<div className="sales-list">{saleHistory.length===0?<p className="empty-cart">No hay ventas para este filtro.</p>:saleHistory.slice(0,100).map(s=>{const lifecycle=saleLifecycle(s),details=s as SaleWithLifecycle,reversible=canReverse&&lifecycle==="completed"&&(s.payment==="cash"||s.payment==="transfer")&&(Date.now()-Date.parse(s.createdAt)<=24*60*60*1000);return <article className="sale-row" key={s.id}><div><strong>{money(s.total)}</strong><span>{new Date(s.createdAt).toLocaleString("es-EC")}</span></div><span className={lifecycle==="voided"?"status status-suspended":"pill"}>{lifecycle==="voided"?"ANULADA":label[s.payment]}</span><small>{s.items.map(i=>`${i.qty}× ${i.name}`).join(" · ")}</small>{details.voidReason&&<small>Motivo: {details.voidReason}</small>}{reversible&&<button className="button secondary compact" onClick={()=>{setVoidSaleId(s.id);setVoidReason("");setActionMessage("")}}>Anular venta</button>}</article>})}</div></article><article className="panel"><span className="eyebrow">LECTURA</span><h3>Qué significan estos números</h3><div className="report-note"><strong>Utilidad bruta</strong><span>Usa el costo guardado en la venta; no descuenta gastos, impuestos ni nómina.</span></div><div className="report-note"><strong>Ventas anuladas</strong><span>Permanecen visibles para auditoría, pero no suman ingresos ni utilidad. El stock se restaura mediante un movimiento separado.</span></div><div className="report-note"><strong>Por pagar</strong><span>Saldo de compras recibidas menos abonos registrados a proveedores.</span></div><div className="report-note"><strong>Cuadre de caja</strong><span>La diferencia compara el efectivo contado al cierre contra el efectivo que KIUBO esperaba por esa sesión.</span></div><div className="report-note"><strong>Consolidado</strong><span>Solo propietario, administrador y KIUBO Admin pueden sumar todas las sucursales.</span></div></article></section>
  </>;
}
