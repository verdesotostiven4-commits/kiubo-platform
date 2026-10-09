import type {KiuboLocalDatabase,SaleRecord} from "./local-store";
import {saleLifecycle} from "./sale-reversal";
import {transferPaymentEvents} from "./transfer-events";
export type CashPaymentEvent={
  id:string;at:string;branchId:string;saleId?:string;label:string;amount:number;
  status:"registrada"|"anulada"|"revisar";
};
const money=(v:number)=>Number(v.toFixed(2));
const sane=(v:number)=>Number.isFinite(v)&&v>=0;
export function cashPaymentEvents(db:KiuboLocalDatabase,tenantId:string,branchId?:string):CashPaymentEvent[]{
  const within=(r:{tenantId:string;branchId:string})=>r.tenantId===tenantId&&(!branchId||r.branchId===branchId);
  const rows:CashPaymentEvent[]=[];
  const seenSales=new Set<string>(),sales=new Map<string,SaleRecord>();
  const transfers=transferPaymentEvents(db,tenantId,branchId);
  const transfersBySale=new Map(transfers.filter(t=>t.id.startsWith("sale:")).map(t=>[`${t.branchId}:${t.saleId}`,t]));
  for(const sale of db.sales){
    if(!within(sale))continue;
    const key=`${sale.branchId}:${sale.id}`;
    if(seenSales.has(key))continue;
    seenSales.add(key);sales.set(key,sale);
    if(sale.payment!=="cash"&&sale.payment!=="mixed")continue;
    const transfer=sale.payment==="mixed"?transfersBySale.get(key):undefined;
    const valid=sane(sale.total)&&(sale.payment==="cash"||Boolean(transfer&&transfer.status!=="revisar"&&transfer.amount<=sale.total));
    const amount=valid?money(sale.payment==="cash"?sale.total:sale.total-(transfer?.amount||0)):0;
    rows.push({
      id:`sale:${key}`,at:sale.createdAt,branchId:sale.branchId,saleId:sale.id,
      label:sale.payment==="cash"?"Venta en efectivo":"Parte en efectivo de pago mixto",
      amount,status:saleLifecycle(sale)==="voided"?"anulada":valid?"registrada":"revisar"
    });
  }
  const credits=new Map(db.credits.filter(within).map(c=>[`${c.branchId}:${c.id}`,c]));
  const seenPayments=new Set<string>();
  for(const payment of db.creditPayments){
    if(!within(payment)||payment.method!=="cash")continue;
    const key=`${payment.branchId}:${payment.id}`;
    if(seenPayments.has(key))continue;
    seenPayments.add(key);
    const credit=credits.get(`${payment.branchId}:${payment.creditId}`);
    const sale=credit?.saleId?sales.get(`${payment.branchId}:${credit.saleId}`):undefined;
    const valid=Boolean(credit)&&Number.isFinite(payment.amount)&&payment.amount>0;
    rows.push({id:`payment:${key}`,at:payment.createdAt,branchId:payment.branchId,saleId:sale?.id,
      label:credit?.kind==="partial"?"Abono parcial en efectivo":"Abono de fiado en efectivo",
      amount:valid?money(payment.amount):0,
      status:sale&&saleLifecycle(sale)==="voided"?"anulada":valid?"registrada":"revisar"
    });
  }
  return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
}
export const totalValidCash=(rows:CashPaymentEvent[])=>
  money(rows.reduce((sum,row)=>sum+(row.status==="registrada"?row.amount:0),0));
