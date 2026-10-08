import type { KiuboLocalDatabase, SaleRecord } from "./local-store";

export type TransferPaymentEvent = {
  id:string;
  at:string;
  branchId:string;
  saleId?:string;
  orderId?:string;
  customerName?:string;
  service?:string;
  label:string;
  amount:number;
  status:"registrada"|"anulada"|"revisar";
  note?:string;
};

const round=(value:number)=>Number(value.toFixed(2));
const finitePositive=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>0;
const validTotal=(value:number)=>Number.isFinite(value)&&value>=0;

function mixedTransfer(db:KiuboLocalDatabase,sale:SaleRecord):{amount:number;valid:boolean;note?:string}{
  if(!validTotal(sale.total))return{amount:0,valid:false,note:"Total de venta inválido"};
  const embedded=(sale as SaleRecord&{paymentBreakdown?:{cash:number;transfer:number}}).paymentBreakdown;
  if(embedded){
    const cash=embedded.cash,transfer=embedded.transfer;
    if(!Number.isFinite(cash)||!Number.isFinite(transfer)||cash<0||transfer<0||Math.abs(round(cash+transfer)-round(sale.total))>.01)
      return{amount:0,valid:false,note:"Desglose de pago mixto contradictorio"};
    return{amount:round(transfer),valid:true};
  }
  // Legacy mixed payments stored their cash part as a cash movement.
  const rows=db.cashMovements.filter(m=>m.tenantId===sale.tenantId&&m.branchId===sale.branchId&&m.type==="in"&&m.reason===`Pago mixto · venta ${sale.id}`);
  if(rows.length!==1||!finitePositive(rows[0].amount)||rows[0].amount>sale.total)
    return{amount:0,valid:false,note:"Desglose mixto histórico sin evidencia suficiente"};
  return{amount:round(sale.total-rows[0].amount),valid:true};
}

export function transferPaymentEvents(db:KiuboLocalDatabase,tenantId:string,branchId?:string):TransferPaymentEvent[]{
  const within=(record:{tenantId:string;branchId:string})=>record.tenantId===tenantId&&(!branchId||record.branchId===branchId);
  const sales=new Map<string,SaleRecord>(),credits=new Map<string,typeof db.credits[number]>();
  const orders=new Map<string,typeof db.orders[number]>();
  for(const sale of db.sales)if(within(sale)&&!sales.has(`${sale.branchId}:${sale.id}`))sales.set(`${sale.branchId}:${sale.id}`,sale);
  for(const credit of db.credits)if(within(credit)&&!credits.has(`${credit.branchId}:${credit.id}`))credits.set(`${credit.branchId}:${credit.id}`,credit);
  for(const order of db.orders)if(within(order)&&!orders.has(`${order.branchId}:${order.id}`))orders.set(`${order.branchId}:${order.id}`,order);

  const rows:TransferPaymentEvent[]=[];
  for(const sale of sales.values()){
    if(sale.payment!=="transfer"&&sale.payment!=="mixed")continue;
    const split=sale.payment==="transfer"
      ? {amount:finitePositive(sale.total)?round(sale.total):0,valid:finitePositive(sale.total),note:undefined as string|undefined}
      : mixedTransfer(db,sale);
    const voided=(sale as SaleRecord&{status?:string}).status==="voided";
    const order=sale.orderId?orders.get(`${sale.branchId}:${sale.orderId}`):undefined;
    const status=voided?"anulada":split.valid?"registrada":"revisar";
    rows.push({
      id:`sale:${sale.branchId}:${sale.id}`,at:sale.createdAt,branchId:sale.branchId,saleId:sale.id,orderId:sale.orderId,
      customerName:order?.customerName,service:order?.serviceMode==="table"?`Mesa ${order.tableLabel||"?"}`:order?.serviceMode==="delivery"?"Domicilio":order?.serviceMode==="takeaway"?"Para llevar":order?.serviceMode==="counter"?"Mostrador":undefined,
      label:sale.payment==="mixed"?"Parte de pago mixto":"Venta por transferencia",amount:split.amount,status,
      note:voided?"Venta anulada; devolución bancaria no verificada":split.note
    });
  }

  const visited=new Set<string>();
  for(const payment of db.creditPayments){
    if(!within(payment)||payment.method!=="transfer")continue;
    const key=`${payment.branchId}:${payment.id}`;
    if(visited.has(key))continue;
    visited.add(key);
    const credit=credits.get(`${payment.branchId}:${payment.creditId}`);
    const sale=credit?.saleId?sales.get(`${payment.branchId}:${credit.saleId}`):undefined;
    const order=sale?.orderId?orders.get(`${payment.branchId}:${sale.orderId}`):undefined;
    const voided=(sale as SaleRecord&{status?:string}|undefined)?.status==="voided";
    const valid=Boolean(credit)&&finitePositive(payment.amount);
    rows.push({
      id:`payment:${key}`,at:payment.createdAt,branchId:payment.branchId,saleId:sale?.id,orderId:sale?.orderId,
      customerName:order?.customerName,service:order?.serviceMode==="table"?`Mesa ${order.tableLabel||"?"}`:order?.serviceMode==="delivery"?"Domicilio":order?.serviceMode==="takeaway"?"Para llevar":undefined,
      label:credit?.kind==="partial"||sale?.payment==="partial"?"Abono de pago parcial":"Abono de fiado",
      amount:finitePositive(payment.amount)?round(payment.amount):0,
      status:voided?"anulada":valid?"registrada":"revisar",
      note:voided?"Venta anulada; devolución bancaria no verificada":!valid?"Abono sin crédito verificable o monto inválido":undefined
    });
  }
  return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
}

export function totalValidTransfers(rows:TransferPaymentEvent[]){
  return round(rows.reduce((sum,row)=>sum+(row.status==="registrada"?row.amount:0),0));
}
