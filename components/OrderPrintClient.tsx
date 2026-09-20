"use client";

import { useEffect,useState } from "react";
import { FoodOrderRecord,getTenantBranding,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { KiuboWordmark } from "./KiuboWordmark";
import { orderPaymentSummary,type OrderPaymentSummary } from "@/lib/order-payments";

const modeLabel:Record<FoodOrderRecord["serviceMode"],string>={counter:"MOSTRADOR",table:"LOCAL",takeaway:"PARA LLEVAR",delivery:"DOMICILIO"};
const cleanItemNote=(name:string,note?:string)=>note&&!name.toLowerCase().includes(note.toLowerCase())?note:"";

export function OrderPrintClient(){
  const[data,setData]=useState<{order:FoodOrderRecord;business:string;logo:string;branch:string;operator:string;payment:OrderPaymentSummary}|null>(null);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("order")||"",db=loadLocalDatabase(),ctx=getWorkspaceContext(db),order=db.orders.find(item=>item.id===id&&item.tenantId===ctx.tenantId&&item.branchId===ctx.branchId);if(!order)return;
    const branding=getTenantBranding(db,ctx.tenantId),operator=order.createdBy?db.users.find(user=>user.id===order.createdBy)?.name||"":"";
    setData({order,business:branding.businessName||ctx.tenant?.name||"Negocio",logo:branding.logoUrl||"",branch:ctx.branch?`${ctx.branch.code} · ${ctx.branch.name}`:"Matriz",operator,payment:orderPaymentSummary(db,order)});
  },[]);
  if(!data)return <main style={{padding:32,fontFamily:"Arial,sans-serif"}}>No encontramos ese pedido en este dispositivo.</main>;
  const {order}=data,created=new Date(order.createdAt),mode=`${modeLabel[order.serviceMode]}${order.tableLabel?` · MESA ${order.tableLabel}`:""}`;
  return <main className="command-page"><style>{`
    @page{size:76mm auto;margin:1.5mm}
    *{box-sizing:border-box}
    body{margin:0;background:#eef1ef;font-family:Arial,Helvetica,sans-serif;color:#0b0b0b}
    .command-page{min-height:100vh;display:grid;place-items:start center;padding:26px 16px 40px}
    .command{width:72mm;background:#fff;color:#090909;padding:3.5mm 4mm;box-shadow:0 14px 38px rgba(18,40,31,.13)}
    .brand{display:grid;justify-items:center;text-align:center;gap:1mm}
    .brand img{max-width:40mm;max-height:18mm;object-fit:contain;display:block}
    .brand-name{font-size:17px;font-weight:900;letter-spacing:.02em}
    .document-type{margin-top:1.5mm;font-size:9px;font-weight:900;letter-spacing:.2em}
    .order-no{text-align:center;font-size:30px;line-height:1;font-weight:950;letter-spacing:-.035em;margin:2.5mm 0 2mm}
    .service{padding:2.2mm 1mm;border-top:2.4px solid #111;border-bottom:2.4px solid #111;text-align:center;font-size:16px;font-weight:950;letter-spacing:.02em}
    .status-line{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:2mm;font-size:8px;font-weight:800;color:#333;text-transform:uppercase;letter-spacing:.08em}
    .meta{display:grid;gap:1.1mm;padding:2.7mm 0 2.4mm;font-size:9.5px;border-bottom:1px dashed #333}
    .row{display:grid;grid-template-columns:21mm 1fr;gap:2mm;align-items:start}.row span{color:#333}.row b{text-align:right;overflow-wrap:anywhere}
    .customer{display:grid;gap:1mm;padding:2.5mm 0;border-bottom:1px dashed #333;font-size:10px}.customer b{font-size:10.5px}.customer-line{overflow-wrap:anywhere}
    .items{display:grid;gap:0;padding:1.5mm 0}.item{padding:2.2mm 0;border-bottom:1px dotted #555}.item:last-child{border-bottom:0}.item-main{display:grid;grid-template-columns:auto 1fr;gap:2mm;align-items:start;font-size:15px;font-weight:950;line-height:1.15}.qty{min-width:8mm;font-size:17px}.item-name{overflow-wrap:anywhere}.item-note{display:block;margin:1.2mm 0 0 10mm;padding-left:2mm;border-left:2px solid #111;font-size:10px;font-weight:750;line-height:1.25}
    .notes{margin-top:1.5mm;padding:2.2mm;border:2px solid #111;font-size:11px;font-weight:900;line-height:1.3}.notes-title{display:block;font-size:8px;letter-spacing:.12em;margin-bottom:1mm}.payment-box{display:grid;gap:1.2mm;border-top:2px solid #111;border-bottom:2px solid #111;padding:2.4mm 0;margin-top:1.5mm}.payment-row{display:flex;justify-content:space-between;gap:2mm;font-size:10px}.payment-row.total{font-size:15px;font-weight:950}.payment-row.balance{font-size:12px;font-weight:900}.payment-detail{font-size:8px;text-align:center;color:#333;font-weight:750}
    .footer{border-top:1px dashed #333;margin-top:2mm;padding-top:2.3mm;text-align:center;font-size:8px;color:#555}.footer-brand{font-weight:900}.kiubo-wordmark{font-weight:950;letter-spacing:.02em}.kiubo-wordmark-kiu{color:#10243d}.kiubo-wordmark-b{color:#ff5b55}.kiubo-wordmark-o{color:#f5a000}
    .actions{width:72mm;display:grid;grid-template-columns:1.4fr 1fr;gap:9px;margin-top:14px}.actions button{min-height:46px;border-radius:12px;font-weight:900;font-size:14px;cursor:pointer}.print-button{border:0;background:#123f31;color:#fff}.close-button{border:1px solid #d4ddd8;background:#fff;color:#34453c}
    .screen-help{width:72mm;margin-top:10px;text-align:center;color:#66746d;font-size:11px}
    @media print{html,body{width:76mm!important;margin:0!important;background:#fff!important}.no-print{display:none!important}.command-page{padding:0!important;min-height:auto!important;display:block!important}.command{width:72mm!important;box-shadow:none!important;margin:0 auto!important}.kiubo-wordmark-kiu,.kiubo-wordmark-b,.kiubo-wordmark-o{color:#000!important}}
  `}</style><section className="command">
    <header className="brand">{data.logo&&<img src={data.logo} alt=""/>}<div className="brand-name">{data.business}</div><div className="document-type">COMANDA DE COCINA</div></header>
    <div className="order-no">#{String(order.number).padStart(4,"0")}</div>
    <div className="service">{mode}</div>
    <div className="status-line">{order.paymentStatus==="paid"?"PAGADO":"PENDIENTE DE COBRO"} · {order.items.reduce((sum,item)=>sum+item.qty,0)} UNIDADES</div>
    <section className="meta"><div className="row"><span>Fecha y hora</span><b>{created.toLocaleDateString("es-EC")} · {created.toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}</b></div><div className="row"><span>Sucursal</span><b>{data.branch}</b></div>{data.operator&&<div className="row"><span>Tomó el pedido</span><b>{data.operator}</b></div>}</section>
    {(order.customerName||order.phone||order.address)&&<section className="customer">{order.customerName&&<div className="customer-line"><b>Cliente:</b> {order.customerName}</div>}{order.phone&&<div className="customer-line"><b>Tel:</b> {order.phone}</div>}{order.address&&<div className="customer-line"><b>Dirección:</b> {order.address}</div>}</section>}
    <section className="items">{order.items.map((item,index)=>{const note=cleanItemNote(item.name,item.notes);return <div className="item" key={`${item.productId}-${index}`}><div className="item-main"><span className="qty">{item.qty}×</span><span className="item-name">{item.name}</span></div>{note&&<span className="item-note">{note}</span>}</div>})}</section>
    <section className="payment-box"><div className="payment-row total"><span>TOTAL</span><b>{new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(order.total)}</b></div><div className="payment-row"><span>Forma de pago</span><b>{data.payment.label}</b></div>{data.payment.paid>0&&data.payment.balance>0&&<><div className="payment-row"><span>Abonado</span><b>{new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(data.payment.paid)}</b></div><div className="payment-row balance"><span>SALDO</span><b>{new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(data.payment.balance)}</b></div></>}{data.payment.cash>0&&data.payment.transfer>0&&<div className="payment-detail">Efectivo {new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(data.payment.cash)} · Transferencia {new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(data.payment.transfer)}</div>}</section>
    {order.notes&&<div className="notes"><span className="notes-title">INDICACIÓN DEL PEDIDO</span>{order.notes}</div>}
    <footer className="footer">Generado por <span className="footer-brand"><KiuboWordmark/></span></footer>
  </section><div className="actions no-print"><button className="print-button" onClick={()=>window.print()}>Imprimir comanda</button><button className="close-button" onClick={()=>window.close()}>Cerrar</button></div><div className="screen-help no-print">Vista previa para rollo de 76 mm · la impresión conserva alto contraste para la Epson.</div></main>;
}
