import type { CashSessionRecord, KiuboLocalDatabase } from "./local-store";
import { isMixedPaymentCashMovement } from "./mixed-payment";

export type CashReconciliation={
  sessionId:string;
  opening:number;
  cashSales:number;
  mixedCashSales:number;
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
  const manualIncome=movements.filter(m=>m.type==="in"&&!isMixedPaymentCashMovement(m)).reduce((sum,m)=>sum+m.amount,0);
  const cashOut=movements.filter(m=>m.type==="out").reduce((sum,m)=>sum+m.amount,0);
  const cashSales=cents(pureCashSales+mixedCashSales);
  const expected=cents(session.openingAmount+cashSales+manualIncome-cashOut);
  const counted=typeof session.closingAmount==="number"&&Number.isFinite(session.closingAmount)?cents(session.closingAmount):undefined;
  return{
    sessionId:session.id,
    opening:cents(session.openingAmount),
    cashSales,
    mixedCashSales:cents(mixedCashSales),
    manualIncome:cents(manualIncome),
    cashOut:cents(cashOut),
    expected,
    counted,
    difference:counted===undefined?undefined:cents(counted-expected),
  };
}
