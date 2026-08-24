import {
  getLocalDeviceId,
  loadLocalSession,
  makeId,
  type CashMovementRecord,
  type KiuboLocalDatabase,
  type PurchaseRecord,
  type StockMovementRecord,
  type SupplierPaymentRecord,
  type TenantProduct,
} from "./local-store";

export type PurchaseTransactionPayload={
  purchase:PurchaseRecord;
  productBeforeSnapshots:TenantProduct[];
  productSnapshots:TenantProduct[];
  stockMovements:StockMovementRecord[];
  initialPayment?:SupplierPaymentRecord;
  initialCashMovement?:CashMovementRecord;
};

export type SupplierPaymentTransactionPayload={
  payment:SupplierPaymentRecord;
  purchaseBefore:PurchaseRecord;
  purchaseAfter:PurchaseRecord;
  cashMovement?:CashMovementRecord;
};

function enqueue(db:KiuboLocalDatabase,input:{entityType:"purchaseTransactions"|"supplierPaymentTransactions";entityId:string;tenantId:string;branchId:string;payload:PurchaseTransactionPayload|SupplierPaymentTransactionPayload;auditAction:string;metadata:Record<string,unknown>}){
  const now=new Date().toISOString();
  const existing=db.syncQueue.find(item=>item.tenantId===input.tenantId&&item.entityType===input.entityType&&item.entityId===input.entityId&&(item.status==="pending"||item.status==="failed"));
  if(existing){existing.payload=input.payload;existing.branchId=input.branchId;existing.status="pending";existing.attempts=0;existing.updatedAt=now;delete existing.lastError}
  else db.syncQueue.push({id:makeId("queue"),operationId:makeId("op"),tenantId:input.tenantId,branchId:input.branchId,entityType:input.entityType,entityId:input.entityId,action:"upsert",payload:input.payload,status:"pending",attempts:0,createdAt:now,updatedAt:now});

  const session=loadLocalSession();
  db.auditLogs.push({id:makeId("audit"),tenantId:input.tenantId,branchId:input.branchId,actorUserId:session?.userId,action:input.auditAction,entityType:input.entityType,entityId:input.entityId,metadata:{deviceId:getLocalDeviceId(),...input.metadata},createdAt:now});
  db.auditLogs=db.auditLogs.slice(-1500);
  return db;
}

export function enqueuePurchaseTransaction(db:KiuboLocalDatabase,payload:PurchaseTransactionPayload){
  return enqueue(db,{entityType:"purchaseTransactions",entityId:payload.purchase.id,tenantId:payload.purchase.tenantId,branchId:payload.purchase.branchId,payload,auditAction:"purchases.transaction_queued",metadata:{items:payload.purchase.items.length,total:payload.purchase.total,initialPayment:payload.initialPayment?.amount||0,cashOutflow:payload.initialCashMovement?.amount||0}});
}

export function enqueueSupplierPaymentTransaction(db:KiuboLocalDatabase,payload:SupplierPaymentTransactionPayload){
  return enqueue(db,{entityType:"supplierPaymentTransactions",entityId:payload.payment.id,tenantId:payload.payment.tenantId,branchId:payload.payment.branchId,payload,auditAction:"supplier.payment_transaction_queued",metadata:{purchaseId:payload.payment.purchaseId,amount:payload.payment.amount,method:payload.payment.method,cashOutflow:payload.cashMovement?.amount||0}});
}
