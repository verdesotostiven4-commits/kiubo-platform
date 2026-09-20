import type { FoodOrderRecord,KiuboLocalDatabase,SaleRecord } from "./local-store";
import { paymentBreakdownForSale } from "./mixed-payment";

const cents=(value:number)=>Number(value.toFixed(2));

export type OrderPaymentSummary={
  sale?:SaleRecord;
  paid:number;
  balance:number;
  cash:number;
  transfer:number;
  label:string;
};

export function orderPaymentSummary(db:KiuboLocalDatabase,order:FoodOrderRecord):OrderPaymentSummary{
  const sale=(order.saleId?db.sales.find(item=>item.id===order.saleId):undefined)??db.sales.find(item=>item.orderId===order.id);
  if(!sale)return{paid:0,balance:cents(order.total),cash:0,transfer:0,label:"Pendiente de cobro"};
  if(sale.payment==="credit"){
    const credit=db.credits.find(item=>item.saleId===sale.id);
    const payments=credit?db.creditPayments.filter(item=>item.creditId===credit.id):[];
    const cash=cents(payments.filter(item=>item.method==="cash").reduce((sum,item)=>sum+item.amount,0));
    const transfer=cents(payments.filter(item=>item.method==="transfer").reduce((sum,item)=>sum+item.amount,0));
    const paid=cents(Math.min(sale.total,cash+transfer));
    const balance=cents(Math.max(0,credit?.balance??sale.total-paid));
    const label=cash>0&&transfer>0?"Abonos · efectivo + transferencia":cash>0?"Abonos en efectivo":transfer>0?"Abonos por transferencia":"Fiado / crédito";
    return{sale,paid,balance,cash,transfer,label};
  }
  const split=paymentBreakdownForSale(db,sale);
  const label=sale.payment==="cash"?"Efectivo":sale.payment==="transfer"?"Transferencia":"Mixto · efectivo + transferencia";
  return{sale,paid:cents(sale.total),balance:0,cash:split.cash,transfer:split.transfer,label};
}

export const creditPaymentCashMovementReason=(paymentId:string,description:string)=>`Abono fiado · ${paymentId} · ${description}`.slice(0,240);
export const isCreditPaymentCashMovement=(reason:string)=>reason.startsWith("Abono ·")||reason.startsWith("Abono fiado ·");
