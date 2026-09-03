"use client";

import { useMemo,useState } from "react";
import type { SaleRecord } from "@/lib/local-store";
import { parseOperationalItemName } from "@/lib/sale-adjustments";
import { saleLifecycle } from "@/lib/sale-reversal";

type Mode="day"|"week"|"month"|"custom";
type Bucket={key:string;label:string;longLabel:string;start:Date;end:Date;total:number;sales:SaleRecord[]};
const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const dayStart=(date:Date)=>{const value=new Date(date);value.setHours(0,0,0,0);return value};
const addDays=(date:Date,days:number)=>new Date(date.getTime()+days*86400000);
const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const parseDate=(value:string)=>{const parts=value.split("-").map(Number);return new Date(parts[0]||1970,(parts[1]||1)-1,parts[2]||1)};
const sameOrInside=(sale:SaleRecord,start:Date,end:Date)=>{const stamp=Date.parse(sale.createdAt);return stamp>=start.getTime()&&stamp<end.getTime()};

function boundsFor(mode:Mode,anchor:Date,customFrom:string,customTo:string){
  if(mode==="day"){const start=dayStart(anchor);return{start,end:addDays(start,1)}}
  if(mode==="week"){const start=dayStart(anchor),offset=(start.getDay()+6)%7;start.setDate(start.getDate()-offset);return{start,end:addDays(start,7)}}
  if(mode==="month"){const start=new Date(anchor.getFullYear(),anchor.getMonth(),1);return{start,end:new Date(anchor.getFullYear(),anchor.getMonth()+1,1)}}
  const start=dayStart(parseDate(customFrom)),end=addDays(dayStart(parseDate(customTo)),1);return end>start?{start,end}:{start,end:addDays(start,1)};
}

function buildBuckets(sales:SaleRecord[],start:Date,end:Date,mode:Mode){
  const span=Math.max(1,Math.ceil((end.getTime()-start.getTime())/86400000)),buckets:Bucket[]=[];
  if(mode==="day"){
    for(let hour=0;hour<24;hour+=4){const a=new Date(start);a.setHours(hour,0,0,0);const b=new Date(start);b.setHours(hour+4,0,0,0);const list=sales.filter(s=>sameOrInside(s,a,b));buckets.push({key:a.toISOString(),label:`${String(hour).padStart(2,"0")}:00`,longLabel:`${String(hour).padStart(2,"0")}:00 – ${String(hour+4).padStart(2,"0")}:00`,start:a,end:b,total:list.reduce((sum,s)=>sum+s.total,0),sales:list})}
    return buckets;
  }
  const step=span>62?7:1;
  for(let offset=0;offset<span;offset+=step){const a=addDays(start,offset),b=new Date(Math.min(addDays(a,step).getTime(),end.getTime())),list=sales.filter(s=>sameOrInside(s,a,b)),single=step===1;buckets.push({key:a.toISOString(),label:single?new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(a).replace(".",""):new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(a).replace(".",""),longLabel:single?new Intl.DateTimeFormat("es-EC",{weekday:"long",day:"2-digit",month:"long"}).format(a):`${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(a)} – ${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(addDays(b,-1))}`,start:a,end:b,total:list.reduce((sum,s)=>sum+s.total,0),sales:list})}
  return buckets;
}

