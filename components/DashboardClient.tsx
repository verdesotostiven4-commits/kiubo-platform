"use client";
import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { getOpenCashSession,getTenantSettings,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { saleVisibleAfterHistoryReset } from "@/lib/sale-adjustments";
import { PLAN_CATALOG,type CommercialPlan } from "@/lib/entitlements";
import { lowStockThreshold } from "@/lib/recipe-inventory";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import { DashboardSalesExplorer } from "./DashboardSalesExplorer";

const money=(value:number)=>`$${value.toFixed(2)}`;
const paymentLabel={cash:"Efectivo",transfer:"Transferencia",mixed:"Mixto",credit:"Fiado"} as const;
type DashboardRange="today"|"7d"|"30d"|"month"|"custom";
const rangeCopy:Record<DashboardRange,{button:string;title:string;short:string;hint:string}>={
  today:{button:"Hoy",title:"Ventas de hoy",short:"hoy",hint:"Hora por hora"},
  "7d":{button:"7 días",title:"Últimos 7 días",short:"7 días",hint:"Día por día"},
  "30d":{button:"30 días",title:"Últimos 30 días",short:"30 días",hint:"Tendencia completa"},
  month:{button:"Este mes",title:"Mes actual",short:"este mes",hint:"Desde el día 1"},
  custom:{button:"Fechas",title:"Rango personalizado",short:"rango elegido",hint:"Elige desde / hasta"},
};
const startOfDay=(date=new Date())=>{const value=new Date(date);value.setHours(0,0,0,0);return value};
const addDays=(date:Date,days:number)=>new Date(date.getTime()+days*86400000);
const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const dateFromInput=(value:string,fallback:Date)=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):startOfDay(fallback)};

function getPeriodBounds(range:DashboardRange,customFrom?:string,customTo?:string){
  const now=new Date(),today=startOfDay(now),periodEnd=new Date(now.getTime()+1);
  if(range==="today")return{periodStart:today,periodEnd,previousStart:addDays(today,-1),previousEnd:today};
  if(range==="7d"){const periodStart=addDays(today,-6);return{periodStart,periodEnd,previousStart:addDays(periodStart,-7),previousEnd:periodStart}}
  if(range==="30d"){const periodStart=addDays(today,-29);return{periodStart,periodEnd,previousStart:addDays(periodStart,-30),previousEnd:periodStart}}
  if(range==="custom"){
    const first=dateFromInput(customFrom||"",addDays(today,-6)),last=dateFromInput(customTo||"",today),periodStart=first<=last?first:last,lastDay=first<=last?last:first,customEnd=addDays(lastDay,1),days=Math.max(1,Math.round((customEnd.getTime()-periodStart.getTime())/86400000));
    return{periodStart,periodEnd:customEnd,previousStart:addDays(periodStart,-days),previousEnd:periodStart};
  }
  const periodStart=new Date(today.getFullYear(),today.getMonth(),1),previousStart=new Date(today.getFullYear(),today.getMonth()-1,1),previousEnd=periodStart;
  return{periodStart,periodEnd,previousStart,previousEnd};
}

