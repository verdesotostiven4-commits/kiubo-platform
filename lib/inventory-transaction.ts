import {
  getLocalDeviceId,
  loadLocalSession,
  makeId,
  type KiuboLocalDatabase,
  type StockMovementRecord,
  type TenantProduct,
} from "./local-store";

export type InventoryAdjustmentPayload={
  productId:string;
  delta:number;
  reason:string;
  movementId:string;
  createdAt:string;
  productBefore:TenantProduct;
  productAfter:TenantProduct;
  movement:StockMovementRecord;
};

export function enqueueInventoryAdjustment(db:KiuboLocalDatabase,payload:InventoryAdjustmentPayload){
  const product=payload.productAfter,now=new Date().toISOString();
  const existing=db.syncQueue.find(item=>item.tenantId===product.tenantId&&item.entityType==="inventoryAdjustmentTransactions"&&item.entityId===payload.movementId&&(item.status==="pending"||item.status==="failed"));
  if(existing){existing.payload=payload;existing.branchId=product.branchId;existing.status="pending";existing.attempts=0;existing.updatedAt=now;delete existing.lastError}
  else db.syncQueue.push({id:makeId("queue"),operationId:makeId("op"),tenantId:product.tenantId,branchId:product.branchId,entityType:"inventoryAdjustmentTransactions",entityId:payload.movementId,action:"upsert",payload,status:"pending",attempts:0,createdAt:now,updatedAt:now});
  const session=loadLocalSession();
  db.auditLogs.push({id:makeId("audit"),tenantId:product.tenantId,branchId:product.branchId,actorUserId:session?.userId,action:"inventory.adjustment_queued",entityType:"inventoryAdjustmentTransactions",entityId:payload.movementId,metadata:{deviceId:getLocalDeviceId(),productId:payload.productId,delta:payload.delta,reason:payload.reason},createdAt:now});
  db.auditLogs=db.auditLogs.slice(-1500);
  return db;
}
