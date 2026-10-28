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
import { soldProductReport,yukiYogurtFlavorReport } from "@/lib/report-sold-products";
import { productKind } from "@/lib/product-classification";
import { transferPaymentEvents } from "@/lib/transfer-events";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./ReportsClientPro.module.css";

const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);

const normalizeCatalogQuery=(text:string)=>text.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es");
function ProductVariantChips({variants,search}:{variants:{label:string;qty:number}[];search:string}){
  const[expanded,setExpanded]=useState(false);
  const matches=search?variants.filter(v=>normalizeCatalogQuery(v.label).includes(search)):[];
  const relevant=matches.length?matches:variants;
  const visible=expanded?relevant:relevant.slice(0,3);
  const canExpand=relevant.length>3;
  return <div className={styles.productVariants}>
    {visible.map(v=><span key={v.label}>{v.label}: <b>{v.qty}</b></span>)}
    {canExpand&&<button type="button" className={styles.variantToggle} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
      {expanded?"Ocultar combinaciones":`Ver ${relevant.length-3} combinaciones más`}
    </button>}
  </div>;
}

export function ReportsClientPro(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[from,setFrom]=useState("");const[to,setTo]=useState("");const[scope,setScope]=useState<"branch"|"tenant">("branch");
  const[productSearch,setProductSearch]=useState("");
  const[onlySold,setOnlySold]=useState(false);
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
  const {summary:productSummary,excluded:excludedProductLines,totalUnits}=soldProductReport(sales,db.tenantProducts.filter(p=>p.tenantId===ctx.tenantId));
  const topProducts=productSummary.slice(0,6);
  // Merge the current menu with actual historic sales. Zero-sale menu items
  // are shown, while archived products appear only if they actually sold.
  const rowsByProduct=new Map(productSummary.map(row=>[row.id,row]));
  const menuProducts=db.tenantProducts.filter(p=>p.tenantId===ctx.tenantId&&branchAllowed(p.branchId)&&p.active&&productKind(p)==="sellable");
  for(const p of menuProducts){
    const key=`${p.branchId}:${p.id}`;
    if(!rowsByProduct.has(key)){
      rowsByProduct.set(key,{id:key,name:p.name,qty:0,revenue:0,tickets:new Set<string>(),variants:[]});
    }
  }
  const allProductRows=[...rowsByProduct.values()].sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name,"es"));
  const extrasByKey=new Set(db.tenantProducts.filter(p=>p.tenantId===ctx.tenantId&&String(p.category||"").trim().toLocaleLowerCase("es")==="extras").map(p=>`${p.branchId}:${p.id}`));
  const isExtra=(row:{id:string;name:string})=>extrasByKey.has(row.id)||/^(domicilio|bolsa llevar)$/i.test(row.name.trim());
  const catalogProducts=allProductRows.filter(row=>!isExtra(row));
  const extraProducts=allProductRows.filter(isExtra);
  const normSearch=normalizeCatalogQuery(productSearch);
  const matchesFilter=(row:{name:string;qty:number;variants:{label:string}[]})=>(!onlySold||row.qty>0)&&(!normSearch||normalizeCatalogQuery(row.name+" "+row.variants.map(v=>v.label).join(" ")).includes(normSearch));
  const productRows=catalogProducts.filter(matchesFilter);
  const extraRows=extraProducts.filter(matchesFilter);
  const productCountWithSales=catalogProducts.filter(row=>row.qty>0).length;
  const productUnitCount=catalogProducts.reduce((sum,row)=>sum+row.qty,0);
  const extraUnitCount=extraProducts.reduce((sum,row)=>sum+row.qty,0);
  const yogurtFlavors=ctx.tenant?.name?.trim().toLocaleUpperCase("es")==="YUKI"?yukiYogurtFlavorReport(sales):[];
  const yogurtPortions=yogurtFlavors.reduce((sum,row)=>sum+row.qty,0);
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
    <section id="total-productos-vendidos" className={`${styles.panel} ${styles.catalogReport}`}>
      <header className={styles.catalogReportHeader}><div><span>CONTROL DE VENTAS · CARTA COMPLETA</span><h2>Todos los productos vendidos</h2><small>Unidades reales vendidas por producto, aunque haya vendido cero.</small></div><b>{productUnitCount} unidades de productos</b></header>
      <div className={styles.catalogSummary}><strong>{productCountWithSales} productos con ventas</strong><span>{catalogProducts.length-productCountWithSales} sin ventas</span><span>{sales.length} ventas válidas</span></div>
      <div className={styles.catalogTools}>
        <label>Buscar producto o sabor<input type="search" placeholder="Ej. yogurt naranjilla, sánduche de pollo…" value={productSearch} onChange={e=>setProductSearch(e.target.value)}/></label>
        <div className={styles.catalogToggle} aria-label="Filtrar productos">
          <button type="button" className={!onlySold?styles.catalogActive:""} aria-pressed={!onlySold} onClick={()=>setOnlySold(false)}>Toda la carta</button>
          <button type="button" className={onlySold?styles.catalogActive:""} aria-pressed={onlySold} onClick={()=>setOnlySold(true)}>Solo vendidos</button>
        </div>
      </div>
      <p className={styles.productReportNote}>Unidades: cantidad de productos. Ventas: número de tickets que los incluyeron (un ticket puede tener varias unidades). Se excluyen anulaciones, {excludedProductLines.courtesy} cortesías, {excludedProductLines.internal} consumos internos y {excludedProductLines.charge} cargos. Los extras se muestran aparte.</p>
      {yogurtFlavors.length>0&&<details className={styles.yogurtReport}>
        <summary className={styles.flavorSummary}><span><strong>Yogures por sabor</strong><small>Incluye los vendidos solos y dentro de combos</small></span><b>{yogurtPortions} porciones</b><span className={styles.expandHint}>Ver detalle</span></summary>
        <div className={styles.flavorRows}>{yogurtFlavors.map(flavor=><div key={flavor.name}><strong>Yogurt {flavor.name}</strong><b>{flavor.qty}</b></div>)}</div>
      </details>}
      {productRows.length?<div className={styles.productTable}>
        <div className={styles.productHead}><span>Producto de la carta</span><span>Unidades</span><span>Ventas</span><span>Importe</span></div>
        {productRows.map(item=><div className={styles.productRow} key={item.id}>
          <div className={styles.productLabel}><strong>{item.name}</strong>
            {item.variants.length>0&&<ProductVariantChips variants={item.variants} search={normSearch}/>}
            {item.qty===0&&<small className={styles.zeroSales}>Sin ventas en este período</small>}
          </div>
          <b className={item.qty===0?styles.zeroQuantity:""}>{item.qty}</b>
          <span>{item.tickets.size}</span>
          <span>{money(item.revenue)}</span>
        </div>)}
      </div>:<div className={styles.empty}>{catalogProducts.length?"No hay productos con ese filtro.":"Aún no hay productos de carta registrados."}</div>}
      {extraRows.length>0&&<details className={styles.extraDetails} open={Boolean(normSearch)}>
        <summary><span><strong>Servicios y extras</strong><small>Domicilios, bolsas y otros conceptos separados de alimentos</small></span><b>{extraUnitCount} unidades registradas</b></summary>
        <div className={styles.extrasRows}>{extraRows.map(row=><div key={row.id}><strong>{row.name}</strong><span>{row.qty} unidades · {row.tickets.size} ventas</span><b>{money(row.revenue)}</b></div>)}</div>
      </details>}

    </section>
    <section className={styles.mainGrid}><article className={styles.panel}><header><div><span>PRODUCTOS</span><h2>Más vendidos</h2><a className={styles.allProductsLink} href="#total-productos-vendidos">Ver todos los productos vendidos ↓</a></div><b>{sales.length} ventas</b></header><div className={styles.topList}>{topProducts.length?topProducts.map((item,index)=><div key={`${item.name}-${index}`}><span className={styles.rank}>{index+1}</span><div><strong>{item.name}</strong><small>{item.qty} unidades · {money(item.revenue)}</small></div><div className={styles.bar}><i style={{width:`${Math.max(8,(item.qty/(topProducts[0]?.qty||1))*100)}%`}}/></div></div>):<div className={styles.empty}>No hay ventas en este período.</div>}</div></article><article className={styles.panel}><header><div><span>MEDIOS DE PAGO</span><h2>Cómo pagaron</h2></div></header><div className={styles.paymentList}>{paymentTotals.map(item=><div key={item.method}><span>{item.method}</span><strong>{money(item.total)}</strong></div>)}</div></article></section>

    <section className={styles.panel}><header><div><span>INVENTARIO</span><h2>Ingredientes consumidos</h2><small>Movimientos de stock confirmados; lo histórico sin registro aparece como estimación según receta actual.</small></div><b>{ingredientRows.length} insumos</b></header>{ingredientRows.length?<div className={styles.ingredientTable}><div className={styles.ingredientHead}><span>Ingrediente</span><span>Consumo</span><span>Movimientos</span></div>{ingredientRows.map(row=><div className={styles.ingredientRow} key={row.name}><strong>{row.name}</strong><b>{formatStock(row.qty,row.unit)}{row.estimatedQty>0&&<small> · estimado histórico: {formatStock(row.estimatedQty,row.unit)}</small>}</b><span>{row.sourceCount} registrados{row.estimatedSources>0?` · ${row.estimatedSources} estimados`:""}</span></div>)}</div>:<div className={styles.empty}>No hay recetas o consumo registrado en este período.</div>}</section>
    <section className={styles.opsGrid}><article className={styles.panel}><header><div><span>CAJA</span><h2>Control operativo</h2></div></header><div className={styles.paymentList}><div><span>Sesiones</span><strong>{cashSessions.length}</strong></div><div><span>Cajas cerradas</span><strong>{closedCash}</strong></div><div><span>Movimientos netos</span><strong>{money(cashNet)}</strong></div><div><span>Diferencia de cierres</span><strong>{money(cashDifferenceTotal)}</strong></div></div></article><article className={styles.panel}><header><div><span>COMPRAS</span><h2>Compromisos</h2></div></header><div className={styles.paymentList}><div><span>Comprado</span><strong>{money(purchased)}</strong></div><div><span>Por pagar</span><strong>{money(payable)}</strong></div><div><span>Pagado a proveedores</span><strong>{money(supplierPaid)}</strong></div><div><span>Fiados por cobrar</span><strong>{money(receivable)}</strong></div></div></article></section>
    {canConsolidate&&effectiveScope==="tenant"&&<section className={styles.panel}><header><div><span>SUCURSALES</span><h2>Comparativo</h2></div></header><div className={styles.branchTable}><div className={styles.branchHead}><span>Sucursal</span><span>Ventas</span><span>Ingresos</span><span>Compras</span><span>Por cobrar</span></div>{branchSummary.map(row=><div className={styles.branchRow} key={row.branch.id}><strong>{row.branch.code} · {row.branch.name}</strong><span>{row.sales}</span><span>{money(row.revenue)}</span><span>{money(row.purchases)}</span><span>{money(row.receivable)}</span></div>)}</div></section>}
    <section className={styles.panel}><header><div><span>HISTORIAL</span><h2>Ventas recientes</h2></div><b>{saleHistory.length}</b></header>{voidSaleId&&<div className={styles.voidBox}><strong>Anular venta</strong><p>La venta seguirá visible para auditoría. Si corresponde, KIUBO restaura stock y registra la devolución.</p><input value={voidReason} onChange={e=>setVoidReason(e.target.value)} placeholder="Motivo de anulación" maxLength={240}/><div><button onClick={confirmVoid}>Confirmar anulación</button><button onClick={()=>{setVoidSaleId("");setVoidReason("")}}>Cancelar</button></div></div>}<div className={styles.salesList}>{saleHistory.length===0?<div className={styles.empty}>No hay ventas para este filtro.</div>:saleHistory.slice(0,80).map(s=>{const lifecycle=saleLifecycle(s),details=s as SaleWithLifecycle,payment=salePaymentSummary(db,s),reversible=canReverse&&lifecycle==="completed"&&(s.payment==="cash"||s.payment==="transfer")&&(Date.now()-Date.parse(s.createdAt)<=24*60*60*1000);return <article className={styles.saleRow} key={s.id}><div className={styles.saleMain}><strong>{money(s.total)}</strong><span>{businessDateLabel(s.createdAt,timeZone,{dateStyle:"short",timeStyle:"short"})}</span></div><span className={lifecycle==="voided"?styles.voided:styles.payBadge}>{lifecycle==="voided"?"ANULADA":payment.label}</span><div className={styles.saleDetails}><small>{s.items.map(i=>`${i.qty}× ${i.name}`).join(" · ")}</small>{lifecycle!=="voided"&&<div className={styles.paymentFacts}><span>Pagado <b>{money(payment.paid)}</b></span>{payment.cash>0&&<span>Efectivo <b>{money(payment.cash)}</b></span>}{payment.transfer>0&&<span>Transferencia <b>{money(payment.transfer)}</b></span>}{payment.balance>0&&<span className={styles.pendingFact}>Pendiente <b>{money(payment.balance)}</b></span>}</div>}{details.voidReason&&<small>Motivo: {details.voidReason}</small>}</div><div className={styles.saleActions}>{lifecycle!=="voided"&&<a href={`/receipt?sale=${encodeURIComponent(s.id)}`} target="_blank" rel="noreferrer">Ver / imprimir</a>}{reversible&&<button onClick={()=>{setVoidSaleId(s.id);setVoidReason("");setActionMessage("")}}>Anular</button>}</div></article>})}</div></section>
  </div>;
}
