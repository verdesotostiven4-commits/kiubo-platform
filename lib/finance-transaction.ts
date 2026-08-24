import {
  getLocalDeviceId,
  loadLocalSession,
  makeId,
  type CashMovementRecord,
  type CashSessionRecord,
  type CreditPaymentRecord,
  type CreditRecord,
  type KiuboLocalDatabase,
} from "./local-store";

export type CashTransactionPayload =
  | { kind:"open"; session:CashSessionRecord }
  | { kind:"movement"; movement:CashMovementRecord }
  | { kind:"close"; session:CashSessionRecord };

export type CreditPaymentTransactionPayload = {
  payment:CreditPaymentRecord;
  creditSnapshot:CreditRecord;
  cashMovement?:CashMovementRecord;
};

function enqueueCommand(
  db:KiuboLocalDatabase,
  input:{
    entityType:"cashTransactions"|"creditPaymentTransactions";
    entityId:string;
    tenantId:string;
    branchId:string;
    payload:CashTransactionPayload|CreditPaymentTransactionPayload;
    auditAction:string;
    metadata?:Record<string,unknown>;
  }
){
  const now=new Date().toISOString();
  const existing=db.syncQueue.find(item=>
    item.tenantId===input.tenantId&&
    item.entityType===input.entityType&&
    item.entityId===input.entityId&&
    (item.status==="pending"||item.status==="failed")
  );

  if(existing){
    existing.payload=input.payload;
    existing.branchId=input.branchId;
    existing.status="pending";
    existing.attempts=0;
    existing.updatedAt=now;
    delete existing.lastError;
  }else{
    db.syncQueue.push({
      id:makeId("queue"),
      operationId:makeId("op"),
      tenantId:input.tenantId,
      branchId:input.branchId,
      entityType:input.entityType,
      entityId:input.entityId,
      action:"upsert",
      payload:input.payload,
      status:"pending",
      attempts:0,
      createdAt:now,
      updatedAt:now,
    });
  }

  const session=loadLocalSession();
  db.auditLogs.push({
    id:makeId("audit"),
    tenantId:input.tenantId,
    branchId:input.branchId,
    actorUserId:session?.userId,
    action:input.auditAction,
    entityType:input.entityType,
    entityId:input.entityId,
    metadata:{deviceId:getLocalDeviceId(),...(input.metadata||{})},
    createdAt:now,
  });
  db.auditLogs=db.auditLogs.slice(-1500);
  return db;
}

export function enqueueCashTransaction(db:KiuboLocalDatabase,payload:CashTransactionPayload){
  const session=payload.kind==="movement"?undefined:payload.session;
  const movement=payload.kind==="movement"?payload.movement:undefined;
  const tenantId=session?.tenantId||movement?.tenantId||"";
  const branchId=session?.branchId||movement?.branchId||"";
  const entityId=payload.kind==="movement"?payload.movement.id:`${payload.kind}:${payload.session.id}`;
  return enqueueCommand(db,{
    entityType:"cashTransactions",
    entityId,
    tenantId,
    branchId,
    payload,
    auditAction:`cash.${payload.kind}_queued`,
    metadata:{kind:payload.kind},
  });
}

export function enqueueCreditPaymentTransaction(db:KiuboLocalDatabase,payload:CreditPaymentTransactionPayload){
  return enqueueCommand(db,{
    entityType:"creditPaymentTransactions",
    entityId:payload.payment.id,
    tenantId:payload.payment.tenantId,
    branchId:payload.payment.branchId,
    payload,
    auditAction:"credit.payment_queued",
    metadata:{creditId:payload.payment.creditId,amount:payload.payment.amount,method:payload.payment.method},
  });
}
