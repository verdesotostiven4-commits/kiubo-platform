import type {CashMovementRecord,KiuboLocalDatabase} from "./local-store";

/** Cash denomination exchanges are not new cash; flag ambiguous manual entries
 * for a human to check instead of editing historical accounting records. */
export function suspiciousCashExchangeNote(reason:string):boolean{
  const normalized=reason.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  const exchange=/\b(monedas?|billetes?|suelto|cambio|cambiar|cambiado)\b/.test(normalized);
  const explicitExternal=/\b(aporte|aportado|externo|externa|deposito|capital|desde banco|nuevo dinero)\b/.test(normalized);
  return exchange&&!explicitExternal;
}

export function unverifiedDenominationMovements(db:KiuboLocalDatabase,tenantId:string,branchId:string,sessionId:string):CashMovementRecord[]{
  return db.cashMovements.filter(m=>m.tenantId===tenantId&&m.branchId===branchId&&m.sessionId===sessionId&&m.type==="in"&&suspiciousCashExchangeNote(m.reason));
}

export function pendingTurnFinancialOperations(db:KiuboLocalDatabase,tenantId:string,branchId:string,startedAt:string):number{
  const started=Date.parse(startedAt);
  return db.syncQueue.filter(op=>op.tenantId===tenantId&&op.branchId===branchId&&
    ["pending","syncing","failed"].includes(op.status)&&
    ["saleTransactions","creditPaymentTransactions","saleReversalTransactions","cashTransactions"].includes(op.entityType)&&
    Number.isFinite(Date.parse(op.createdAt))&&Date.parse(op.createdAt)>=started).length;
}
