"use client";

import { useEffect,useState } from "react";
import { FoodOrderRecord,SaleRecord,getTenantBranding,getTenantSettings,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { paymentBreakdownForSale,type PaymentBreakdown } from "@/lib/mixed-payment";
import { KiuboWordmark } from "./KiuboWordmark";

const money=(value:number)=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(value||0);
const paymentLabel:Record<SaleRecord["payment"],string>={cash:"Efectivo",transfer:"Transferencia",mixed:"Mixto",credit:"Fiado / crédito"};
const modeLabel:Record<FoodOrderRecord["serviceMode"],string>={counter:"Mostrador",table:"Local",takeaway:"Para llevar",delivery:"Domicilio"};

type ReceiptData={sale:SaleRecord;order?:FoodOrderRecord;business:string;logo:string;address:string;phone:string;footer:string;width:"58mm"|"80mm";branch:string;operator:string;paymentBreakdown?:PaymentBreakdown};

export function ReceiptClient(){
  const[data,setData]=useState<ReceiptData|null>(null);
  useEffect(()=>{
    const saleId=new URLSearchParams(window.location.search).get("sale")||"",db=loadLocalDatabase(),ctx=getWorkspaceContext(db),sale=db.sales.find(item=>item.id===saleId&&item.tenantId===ctx.tenantId&&item.branchId===ctx.branchId);if(!sale)return;
    const settings=getTenantSettings(db,ctx.tenantId),branding=getTenantBranding(db,ctx.tenantId),order=sale.orderId?db.orders.find(item=>item.id===sale.orderId):undefined,operator=order?.createdBy?db.users.find(user=>user.id===order.createdBy)?.name||"":"",paymentBreakdown=sale.payment==="mixed"?paymentBreakdownForSale(db,sale):undefined;
    setData({sale,order,business:branding.businessName||settings.tradeName||ctx.tenant?.name||"Negocio",logo:branding.logoUrl||"",address:settings.address,phone:settings.phone,footer:branding.receiptTagline||settings.receiptFooter,width:settings.receiptWidth,branch:ctx.branch?`${ctx.branch.code} · ${ctx.branch.name}`:"Matriz",operator,paymentBreakdown});
  },[]);
  if(!data)return <main style={{padding:32}}>No encontramos esa venta en este dispositivo.</main>;
  const {sale,order}=data,physicalWidth=data.width==="58mm"?"58mm":"76mm",pageWidth=data.width==="58mm"?"52mm":"70mm",subtotal=sale.items.reduce((sum,item)=>sum+item.qty*item.unitPrice,0),itemCount=sale.items.reduce((sum,item)=>sum+item.qty,0),created=new Date(sale.createdAt);
  return <main className="receipt-page"><style>{`
    @page{size:${physicalWidth} auto;margin:2mm}
    *{box-sizing:border-box}
    body{margin:0;background:#f1f3f1;font-family:Arial,Helvetica,sans-serif;color:#111}
    .receipt-page{min-height:100vh;display:grid;place-items:start center;padding:24px}
    .receipt{width:${pageWidth};background:#fff;color:#111;padding:4mm;box-shadow:0 12px 38px rgba(0,0,0,.11)}
    .brand{display:grid;justify-items:center;text-align:center;gap:1.2mm}.brand img{max-width:39mm;max-height:16mm;object-fit:contain}.brand strong{font-size:17px;letter-spacing:.01em}.brand span{font-size:8.5px;line-height:1.35;color:#333}
    .ticket-title{text-align:center;margin:3mm 0 1mm;font-size:9px;font-weight:950;letter-spacing:.18em}.order-number{text-align:center;font-size:22px;font-weight:950;margin:1mm 0 2mm}.service{text-align:center;border-top:2px solid #111;border-bottom:2px solid #111;padding:1.7mm 1mm;font-size:11px;font-weight:950}.summary-chip{text-align:center;margin:1.7mm 0 0;font-size:7.5px;font-weight:850;letter-spacing:.08em;color:#444;text-transform:uppercase}
    .rule{border-top:1px dashed #555;margin:2.5mm 0}.meta{display:grid;gap:1.1mm;font-size:8.8px;line-height:1.35}.row{display:flex;justify-content:space-between;gap:8px}.meta .row b{text-align:right}.customer{display:grid;gap:.8mm;padding:1.6mm 0;font-size:8.8px}.customer b{font-size:9px}
    .items{display:grid}.item{display:grid;grid-template-columns:1fr auto;gap:3mm;padding:2mm 0;border-bottom:1px dotted #888;align-items:start}.item:last-child{border-bottom:0}.item b{display:block;font-size:10.5px;line-height:1.25}.item small{display:block;font-size:8px;margin-top:.8mm;color:#444}.item>strong{font-size:10.5px;white-space:nowrap}
    .totals{display:grid;gap:1.4mm;font-size:9px}.totals .grand{font-size:17px;font-weight:950;border-top:1.5px solid #111;padding-top:1.8mm;margin-top:.5mm}.totals .grand span:last-child{font-size:19px}.payment{font-weight:850}.payment-split{padding-left:2mm;color:#333}
    .note{padding:2mm;border:1px solid #111;font-size:8.8px;line-height:1.35}.note b{display:block;margin-bottom:.7mm;font-size:8px;letter-spacing:.08em}
    .footer{text-align:center;font-size:8px;line-height:1.45}.footer strong{display:block;font-size:10px;margin-bottom:1mm}.powered{margin-top:1.8mm;font-size:7.5px;color:#666}.kiubo-wordmark{font-weight:950;letter-spacing:.02em}.kiubo-wordmark-kiu{color:#10243d}.kiubo-wordmark-b{color:#ff5b55}.kiubo-wordmark-o{color:#f5a000}.legal{display:block;margin-top:1mm;font-size:7px;color:#666}
    .actions{width:${pageWidth};display:grid;grid-template-columns:1.4fr 1fr;gap:8px;margin-top:12px}.actions button{min-height:44px;border-radius:11px;font-weight:900;cursor:pointer}.print{border:0;background:#123f31;color:#fff}.close{border:1px solid #d4ddd8;background:#fff;color:#34453c}
    @media print{html,body{width:${physicalWidth};margin:0!important;background:#fff!important}.no-print{display:none!important}.receipt-page{padding:0!important;min-height:auto!important;display:block!important}.receipt{box-shadow:none!important;margin:0 auto!important}.kiubo-wordmark-kiu,.kiubo-wordmark-b,.kiubo-wordmark-o{color:#000!important}}
  `}</style><section className="receipt">
    <header className="brand">{data.logo&&<img src={data.logo} alt=""/>}<strong>{data.business}</strong>{data.address&&<span>{data.address}</span>}{data.phone&&<span>Tel. {data.phone}</span>}</header>
    <div className="ticket-title">TICKET DE VENTA</div>{order&&<div className="order-number">PEDIDO #{String(order.number).padStart(4,"0")}</div>}{order&&<div className="service">{modeLabel[order.serviceMode]}{order.tableLabel?` · MESA ${order.tableLabel}`:""}</div>}<div className="summary-chip">{itemCount} {itemCount===1?"unidad":"unidades"} · {paymentLabel[sale.payment]}</div>
    <div className="rule"/><section className="meta"><div className="row"><span>Fecha y hora</span><b>{created.toLocaleDateString("es-EC")} · {created.toLocaleTimeString("es-EC",{hour:"2-digit",minute:"2-digit"})}</b></div><div className="row"><span>Sucursal</span><b>{data.branch}</b></div>{data.operator&&<div className="row"><span>Atendido por</span><b>{data.operator}</b></div>}<div className="row"><span>Referencia</span><b>{sale.id.slice(-8).toUpperCase()}</b></div></section>
    {(order?.customerName||order?.phone||order?.address)&&<><div className="rule"/><section className="customer">{order?.customerName&&<span><b>Cliente:</b> {order.customerName}</span>}{order?.phone&&<span><b>Tel:</b> {order.phone}</span>}{order?.address&&<span><b>Dirección:</b> {order.address}</span>}</section></>}
    <div className="rule"/><section className="items">{sale.items.map((item,index)=><div className="item" key={`${item.productId}-${index}`}><span><b>{item.qty} × {item.name}</b><small>{money(item.unitPrice)} c/u</small></span><strong>{money(item.qty*item.unitPrice)}</strong></div>)}</section>
    <div className="rule"/><section className="totals"><div className="row"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="row payment"><span>Forma de pago</span><b>{paymentLabel[sale.payment]}</b></div>{data.paymentBreakdown&&<><div className="row payment-split"><span>↳ Efectivo</span><b>{money(data.paymentBreakdown.cash)}</b></div><div className="row payment-split"><span>↳ Transferencia</span><b>{money(data.paymentBreakdown.transfer)}</b></div></>}<div className="row grand"><span>TOTAL</span><span>{money(sale.total)}</span></div></section>
    {order?.notes&&<><div className="rule"/><div className="note"><b>NOTA DEL PEDIDO</b>{order.notes}</div></>}
    <div className="rule"/><footer className="footer"><strong>{data.footer||"Gracias por tu compra"}</strong><span>Gracias por elegir {data.business}.</span><div className="powered">Gestionado con <KiuboWordmark/></div><small className="legal">Este ticket es una referencia de venta y no reemplaza un comprobante tributario electrónico.</small></footer>
  </section><div className="actions no-print"><button className="print" onClick={()=>window.print()}>Imprimir ticket</button><button className="close" onClick={()=>window.close()}>Cerrar</button></div></main>;
}