export function DashboardClient(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[range,setRange]=useState<DashboardRange>("7d");
  const[customFrom,setCustomFrom]=useState(()=>localDate(addDays(new Date(),-6)));
  const[customTo,setCustomTo]=useState(()=>localDate(new Date()));
  const[paymentHelpOpen,setPaymentHelpOpen]=useState(false);

  useEffect(()=>{const refresh=()=>setDb(loadLocalDatabase());refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  const ctx=useMemo(()=>db?getWorkspaceContext(db):null,[db]);

  const dashboard=useMemo(()=>{
    if(!db||!ctx)return null;
    const settings=getTenantSettings(db,ctx.tenantId),sales=db.sales.filter(s=>s.tenantId===ctx.tenantId&&s.branchId===ctx.branchId&&saleVisibleAfterHistoryReset(s,settings)),bounds=getPeriodBounds(range,customFrom,customTo),now=new Date(),today=startOfDay(now);
    const inPeriod=sales.filter(s=>{const stamp=new Date(s.createdAt).getTime();return stamp>=bounds.periodStart.getTime()&&stamp<bounds.periodEnd.getTime()});
    const previous=sales.filter(s=>{const stamp=new Date(s.createdAt).getTime();return stamp>=bounds.previousStart.getTime()&&stamp<bounds.previousEnd.getTime()});
    const total=inPeriod.reduce((sum,s)=>sum+s.total,0),previousTotal=previous.reduce((sum,s)=>sum+s.total,0),trend=previousTotal>0?((total-previousTotal)/previousTotal)*100:total>0?100:0,avgTicket=inPeriod.length?total/inPeriod.length:0;
    const paymentTotals={cash:0,transfer:0,credit:0,mixed:0};for(const sale of inPeriod)paymentTotals[sale.payment]+=sale.total;
    const sold=new Map<string,{name:string,qty:number}>();for(const sale of inPeriod)for(const item of sale.items){if(item.name==="Envase")continue;const current=sold.get(item.productId)||{name:item.name,qty:0};current.qty+=item.qty;sold.set(item.productId,current)}
    const top=[...sold.values()].sort((a,b)=>b.qty-a.qty).slice(0,5);

    let chart:{key:string;label:string;total:number}[]=[];
    if(range==="today")chart=Array.from({length:6},(_,index)=>{const start=index*4,end=start+4,total=sales.filter(s=>{const date=new Date(s.createdAt);return date>=today&&date<=now&&date.getHours()>=start&&date.getHours()<end}).reduce((sum,s)=>sum+s.total,0);return{key:`h${start}`,label:`${String(start).padStart(2,"0")}:00`,total}});
    if(range==="7d")chart=Array.from({length:7},(_,index)=>{const date=addDays(bounds.periodStart,index),next=addDays(date,1),total=sales.filter(s=>{const stamp=new Date(s.createdAt);return stamp>=date&&stamp<next}).reduce((sum,s)=>sum+s.total,0);return{key:date.toISOString(),label:new Intl.DateTimeFormat("es-EC",{weekday:"short"}).format(date).replace(".",""),total}});
    if(range==="30d")chart=Array.from({length:10},(_,index)=>{const start=addDays(bounds.periodStart,index*3),end=addDays(start,3),total=sales.filter(s=>{const stamp=new Date(s.createdAt);return stamp>=start&&stamp<end&&stamp<bounds.periodEnd}).reduce((sum,s)=>sum+s.total,0);return{key:start.toISOString(),label:new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(start).replace(".",""),total}});
    if(range==="month"){
      const elapsed=Math.max(1,Math.ceil((today.getTime()-bounds.periodStart.getTime())/86400000)+1),points=Math.min(7,elapsed),bucket=Math.max(1,Math.ceil(elapsed/points));
      chart=Array.from({length:points},(_,index)=>{const start=addDays(bounds.periodStart,index*bucket),end=addDays(start,bucket),total=sales.filter(s=>{const stamp=new Date(s.createdAt);return stamp>=start&&stamp<end&&stamp<bounds.periodEnd}).reduce((sum,s)=>sum+s.total,0);return{key:start.toISOString(),label:new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(start).replace(".",""),total}});
    }
    if(range==="custom"){
      const elapsed=Math.max(1,Math.ceil((bounds.periodEnd.getTime()-bounds.periodStart.getTime())/86400000)),points=Math.min(10,elapsed),bucket=Math.max(1,Math.ceil(elapsed/points));
      chart=Array.from({length:points},(_,index)=>{const start=addDays(bounds.periodStart,index*bucket),end=new Date(Math.min(addDays(start,bucket).getTime(),bounds.periodEnd.getTime())),total=sales.filter(s=>{const stamp=new Date(s.createdAt);return stamp>=start&&stamp<end}).reduce((sum,s)=>sum+s.total,0);return{key:start.toISOString(),label:new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(start).replace(".",""),total}}).filter(point=>new Date(point.key)<bounds.periodEnd);
    }
    const chartWithSales=chart.map((point,index)=>{let start:Date,end:Date;if(range==="today"){const hour=Number(point.key.replace("h",""))||0;start=new Date(today);start.setHours(hour,0,0,0);end=new Date(today);end.setHours(hour+4,0,0,0)}else{start=new Date(point.key);end=index+1<chart.length?new Date(chart[index+1].key):bounds.periodEnd}const pointSales=inPeriod.filter(s=>{const stamp=new Date(s.createdAt);return stamp>=start&&stamp<end});return{...point,sales:pointSales}});
    const best=chartWithSales.reduce((winner,item)=>item.total>winner.total?item:winner,chartWithSales[0]||{key:"none",label:"—",total:0,sales:[]});
    return{sales,inPeriod,total,previousTotal,trend,avgTicket,paymentTotals,top,chart:chartWithSales,best};
  },[db,ctx,range,customFrom,customTo]);

  if(!db||!ctx||!dashboard)return <div className="loading-card">Preparando inicio…</div>;
  const tenant=ctx.tenant;if(!tenant||tenant.plan==="Internal")return <div className="loading-card">Selecciona un negocio comercial.</div>;
  const products=db.tenantProducts.filter(p=>p.tenantId===ctx.tenantId&&p.branchId===ctx.branchId&&p.active&&p.barcode!=="YUKI-ENVASE"),customers=db.customers.filter(c=>c.tenantId===ctx.tenantId),low=products.filter(p=>p.trackStock!==false&&p.stock<=lowStockThreshold(p)),cash=getOpenCashSession(db,ctx.tenantId,ctx.branchId);
  const recent=[...dashboard.sales].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5),today=startOfDay(),salesToday=dashboard.sales.filter(s=>new Date(s.createdAt)>=today),cashSales=salesToday.filter(s=>s.payment==="cash").reduce((n,s)=>n+s.total,0),transferSales=salesToday.filter(s=>s.payment==="transfer").reduce((n,s)=>n+s.total,0),todayTotal=salesToday.reduce((n,s)=>n+s.total,0),plan=PLAN_CATALOG[tenant.plan as CommercialPlan];
  const paymentGrand=Math.max(.01,Object.values(dashboard.paymentTotals).reduce((sum,value)=>sum+value,0)),cashPct=dashboard.paymentTotals.cash/paymentGrand*100,transferPct=dashboard.paymentTotals.transfer/paymentGrand*100,creditPct=dashboard.paymentTotals.credit/paymentGrand*100,mixedPct=dashboard.paymentTotals.mixed/paymentGrand*100;
  const donut=`conic-gradient(#123f31 0 ${cashPct}%, #3c82f6 ${cashPct}% ${cashPct+transferPct}%, #f4a000 ${cashPct+transferPct}% ${cashPct+transferPct+creditPct}%, #ff5b55 ${cashPct+transferPct+creditPct}% ${cashPct+transferPct+creditPct+mixedPct}%, #eef3f0 0)`;
  const payments=[{key:"cash",label:"Efectivo",amount:dashboard.paymentTotals.cash,pct:cashPct},{key:"transfer",label:"Transferencia",amount:dashboard.paymentTotals.transfer,pct:transferPct},{key:"credit",label:"Fiado",amount:dashboard.paymentTotals.credit,pct:creditPct},{key:"mixed",label:"Mixto",amount:dashboard.paymentTotals.mixed,pct:mixedPct}].filter(item=>item.amount>0||item.key!=="mixed");
  const dominant=[...payments].sort((a,b)=>b.amount-a.amount)[0];
  const periodLabel=range==="custom"?`${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(dateFromInput(customFrom,new Date()))} – ${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(dateFromInput(customTo,new Date()))}`:rangeCopy[range].title;
  const periodShort=range==="custom"?"rango elegido":rangeCopy[range].short;

  return <div className="ref-business-dashboard dashboard-v3">
    <header className="ref-app-topbar"><div className="ref-app-search">⌕ <span>Buscar en KIUBO</span><kbd>Ctrl K</kbd></div><div className="ref-topbar-actions"><div className="ref-user-chip"><span>{(ctx.user?.name||"K").slice(0,1).toUpperCase()}</span><div><strong>{ctx.user?.name||"Usuario"}</strong><small>{ctx.user?.role||""}</small></div></div></div></header>

    <section className="ref-dashboard-title dashboard-title-v3"><div><span className="dashboard-live-dot">● EN VIVO</span><h1>Inicio</h1><p>{tenant.name} · {ctx.branch?.name||"Matriz"}</p></div><div className="dashboard-period-summary"><span>{periodLabel}</span><strong>{money(dashboard.total)}</strong><small className={dashboard.trend>=0?"up":"down"}>{dashboard.trend>=0?"↗":"↘"} {Math.abs(dashboard.trend).toFixed(0)}% vs. período anterior</small></div></section>

    <section className="dashboard-period-toolbar" aria-label="Cambiar período del tablero">
      <div className="dashboard-period-copy"><span>VER RESULTADOS DE</span><strong>{periodLabel}</strong></div>
      <div className="dashboard-range-switch dashboard-range-switch-v3">{(Object.keys(rangeCopy) as DashboardRange[]).map(key=><button key={key} aria-pressed={range===key} className={range===key?"active":""} onClick={()=>setRange(key)}><b>{rangeCopy[key].button}</b><small>{rangeCopy[key].hint}</small></button>)}</div>{range==="custom"&&<div className="dashboard-custom-range"><label>Desde<input type="date" value={customFrom} max={customTo} onChange={e=>setCustomFrom(e.target.value||customFrom)}/></label><label>Hasta<input type="date" value={customTo} min={customFrom} max={localDate(new Date())} onChange={e=>setCustomTo(e.target.value||customTo)}/></label><small>Todo el tablero usa estas mismas fechas.</small></div>}
    </section>

    <section className="dashboard-period-insights dashboard-range-enter" key={`insights-${range}`}>
      <article><span>Ventas</span><strong>{money(dashboard.total)}</strong><small>{periodShort}</small></article>
      <article><span>Transacciones</span><strong>{dashboard.inPeriod.length}</strong><small>ventas registradas</small></article>
      <article><span>Ticket promedio</span><strong>{money(dashboard.avgTicket)}</strong><small>por venta</small></article>
      <article><span>Mejor momento</span><strong>{dashboard.best?.label||"—"}</strong><small>{money(dashboard.best?.total||0)}</small></article>
    </section>

    <section className="ref-kpi-grid dashboard-kpis-v3"><article><i className="green">▣</i><div><span>Productos activos</span><strong>{products.length}</strong><small>{low.length} con stock bajo</small></div></article><article><i className="purple">◎</i><div><span>Clientes</span><strong>{customers.length}</strong><small>Registrados en el negocio</small></div></article><article><i className="orange">▤</i><div><span>Caja</span><strong>{cash?"Abierta":"Cerrada"}</strong><small>{cash?`Desde ${new Date(cash.openedAt).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}`:"Lista para abrir"}</small></div></article><article className="dashboard-trend-kpi"><i className={dashboard.trend>=0?"green":"orange"}>{dashboard.trend>=0?"↗":"↘"}</i><div><span>Comparación</span><strong>{Math.abs(dashboard.trend).toFixed(0)}%</strong><small>{dashboard.trend>=0?"por encima":"por debajo"} del período anterior</small></div></article></section>

    <section className="dashboard-insight-grid dashboard-range-enter" key={`charts-${range}`}><DashboardSalesExplorer chart={dashboard.chart} total={dashboard.total} trend={dashboard.trend} periodLabel={periodLabel}/>

      <article className="ref-white-card dashboard-donut-card dashboard-donut-v3"><div className="ref-card-title"><div><span>Cómo te pagaron</span><small>{periodLabel}</small></div><button className="dashboard-info" type="button" aria-label="Cómo funciona este gráfico" aria-expanded={paymentHelpOpen} onClick={()=>setPaymentHelpOpen(v=>!v)}>i</button></div>{paymentHelpOpen&&<div className="dashboard-help-popover"><strong>Qué muestra este gráfico</strong><span>Reparte las ventas del período por efectivo, transferencia, fiado y pago mixto. Cambia automáticamente cuando eliges otro período arriba.</span></div>}<div className="dashboard-payment-highlight"><span>Principal</span><strong>{dominant?.label||"Sin ventas"}</strong><small>{dominant?`${dominant.pct.toFixed(1)}% del total`:"Aún sin datos"}</small></div><div className="dashboard-donut-wrap"><div className="dashboard-donut" style={{background:donut}}><div><small>Total</small><strong>{money(dashboard.total)}</strong><em>{dashboard.inPeriod.length} ventas</em></div></div><div className="dashboard-payment-legend">{payments.map(item=><div key={item.key}><i className={item.key}/><span>{item.label}<small>{item.pct.toFixed(1)}%</small></span><strong>{money(item.amount)}</strong></div>)}</div></div></article>

      <article className="ref-white-card ref-best-products dashboard-top-products"><div className="ref-card-title"><div><span>Más vendidos</span><small>{periodShort}</small></div><Link href="/reports">Ver todos</Link></div>{dashboard.top.length?dashboard.top.map((item,index)=><div className="ref-product-rank" key={`${item.name}-${index}`}><b>{item.name}</b><div><i style={{width:`${Math.max(20,100-index*16)}%`}}/></div><strong>{item.qty}</strong></div>):<div className="ref-empty-state"><b>Sin ventas todavía</b><span>Los favoritos aparecerán aquí.</span></div>}</article></section>

    <section className="ref-dashboard-secondary dashboard-secondary-v2"><article className="ref-white-card"><div className="ref-card-title"><div><span className="danger-text">Stock bajo</span><small>Atención de inventario</small></div><Link href="/inventory">Ver inventario</Link></div><div className="ref-stock-list">{low.slice(0,4).map(p=><div key={p.id}><span>{p.name}</span><b>{p.stock} unidades</b></div>)}{!low.length&&<div><span>Inventario saludable</span><b className="ok-text">Sin alertas</b></div>}</div></article><article className="ref-white-card"><div className="ref-card-title"><div><span>Caja actual</span><small>{cash?"Turno abierto":"Sin turno"}</small></div><span className={`ref-status-dot ${cash?"open":""}`}>{cash?"Abierta":"Cerrada"}</span></div><div className="ref-cash-summary"><div><span>Fondo inicial</span><strong>{money(cash?.openingAmount||0)}</strong></div><div><span>Ventas en efectivo</span><strong>{money(cashSales)}</strong></div><div><span>Transferencias</span><strong>{money(transferSales)}</strong></div><div className="total"><span>Total vendido hoy</span><strong>{money(todayTotal)}</strong></div></div><Link href="/cash" className="button ref-outline-button">Ir a caja</Link></article><article className="ref-white-card ref-quick-card"><div className="ref-card-title"><div><span>Acciones rápidas</span><small>Un toque y listo</small></div></div><div className="ref-quick-actions"><Link href="/pos"><i className="blue">▣</i><span>Nueva venta</span></Link><Link href="/orders"><i className="green">≡</i><span>Pedidos</span></Link><Link href="/customers"><i className="purple">◎</i><span>Clientes</span></Link><Link href="/reports"><i className="orange">↗</i><span>Reportes</span></Link></div></article></section>

    <section className="ref-dashboard-bottom"><article className="ref-white-card"><div className="ref-card-title"><div><span>Ventas recientes</span><small>Últimos movimientos</small></div><Link href="/reports">Ver todas</Link></div><div className="ref-sales-table"><div className="head"><span>Folio</span><span>Hora</span><span>Método</span><span>Total</span></div>{recent.length?recent.map(s=><div key={s.id}><span>{s.id.slice(-8).toUpperCase()}</span><span>{new Date(s.createdAt).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}</span><span>{paymentLabel[s.payment]}</span><strong>{money(s.total)}</strong></div>):<div className="ref-empty-row">Todavía no hay ventas registradas.</div>}</div></article><article className="ref-white-card ref-plan-summary dashboard-plan-mini"><span className="public-kicker">TU PLAN</span><h3>KIUBO {tenant.plan}</h3><p>{plan.tagline}</p><div className="dashboard-plan-feature-count"><strong>{plan.features.length}</strong><span>capacidades incluidas</span></div><Link href="/upgrade">Ver plan y módulos →</Link></article></section>
  </div>;
}