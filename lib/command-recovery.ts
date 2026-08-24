import {
  getLocalDeviceId,
  loadLocalSession,
  makeId,
  type CashMovementRecord,
  type CashSessionRecord,
  type CreditPaymentRecord,
  type CreditRecord,
  type KiuboLocalDatabase,
  type SaleRecord,
  type StockMovementRecord,
} from "./local-store";
import type { SyncQueueRecord } from "./sync-types";

type SaleTransactionPayload={
  sale?:SaleRecord;
  stockMovements?:StockMovementRecord[];
  credit?:CreditRecord;
};
type CashTransactionPayload=
  | {kind:"open"|"close";session?:CashSessionRecord}
  | {kind:"movement";movement?:CashMovementRecord};
type CreditPaymentTransactionPayload={
  payment?:CreditPaymentRecord;
  creditSnapshot?:CreditRecord;
  cashMovement?:CashMovementRecord;
};

const COMMAND_TYPES=new Set(["saleTransactions","cashTransactions","creditPaymentTransactions"]);
const TERMINAL_ERROR_HINTS=[
  "insufficient stock",
  "stock_nonnegative",
  "negative stock",
  "product not found",
  "product is inactive",
  "customer not found",
  "credit not found",
  "credit already paid",
  "cash session already open",
  "cash session already closed",
  "cash session is not open",
  "cash session not found",
  "branch denied",
  "branch mismatch",
  "branch does not belong",
  "role denied",
  "tenant is not allowed",
  "tenant mismatch",
  "sale id mismatch",
  "invalid sale",
  "invalid product",
  "invalid payment",
  "invalid cash",
  "invalid credit",
  "invalid finance",
  "requires customer",
  "must contain",
  "must be positive",
  "cannot be negative",
  "already open",
  "already closed",
  "violates check constraint",
];

function nearlyEqual(a:number,b:number){return Math.abs(a-b)<0.000001}
function trimError(error:string){return error.replace(/\s+/g," ").trim().slice(0,500)}

export function shouldRecoverRejectedCommand(item:SyncQueueRecord,error:string){
  if(!COMMAND_TYPES.has(item.entityType))return false;
  const lower=error.toLowerCase();
  return TERMINAL_ERROR_HINTS.some(hint=>lower.includes(hint));
}

function auditRecovery(db:KiuboLocalDatabase,item:SyncQueueRecord,error:string,changed:boolean,needsCanonicalPull:boolean){
  const session=loadLocalSession();
  db.auditLogs.push({
    id:makeId("audit"),
    tenantId:item.tenantId,
    branchId:item.branchId,
    actorUserId:session?.userId,
    action:"system.command_recovered",
    entityType:"system",
    entityId:item.entityId,
    metadata:{
      deviceId:getLocalDeviceId(),
      commandType:item.entityType,
      operationId:item.operationId,
      changed,
      needsCanonicalPull,
      error:trimError(error),
    },
    createdAt:new Date().toISOString(),
  });
  db.auditLogs=db.auditLogs.slice(-1500);
}

export function recoverRejectedCommand(db:KiuboLocalDatabase,item:SyncQueueRecord,error:string){
  let changed=false,needsCanonicalPull=false;

  if(item.entityType==="saleTransactions"&&item.payload&&typeof item.payload==="object"){
    const payload=item.payload as SaleTransactionPayload;
    if(payload.sale?.id){
      const before=db.sales.length;
      db.sales=db.sales.filter(sale=>sale.id!==payload.sale?.id);
      changed=changed||before!==db.sales.length;
    }
    const movementIds=new Set((payload.stockMovements||[]).map(movement=>movement.id));
    if(movementIds.size){
      const before=db.stockMovements.length;
      db.stockMovements=db.stockMovements.filter(movement=>!movementIds.has(movement.id));
      changed=changed||before!==db.stockMovements.length;
    }
    if(payload.credit?.id){
      const before=db.credits.length;
      db.credits=db.credits.filter(credit=>credit.id!==payload.credit?.id);
      changed=changed||before!==db.credits.length;
    }
    for(const movement of payload.stockMovements||[]){
      const product=db.tenantProducts.find(candidate=>candidate.id===movement.productId&&candidate.tenantId===item.tenantId);
      if(!product){needsCanonicalPull=true;continue}
      if(nearlyEqual(product.stock,movement.newStock)){
        product.stock=Math.max(0,movement.previousStock);
        changed=true;
      }else{
        // A later local operation already touched this product. Never overwrite it with an old absolute stock.
        needsCanonicalPull=true;
      }
    }
  }

  if(item.entityType==="cashTransactions"&&item.payload&&typeof item.payload==="object"){
    const payload=item.payload as CashTransactionPayload;
    if(payload.kind==="open"&&payload.session?.id){
      const before=db.cashSessions.length;
      db.cashSessions=db.cashSessions.filter(session=>session.id!==payload.session?.id);
      changed=changed||before!==db.cashSessions.length;
    }else if(payload.kind==="movement"&&payload.movement?.id){
      const before=db.cashMovements.length;
      db.cashMovements=db.cashMovements.filter(movement=>movement.id!==payload.movement?.id);
      changed=changed||before!==db.cashMovements.length;
    }else if(payload.kind==="close"&&payload.session?.id){
      const current=db.cashSessions.find(session=>session.id===payload.session?.id);
      if(current&&current.status==="closed"){
        current.status="open";
        delete current.closingAmount;
        delete current.closedAt;
        changed=true;
      }else{
        needsCanonicalPull=true;
      }
    }
  }

  if(item.entityType==="creditPaymentTransactions"&&item.payload&&typeof item.payload==="object"){
    const payload=item.payload as CreditPaymentTransactionPayload;
    if(payload.payment?.id){
      const before=db.creditPayments.length;
      db.creditPayments=db.creditPayments.filter(payment=>payment.id!==payload.payment?.id);
      changed=changed||before!==db.creditPayments.length;
    }
    if(payload.cashMovement?.id){
      const before=db.cashMovements.length;
      db.cashMovements=db.cashMovements.filter(movement=>movement.id!==payload.cashMovement?.id);
      changed=changed||before!==db.cashMovements.length;
    }
    if(payload.payment&&payload.creditSnapshot){
      const current=db.credits.find(credit=>credit.id===payload.creditSnapshot?.id);
      if(current&&nearlyEqual(current.balance,payload.creditSnapshot.balance)){
        current.balance=Math.min(current.originalAmount,Number((payload.creditSnapshot.balance+payload.payment.amount).toFixed(2)));
        current.status="open";
        changed=true;
      }else{
        needsCanonicalPull=true;
      }
    }
  }

  auditRecovery(db,item,error,changed,needsCanonicalPull);
  return{changed,needsCanonicalPull};
}
