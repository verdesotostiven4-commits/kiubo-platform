import type { CreditRecord,FoodOrderRecord,KiuboLocalDatabase,SaleRecord } from "./local-store";
import { paymentBreakdownForSale } from "./mixed-payment";

const cents=(value:number)=>Number(value.toFixed(2));
const isOutstandingSale=(sale:SaleRecord)=>sale.payment==="credit"||sale.payment==="partial";

export function outstandingBalanceKind(db:KiuboLocalDatabase,credit:CreditRecord):"fiado"|"partial"{
  if(credit.kind)return credit.kind;
  const sale=credit.saleId?db.sales.find(item=>item.id===credit.saleId):undefined;
  return sale?.payment==="partial"?"partial":"fiado";
}

export function openPartialCreditForOrder(db:KiuboLocalDatabase,order:FoodOrderRecord):CreditRecord|undefined{
  if(order.paymentStatus!=="partial"||!order.saleId)return undefined;
  const credit=db.credits.find(item=>item.saleId===order.saleId&&item.status==="open"&&item.balance>.001);
  return credit&&outstandingBalanceKind(db,credit)==="partial"?credit:undefined;
}

export const isOpenPartialOrder=(db:KiuboLocalDatabase,order:FoodOrderRecord)=>Boolean(openPartialCreditForOrder(db,order));

export function compareOccupyingOrders(db:KiuboLocalDatabase,a:FoodOrderRecord,b:FoodOrderRecord){
  const partialPriority=Number(isOpenPartialOrder(db,b))-Number(isOpenPartialOrder(db,a));
  return partialPriority||Date.parse(b.updatedAt||b.createdAt)-Date.parse(a.updatedAt||a.createdAt);
}

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
  const kind: "fiado"|"partial" = credit?outstandingBalanceKind(db,credit):(sale.payment==="partial"?"partial":"fiado");
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
