import type { CashSessionRecord, KiuboLocalDatabase } from "./local-store";
import { isMixedPaymentCashMovement } from "./mixed-payment";
import { isCreditPaymentCashMovement } from "./order-payments";

export type CashReconciliationEntry={
  id:string;
  at:string;
  label:string;
  detail?:string;
  amount:number;
  kind:"opening"|"sale"|"mixed"|"credit"|"manual-in"|"out";
};

export type CashReconciliation={
  sessionId:string;
  opening:number;
  cashSales:number;
  mixedCashSales:number;
  creditCollections:number;
  manualIncome:number;
  cashOut:number;
  expected:number;
  counted?:number;
  difference?:number;
};

const cents=(value:number)=>Number(value.toFixed(2));
const timestamp=(value?:string)=>{const parsed=value?Date.parse(value):NaN;return Number.isFinite(parsed)?parsed:undefined};

export function reconcileCashSession(db:KiuboLocalDatabase,session:CashSessionRecord):CashReconciliation{
  const opened=timestamp(session.openedAt)??0;
  const closed=timestamp(session.closedAt)??Number.POSITIVE_INFINITY;
  const pureCashSales=db.sales
    .filter(s=>s.tenantId===session.tenantId&&s.branchId===session.branchId&&s.payment==="cash")
    .filter(s=>{const at=timestamp(s.createdAt)??0;return at>=opened&&at<=closed})
    .reduce((sum,sale)=>sum+sale.total,0);
  const movements=db.cashMovements.filter(m=>m.tenantId===session.tenantId&&m.branchId===session.branchId&&m.sessionId===session.id);
  const mixedCashSales=movements.filter(isMixedPaymentCashMovement).reduce((sum,m)=>sum+m.amount,0);
  const creditCollections=movements.filter(m=>m.type==="in"&&isCreditPaymentCashMovement(m.reason)).reduce((sum,m)=>sum+m.amount,0);
  const manualIncome=movements.filter(m=>m.type==="in"&&!isMixedPaymentCashMovement(m)&&!isCreditPaymentCashMovement(m.reason)).reduce((sum,m)=>sum+m.amount,0);
  const cashOut=movements.filter(m=>m.type==="out").reduce((sum,m)=>sum+m.amount,0);
  const cashSales=cents(pureCashSales+mixedCashSales);
  const expected=cents(session.openingAmount+cashSales+creditCollections+manualIncome-cashOut);
  const counted=typeof session.closingAmount==="number"&&Number.isFinite(session.closingAmount)?cents(session.closingAmount):undefined;
  return{
    sessionId:session.id,
    opening:cents(session.openingAmount),
    cashSales,
    mixedCashSales:cents(mixedCashSales),
    creditCollections:cents(creditCollections),
    manualIncome:cents(manualIncome),
    cashOut:cents(cashOut),
    expected,
    counted,
    difference:counted===undefined?undefined:cents(counted-expected),
  };
}

export function cashReconciliationEntries(db:KiuboLocalDatabase,session:CashSessionRecord):CashReconciliationEntry[]{
  const opened=timestamp(session.openedAt)??0,closed=timestamp(session.closedAt)??Number.POSITIVE_INFINITY;
  const entries:CashReconciliationEntry[]=[{id:`opening:${session.id}`,at:session.openedAt,label:"Fondo inicial",amount:cents(session.openingAmount),kind:"opening"}];
  for(const sale of db.sales.filter(s=>s.tenantId===session.tenantId&&s.branchId===session.branchId&&s.payment==="cash").filter(s=>{const at=timestamp(s.createdAt)??0;return at>=opened&&at<=closed})){
    const order=sale.orderId?db.orders.find(item=>item.id===sale.orderId):undefined;
    entries.push({id:sale.id,at:sale.createdAt,label:order?`Venta #${String(order.number).padStart(4,"0")}`:"Venta en efectivo",detail:sale.items.slice(0,3).map(item=>`${item.qty}× ${item.name}`).join(" · "),amount:cents(sale.total),kind:"sale"});
  }
  for(const movement of db.cashMovements.filter(m=>m.tenantId===session.tenantId&&m.branchId===session.branchId&&m.sessionId===session.id)){
    const kind=movement.type==="out"?"out":isMixedPaymentCashMovement(movement)?"mixed":isCreditPaymentCashMovement(movement.reason)?"credit":"manual-in";
    const label=kind==="mixed"?"Parte en efectivo de pago mixto":kind==="credit"?"Abono recibido en efectivo":kind==="out"?"Egreso":movement.reason||"Ingreso";
    entries.push({id:movement.id,at:movement.createdAt,label,detail:movement.reason,amount:cents(movement.type==="out"?-movement.amount:movement.amount),kind});
  }
  return entries.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
}