export function DashboardSalesExplorer({sales}:{sales:SaleRecord[]}){
  const today=new Date(),[mode,setMode]=useState<Mode>("week"),[anchor,setAnchor]=useState(localDate(today)),[customFrom,setCustomFrom]=useState(localDate(addDays(today,-6))),[customTo,setCustomTo]=useState(localDate(today)),[selectedKey,setSelectedKey]=useState("");
  const completed=useMemo(()=>sales.filter(s=>saleLifecycle(s)==="completed"),[sales]);
  const data=useMemo(()=>{const base=parseDate(anchor),bounds=boundsFor(mode,base,customFrom,customTo),periodSales=completed.filter(s=>sameOrInside(s,bounds.start,bounds.end)),buckets=buildBuckets(periodSales,bounds.start,bounds.end,mode),total=periodSales.reduce((sum,s)=>sum+s.total,0);return{...bounds,periodSales,buckets,total}},[completed,mode,anchor,customFrom,customTo]);
  const max=Math.max(1,...data.buckets.map(item=>item.total)),selected=data.buckets.find(item=>item.key===selectedKey);
  const title=mode==="day"?new Intl.DateTimeFormat("es-EC",{weekday:"long",day:"2-digit",month:"long"}).format(data.start):mode==="week"?`${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(data.start)} – ${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(addDays(data.end,-1))}`:mode==="month"?new Intl.DateTimeFormat("es-EC",{month:"long",year:"numeric"}).format(data.start):`${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(data.start)} – ${new Intl.DateTimeFormat("es-EC",{day:"2-digit",month:"short"}).format(addDays(data.end,-1))}`;
  const move=(direction:number)=>{const date=parseDate(anchor);if(mode==="day")date.setDate(date.getDate()+direction);if(mode==="week")date.setDate(date.getDate()+direction*7);if(mode==="month")date.setMonth(date.getMonth()+direction);setAnchor(localDate(date));setSelectedKey("")};

  return <article className="ref-white-card ref-week-chart dashboard-chart-card dashboard-explorer">
    <div className="dashboard-explorer-head"><div><span>VENTAS EN EL TIEMPO</span><strong>{title}</strong></div><div className="dashboard-explorer-modes">{(["day","week","month","custom"] as Mode[]).map(item=><button type="button" key={item} className={mode===item?"active":""} onClick={()=>{setMode(item);setSelectedKey("")}}>{item==="day"?"Día":item==="week"?"Semana":item==="month"?"Mes":"Rango"}</button>)}</div></div>
    <div className="dashboard-explorer-toolbar">{mode!=="custom"?<><button type="button" onClick={()=>move(-1)} aria-label="Período anterior">‹</button><input type="date" value={anchor} onChange={e=>{setAnchor(e.target.value);setSelectedKey("")}}/><button type="button" onClick={()=>move(1)} aria-label="Período siguiente">›</button></>:<><label>Desde<input type="date" value={customFrom} onChange={e=>{setCustomFrom(e.target.value);setSelectedKey("")}}/></label><label>Hasta<input type="date" value={customTo} onChange={e=>{setCustomTo(e.target.value);setSelectedKey("")}}/></label></>}<div className="dashboard-explorer-total"><strong>{money(data.total)}</strong><span>{data.periodSales.length} ventas</span></div></div>
    <div className="dashboard-bars-scroll"><div className="dashboard-bars" style={{minWidth:`${Math.max(520,data.buckets.length*46)}px`}}>{data.buckets.map(bucket=><button type="button" key={bucket.key} className={selectedKey===bucket.key?"active":""} onClick={()=>setSelectedKey(bucket.key)} title={`${bucket.longLabel}: ${money(bucket.total)}`}><span className="dashboard-bar-value">{bucket.total>0?money(bucket.total):""}</span><i><b style={{height:`${Math.max(bucket.total>0?8:2,(bucket.total/max)*100)}%`}}/></i><small>{bucket.label}</small></button>)}</div></div>
    <div className="dashboard-explorer-foot"><span>Toca una barra para ver sus ventas.</span><a href="/reports">Reporte completo ↗</a></div>
    {selected&&<div className="dashboard-drilldown-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedKey("")}}><section className="dashboard-drilldown" role="dialog" aria-modal="true" aria-label={`Detalle de ${selected.longLabel}`}><button className="dashboard-drilldown-close" type="button" onClick={()=>setSelectedKey("")} aria-label="Cerrar">×</button><div className="dashboard-drilldown-title"><span>DETALLE</span><h3>{selected.longLabel}</h3><div><strong>{money(selected.total)}</strong><small>{selected.sales.length} ventas</small></div></div><div className="dashboard-drilldown-list">{selected.sales.length?[...selected.sales].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12).map(sale=><article key={sale.id}><div><strong>{new Date(sale.createdAt).toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}</strong><span>{sale.payment==="cash"?"Efectivo":sale.payment==="transfer"?"Transferencia":sale.payment==="credit"?"Fiado":"Mixto"}</span></div><b>{money(sale.total)}</b><small>{sale.items.slice(0,3).map(item=>`${item.qty}× ${parseOperationalItemName(item.name).displayName}`).join(" · ")}{sale.items.length>3?` · +${sale.items.length-3}`:""}</small></article>):<div className="dashboard-drilldown-empty">No hubo ventas en este período.</div>}</div></section></div>}
  </article>;
}
