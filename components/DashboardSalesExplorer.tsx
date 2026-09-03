"use client";

import Link from "next/link";
import { useState } from "react";
import type { SaleRecord } from "@/lib/local-store";

const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const paymentLabel:Record<SaleRecord["payment"],string>={cash:"Efectivo",transfer:"Transferencia",mixed:"Mixto",credit:"Fiado"};

type ChartPoint={key:string;label:string;total:number;sales:SaleRecord[]};

export function DashboardSalesExplorer({chart,total,trend,periodLabel}:{chart:ChartPoint[];total:number;trend:number;periodLabel:string}){
  const[selectedKey,setSelectedKey]=useState("");
  const selected=chart.find(point=>point.key===selectedKey);
  const max=Math.max(1,...chart.map(point=>point.total));
  const width=700,baseline=195,top=35,range=baseline-top;
  const xFor=(index:number)=>chart.length<=1?width/2:20+(index*(width-40))/(chart.length-1);
  const yFor=(value:number)=>baseline-(Math.max(0,value)/max)*range;
  const linePoints=chart.map((point,index)=>`${xFor(index)},${yFor(point.total)}`).join(" ");
  const areaPoints=chart.length?`20,${baseline} ${linePoints} ${width-20},${baseline}`:`20,${baseline} ${width-20},${baseline}`;

  return <article className="ref-white-card ref-week-chart dashboard-chart-card dashboard-area-explorer">
    <div className="ref-card-title dashboard-area-head"><div><span>Movimiento de ventas</span><small>{periodLabel}</small></div><Link href="/reports">Abrir reporte ↗</Link></div>
    <div className="dashboard-chart-total"><strong>{money(total)}</strong><span className={trend>=0?"up":"down"}>{trend>=0?"↗":"↘"} {Math.abs(trend).toFixed(0)}%</span></div>
    <div className="ref-svg-chart dashboard-area-chart">
      <svg viewBox="0 0 700 210" preserveAspectRatio="none" role="img" aria-label={`Ventas · ${periodLabel}`}>
        <defs><linearGradient id="dashboardAreaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#58a985" stopOpacity=".36"/><stop offset="1" stopColor="#58a985" stopOpacity=".03"/></linearGradient></defs>
        <line x1="20" x2="680" y1={baseline} y2={baseline} stroke="#e7eee9" strokeWidth="1"/>
        <polygon points={areaPoints} fill="url(#dashboardAreaFill)"/>
        {chart.length>1&&<polyline points={linePoints} fill="none" stroke="#176a4a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
        {chart.map((point,index)=>{const x=xFor(index),y=yFor(point.total),active=selectedKey===point.key;return <g key={point.key} className={`dashboard-area-point ${active?"active":""}`} role="button" tabIndex={0} aria-label={`${point.label}: ${money(point.total)}`} onClick={()=>setSelectedKey(point.key)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedKey(point.key)}}}><circle className="dashboard-area-hit" cx={x} cy={y} r="18"/><circle className="dashboard-area-dot" cx={x} cy={y} r={active?7:5}/>{point.total>0&&<text x={x} y={Math.max(18,y-12)} textAnchor="middle" className="dashboard-area-value">{money(point.total)}</text>}</g>})}
      </svg>
      <div className="ref-chart-labels dashboard-chart-labels">{chart.map(point=><button key={point.key} type="button" className={selectedKey===point.key?"active":""} onClick={()=>setSelectedKey(point.key)}>{point.label}</button>)}</div>
    </div>
    <div className="dashboard-area-foot"><span>Toca un punto para ver las ventas de ese momento.</span><Link href="/reports">Reporte completo ↗</Link></div>

    {selected&&<div className="dashboard-drilldown-backdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)setSelectedKey("")}}><section className="dashboard-drilldown" role="dialog" aria-modal="true" aria-label={`Detalle de ${selected.label}`}><button className="dashboard-drilldown-close" type="button" onClick={()=>setSelectedKey("")} aria-label="Cerrar">×</button><div className="dashboard-drilldown-title"><span>DETALLE</span><h3>{selected.label}</h3><div><strong>{money(selected.total)}</strong><small>{selected.sales.length} {selected.sales.length===1?"venta":"ventas"}</small></div></div>{selected.sales.length?<div className="dashboard-drilldown-list">{[...selected.sales].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(sale=><article key={sale.id}><div><strong>{new Date(sale.createdAt).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}</strong><span>{paymentLabel[sale.payment]}</span></div><b>{money(sale.total)}</b><small>{sale.items.map(item=>`${item.qty}× ${item.name}`).join(" · ")}</small></article>)}</div>:<div className="dashboard-drilldown-empty">No hubo ventas en este período.</div>}</section></div>}
  </article>;
}
