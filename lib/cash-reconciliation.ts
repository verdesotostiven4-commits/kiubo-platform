import type { CashSessionRecord, KiuboLocalDatabase, SaleRecord } from "./local-store";

export type CashReconciliation={
  sessionId:string;
  opening:number;
  cashSales:number;
  manualIncome:number;
  cashOut:number;
  expected:number;
  counted?:number;
  difference?:number;
};

const cents=(value:number)=>Number(value.toFixed(2));
const timestamp=(value?:string)=>{const parsed=value?Date.parse(value):NaN;return Number.isFinite(parsed)?parsed:undefined};
const saleVoided=(sale:SaleRecord)=>(sale as SaleRecord&{status?:string}).status==="voided";

export function reconcileCashSession(db:KiuboLocalDatabase,session:CashSessionRecord):CashReconciliation{
  const opened=timestamp(session.openedAt)??0;
  const closed=timestamp(session.closedAt)??Number.POSITIVE_INFINITY;
  const cashSales=db.sales
    .filter(s=>s.tenantId===session.tenantId&&s.branchId===session.branchId&&s.payment==="cash"&&!saleVoided(s))
    .filter(s=>{const at=timestamp(s.createdAt)??0;return at>=opened&&at<=closed})
    .reduce((sum,sale)=>sum+sale.total,0);
  const movements=db.cashMovements.filter(m=>m.tenantId===session.tenantId&&m.branchId===session.branchId&&m.sessionId===session.id);
  const manualIncome=movements.filter(m=>m.type==="in").reduce((sum,m)=>sum+m.amount,0);
  const cashOut=movements.filter(m=>m.type==="out").reduce((sum,m)=>sum+m.amount,0);
  const expected=cents(session.openingAmount+cashSales+manualIncome-cashOut);
  const counted=typeof session.closingAmount==="number"&&Number.isFinite(session.closingAmount)?cents(session.closingAmount):undefined;
  return{
    sessionId:session.id,
    opening:cents(session.openingAmount),
    cashSales:cents(cashSales),
    manualIncome:cents(manualIncome),
    cashOut:cents(cashOut),
    expected,
    counted,
    difference:counted===undefined?undefined:cents(counted-expected),
  };
}
