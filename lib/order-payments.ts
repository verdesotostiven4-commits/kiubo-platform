import type { FoodOrderRecord,KiuboLocalDatabase,SaleRecord } from "./local-store";
import { paymentBreakdownForSale } from "./mixed-payment";

const cents=(value:number)=>Number(value.toFixed(2));
const isOutstandingSale=(sale:SaleRecord)=>sale.payment==="credit"||sale.payment==="partial";

export type OrderPaymentSummary={
  sale?:SaleRecord;
  paid:number;
  balance:number;
  cash:number;
  transfer:number;
  label:string;
  kind?:"fiado"|"partial";
  detailPending?:boolean;
};

function outstandingSummary(db:KiuboLocalDatabase,sale:SaleRecord):OrderPaymentSummary{
  const credit=db.credits.find(item=>item.saleId===sale.id);
  const payments=credit?db.creditPayments.filter(item=>item.creditId===credit.id):[];
  const recordedCash=cents(payments.filter(item=>item.method==="cash").reduce((sum,item)=>sum+item.amount,0));
  const recordedTransfer=cents(payments.filter(item=>item.method==="transfer").reduce((sum,item)=>sum+item.amount,0));
  const recordedPaid=cents(Math.min(sale.total,recordedCash+recordedTransfer));
  const balance=cents(Math.max(0,Math.min(sale.total,credit?.balance??sale.total-recordedPaid)));
  const paid=cents(Math.max(0,sale.total-balance));
  const detailPending=Math.abs(recordedPaid-paid)>.011;
  const cash=detailPending?0:recordedCash,transfer=detailPending?0:recordedTransfer;
  const kind: "fiado"|"partial" = credit?.kind??(sale.payment==="partial"?"partial":"fiado");
  const base=kind==="partial"?"Pago parcial":"Fiado";
  const label=detailPending?`${base} · actualizando detalle`:cash>0&&transfer>0?`${base} · efectivo + transferencia`:cash>0?`${base} · efectivo`:transfer>0?`${base} · transferencia`:base;
  return{sale,paid,balance,cash,transfer,label,kind,detailPending};
}

export function salePaymentSummary(db:KiuboLocalDatabase,sale:SaleRecord):OrderPaymentSummary{
  const order=sale.orderId?db.orders.find(item=>item.id===sale.orderId):undefined;
  if(order)return orderPaymentSummary(db,order);
  if(isOutstandingSale(sale))return outstandingSummary(db,sale);
  const split=paymentBreakdownForSale(db,sale);
  const label=sale.payment==="cash"?"Efectivo":sale.payment==="transfer"?"Transferencia":"Mixto · efectivo + transferencia";
  return{sale,paid:cents(sale.total),balance:0,cash:split.cash,transfer:split.transfer,label};
}

export function orderPaymentSummary(db:KiuboLocalDatabase,order:FoodOrderRecord):OrderPaymentSummary{
  const sale=(order.saleId?db.sales.find(item=>item.id===order.saleId):undefined)??db.sales.find(item=>item.orderId===order.id);
  if(!sale)return{paid:0,balance:cents(order.total),cash:0,transfer:0,label:"Pendiente de cobro"};
  if(isOutstandingSale(sale))return outstandingSummary(db,sale);
  const split=paymentBreakdownForSale(db,sale);
  const label=sale.payment==="cash"?"Efectivo":sale.payment==="transfer"?"Transferencia":"Mixto · efectivo + transferencia";
  return{sale,paid:cents(sale.total),balance:0,cash:split.cash,transfer:split.transfer,label};
}

export const creditPaymentCashMovementReason=(paymentId:string,description:string,kind:"fiado"|"partial"="fiado")=>
  (kind==="partial"?`Pago parcial · ${paymentId} · ${description}`:`Abono fiado · ${paymentId} · ${description}`).slice(0,240);

export const isCreditPaymentCashMovement=(reason:string)=>
  reason.startsWith("Abono ·")||reason.startsWith("Abono fiado ·")||reason.startsWith("Pago parcial ·");
