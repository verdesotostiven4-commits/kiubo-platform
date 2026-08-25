import { FoodOrderRecord,KiuboLocalDatabase,getLocalDeviceId,loadLocalSession,makeId } from "./local-store";

export function queueFoodOrder(db:KiuboLocalDatabase,order:FoodOrderRecord){
  const now=new Date().toISOString();
  const existing=db.syncQueue.find(item=>item.tenantId===order.tenantId&&item.entityType==="orders"&&item.entityId===order.id&&(item.status==="pending"||item.status==="failed"));
  if(existing){
    existing.payload=order;existing.branchId=order.branchId;existing.action="upsert";existing.status="pending";existing.attempts=0;existing.updatedAt=now;delete existing.lastError;
  }else db.syncQueue.push({id:makeId("queue"),operationId:makeId("op"),tenantId:order.tenantId,branchId:order.branchId,entityType:"orders",entityId:order.id,action:"upsert",payload:order,status:"pending",attempts:0,createdAt:now,updatedAt:now});
  const session=loadLocalSession();
  db.auditLogs.push({id:makeId("audit"),tenantId:order.tenantId,branchId:order.branchId,actorUserId:session?.userId,action:"orders.upsert",entityType:"orders",entityId:order.id,metadata:{deviceId:getLocalDeviceId(),status:order.status,paymentStatus:order.paymentStatus},createdAt:now});
}
