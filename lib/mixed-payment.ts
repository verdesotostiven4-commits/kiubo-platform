import type { CashMovementRecord,KiuboLocalDatabase,SaleRecord } from "./local-store";

export type PaymentBreakdown={cash:number;transfer:number};
export type SaleWithPaymentBreakdown=SaleRecord&{paymentBreakdown?:PaymentBreakdown};
const MIXED_CASH_PREFIX="Pago mixto · venta ";
const MIXED_REFUND_PREFIX="Anulación pago mixto · venta ";
const cents=(value:number)=>Number(value.toFixed(2));

export function mixedCashMovementReason(saleId:string){return `${MIXED_CASH_PREFIX}${saleId}`}
export function mixedRefundMovementReason(saleId:string){return `${MIXED_REFUND_PREFIX}${saleId}`}
export function isMixedPaymentCashMovement(movement:CashMovementRecord){return movement.type==="in"&&movement.reason.startsWith(MIXED_CASH_PREFIX)}
export function mixedSaleIdFromMovement(movement:CashMovementRecord){return isMixedPaymentCashMovement(movement)?movement.reason.slice(MIXED_CASH_PREFIX.length).trim():""}

export function normalizePaymentBreakdown(total:number,cash:number):PaymentBreakdown{
  const safeTotal=Math.max(0,cents(total));
  const safeCash=Math.max(0,Math.min(safeTotal,cents(Number.isFinite(cash)?cash:0)));
  return{cash:safeCash,transfer:cents(safeTotal-safeCash)};
}

export function paymentBreakdownForSale(db:KiuboLocalDatabase,sale:SaleRecord):PaymentBreakdown{
  if(sale.payment==="cash")return{cash:cents(sale.total),transfer:0};
  if(sale.payment==="transfer")return{cash:0,transfer:cents(sale.total)};
  if(sale.payment!=="mixed")return{cash:0,transfer:0};
  const embedded=(sale as SaleWithPaymentBreakdown).paymentBreakdown;
  if(embedded&&Number.isFinite(embedded.cash)&&Number.isFinite(embedded.transfer)&&Math.abs(cents(embedded.cash+embedded.transfer)-cents(sale.total))<=.01){
    return normalizePaymentBreakdown(sale.total,embedded.cash);
  }
  const cash=db.cashMovements
    .filter(movement=>movement.tenantId===sale.tenantId&&movement.branchId===sale.branchId&&mixedSaleIdFromMovement(movement)===sale.id)
    .reduce((sum,movement)=>sum+movement.amount,0);
  return normalizePaymentBreakdown(sale.total,cash);
}
