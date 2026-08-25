import {
  getLocalDeviceId,
  loadLocalSession,
  makeId,
  type CreditRecord,
  type FoodOrderRecord,
  type KiuboLocalDatabase,
  type SaleRecord,
  type StockMovementRecord,
  type TenantProduct,
} from "./local-store";

export type SaleTransactionPayload = {
  sale: SaleRecord;
  productSnapshots: TenantProduct[];
  stockMovements: StockMovementRecord[];
  credit?: CreditRecord;
  orderBefore?: FoodOrderRecord;
  orderAfter?: FoodOrderRecord;
};

export function enqueueSaleTransaction(db:KiuboLocalDatabase,payload:SaleTransactionPayload){
  const {sale}=payload;
  const now=new Date().toISOString();
  const existing=db.syncQueue.find(item=>
    item.tenantId===sale.tenantId&&
    item.entityType==="saleTransactions"&&
    item.entityId===sale.id&&
    (item.status==="pending"||item.status==="failed")
  );

  if(existing){
    existing.payload=payload;
    existing.branchId=sale.branchId;
    existing.status="pending";
    existing.attempts=0;
    existing.updatedAt=now;
    delete existing.lastError;
  }else{
    db.syncQueue.push({
      id:makeId("queue"),
      operationId:makeId("op"),
      tenantId:sale.tenantId,
      branchId:sale.branchId,
      entityType:"saleTransactions",
      entityId:sale.id,
      action:"upsert",
      payload,
      status:"pending",
      attempts:0,
      createdAt:now,
      updatedAt:now,
    });
  }

  const session=loadLocalSession();
  db.auditLogs.push({
    id:makeId("audit"),
    tenantId:sale.tenantId,
    branchId:sale.branchId,
    actorUserId:session?.userId,
    action:"sales.transaction_queued",
    entityType:"saleTransactions",
    entityId:sale.id,
    metadata:{deviceId:getLocalDeviceId(),items:sale.items.length,total:sale.total,orderId:payload.orderAfter?.id},
    createdAt:now,
  });

  db.auditLogs=db.auditLogs.slice(-1500);
  return db;
}
