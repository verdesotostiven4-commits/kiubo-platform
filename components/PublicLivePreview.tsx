"use client";
import { useState } from "react";

type PreviewMode="ventas"|"inventario"|"caja";
const modes:{id:PreviewMode;label:string;hint:string}[]=[
  {id:"ventas",label:"Ventas",hint:"POS en tiempo real"},
  {id:"inventario",label:"Inventario",hint:"Stock y alertas"},
  {id:"caja",label:"Caja",hint:"Control del turno"}
];

export function PublicLivePreview(){
  const[mode,setMode]=useState<PreviewMode>("ventas");
  return <div className="public-live-preview" aria-label="Vista interactiva de KIUBO">
    <div className="live-window-bar"><div className="window-dots"><i/><i/><i/></div><span>Vista demo · MiniMarket San José</span><b className="live-badge"><i/> En vivo</b></div>
    <div className="live-preview-tabs">{modes.map(item=><button key={item.id} aria-pressed={mode===item.id} className={mode===item.id?"active":""} onClick={()=>setMode(item.id)}><strong>{item.label}</strong><span>{item.hint}</span></button>)}</div>
    <div className="live-preview-canvas" key={mode}>
      {mode==="ventas"&&<><div className="live-kpi-row"><article><span>Ventas hoy</span><strong>$428.60</strong><small>+12.8% vs. ayer</small></article><article><span>Transacciones</span><strong>37</strong><small>Ticket $11.58</small></article><article><span>Estado</span><strong>Operando</strong><small>Todo sincronizado</small></article></div><div className="live-activity"><div className="live-activity-head"><strong>Últimos movimientos</strong><span>Actualizado ahora</span></div><div><i className="activity-icon coral">$</i><span><b>Venta #184</b><small>Efectivo · 4 productos</small></span><strong>$12.50</strong></div><div><i className="activity-icon blue">↗</i><span><b>Transferencia</b><small>Venta #183</small></span><strong>$24.80</strong></div><div><i className="activity-icon orange">◎</i><span><b>Cliente frecuente</b><small>María P. · 8 compras</small></span><strong>$18.20</strong></div></div></>}
      {mode==="inventario"&&<><div className="inventory-visual-head"><div><span>Inventario activo</span><strong>642 productos</strong></div><b>6 necesitan atención</b></div><div className="live-stock-list"><div><span><i className="stock-dot ok"/><b>Leche Entera 1L</b><small>Stock saludable</small></span><strong>18</strong></div><div><span><i className="stock-dot warning"/><b>Café Buen Día</b><small>Reponer pronto</small></span><strong>5</strong></div><div><span><i className="stock-dot danger"/><b>Agua 600 ml</b><small>Stock crítico</small></span><strong>2</strong></div><div><span><i className="stock-dot ok"/><b>Arroz 1 kg</b><small>Stock saludable</small></span><strong>34</strong></div></div><div className="live-insight">KIUBO te muestra qué necesita atención antes de que se convierta en un problema.</div></>}
      {mode==="caja"&&<><div className="cash-visual"><div className="cash-ring"><span>Esperado</span><strong>$231.40</strong><small>Turno abierto</small></div><div className="cash-breakdown"><div><span>Fondo inicial</span><b>$40.00</b></div><div><span>Ventas efectivo</span><b>$206.40</b></div><div><span>Egresos</span><b>-$15.00</b></div><div className="cash-total"><span>Diferencia</span><b>$0.00</b></div></div></div><div className="live-insight success">Caja ordenada, movimientos registrados y cierre reproducible.</div></>}
    </div>
    <div className="live-preview-footer"><span>Una sola plataforma</span><div><b>POS</b><b>Stock</b><b>Clientes</b><b>Reportes</b></div></div>
  </div>
}
