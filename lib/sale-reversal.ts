import {
  getLocalDeviceId,
  getOpenCashSession,
  loadLocalSession,
  makeId,
  type CashMovementRecord,
  type KiuboLocalDatabase,
  type SaleRecord,
  type StockMovementRecord,
  type TenantProduct,
} from "./local-store";
import { mixedRefundMovementReason,paymentBreakdownForSale } from "./mixed-payment";

export type SaleLifecycle="completed"|"voided";
export type SaleWithLifecycle=SaleRecord&{status?:SaleLifecycle;voidedAt?:string;voidReason?:string};
export type SaleReversalPayload={
  saleBefore:SaleRecord;
  saleAfter:SaleRecord;
  productBeforeSnapshots:TenantProduct[];
  productAfterSnapshots:TenantProduct[];
  stockMovements:StockMovementRecord[];
  cashMovement?:CashMovementRecord;
  reason:string;
  reversedAt:string;
};

export function saleLifecycle(sale:SaleRecord):SaleLifecycle{return (sale as SaleWithLifecycle).status==="voided"?"voided":"completed"}

export function reverseSaleLocally(db:KiuboLocalDatabase,saleId:string,rawReason:string){
  const sale=db.sales.find(candidate=>candidate.id===saleId);
  if(!sale)return{ok:false as const,message:"Venta no encontrada"};
  if(saleLifecycle(sale)==="voided")return{ok:false as const,message:"La venta ya está anulada"};
  const localSession=loadLocalSession(),actor=db.users.find(user=>user.id===localSession?.userId&&user.tenantId===sale.tenantId);
  if(!actor?.platformAdmin&&actor?.role!=="owner"&&actor?.role!=="admin")return{ok:false as const,message:"Solo propietario o administrador puede anular una venta"};
  const saleAt=Date.parse(sale.createdAt),age=Date.now()-saleAt;
  if(!Number.isFinite(saleAt)||age>24*60*60*1000||age<-(5*60*1000))return{ok:false as const,message:"La ventana de anulación expiró; una operación más antigua debe ir por devolución o nota de crédito"};
  if(sale.payment==="credit")return{ok:false as const,message:"Los fiados con saldo requieren un flujo de reverso específico; esta venta no se anuló"};
  const breakdown=sale.payment==="mixed"?paymentBreakdownForSale(db,sale):undefined;
  if(sale.payment==="mixed"&&(!breakdown||breakdown.cash<=0||breakdown.transfer<=0))return{ok:false as const,message:"Esta venta mixta histórica no tiene un reparto verificable y no se puede anular automáticamente"};
  const reason=rawReason.replace(/\s+/g," ").trim().slice(0,240);
  if(reason.length<3)return{ok:false as const,message:"Escribe un motivo de anulación de al menos 3 caracteres"};
  const refundCash=sale.payment==="cash"?Number(sale.total.toFixed(2)):sale.payment==="mixed"?breakdown!.cash:0;
  const session=refundCash>0?getOpenCashSession(db,sale.tenantId,sale.branchId):undefined;
  if(refundCash>0&&!session)return{ok:false as const,message:"Abre caja antes de devolver efectivo; KIUBO necesita registrar correctamente la salida de caja"};

  const originalMovements=db.stockMovements.filter(movement=>movement.tenantId===sale.tenantId&&movement.branchId===sale.branchId&&movement.reference===sale.id&&movement.type==="sale"&&movement.quantity<0);
  const restoreByProduct=new Map<string,number>();
  for(const movement of originalMovements)restoreByProduct.set(movement.productId,(restoreByProduct.get(movement.productId)||0)+Math.abs(movement.quantity));
  const products=[...restoreByProduct].map(([productId])=>db.tenantProducts.find(product=>product.id===productId&&product.tenantId===sale.tenantId&&product.branchId===sale.branchId));
  if(products.some(product=>!product))return{ok:false as const,message:"No se puede anular porque un insumo afectado por la venta ya no existe en esta sucursal"};

  const reversedAt=new Date().toISOString(),saleBefore={...sale,items:sale.items.map(item=>({...item}))};
  const saleAfter:SaleWithLifecycle={...saleBefore,status:"voided",voidedAt:reversedAt,voidReason:reason};
  const productBeforeSnapshots:TenantProduct[]=[],productAfterSnapshots:TenantProduct[]=[],stockMovements:StockMovementRecord[]=[];
  for(const [productId,restoreQty] of restoreByProduct){
    const product=db.tenantProducts.find(candidate=>candidate.id===productId&&candidate.tenantId===sale.tenantId&&candidate.branchId===sale.branchId)!;
    productBeforeSnapshots.push({...product});
    const previous=product.stock,newStock=Number((previous+restoreQty).toFixed(4));product.stock=newStock;productAfterSnapshots.push({...product});
    const movementId=makeId("stock-void");
    stockMovements.push({id:movementId,tenantId:sale.tenantId,branchId:sale.branchId,productId:product.id,type:"adjustment_in",quantity:restoreQty,previousStock:previous,newStock,reference:`VOID:${sale.id}`,clientOperationId:movementId,createdAt:reversedAt});
  }
  db.sales=db.sales.map(current=>current.id===sale.id?saleAfter:current);db.stockMovements.unshift(...stockMovements);

  let cashMovement:CashMovementRecord|undefined;
  if(refundCash>0&&session){
    const movementId=makeId("movement");
    cashMovement={id:movementId,tenantId:sale.tenantId,branchId:sale.branchId,sessionId:session.id,type:"out",amount:refundCash,reason:sale.payment==="mixed"?mixedRefundMovementReason(sale.id):`Anulación venta · ${reason}`,clientOperationId:movementId,createdAt:reversedAt};
    db.cashMovements.unshift(cashMovement);
  }

  const payload:SaleReversalPayload={saleBefore,saleAfter,productBeforeSnapshots,productAfterSnapshots,stockMovements,cashMovement,reason,reversedAt};
  const now=reversedAt,existing=db.syncQueue.find(item=>item.tenantId===sale.tenantId&&item.entityType==="saleReversalTransactions"&&item.entityId===sale.id&&(item.status==="pending"||item.status==="failed"));
  if(existing){existing.payload=payload;existing.branchId=sale.branchId;existing.status="pending";existing.attempts=0;existing.updatedAt=now;delete existing.lastError}
  else db.syncQueue.push({id:makeId("queue"),operationId:makeId("op-sale-void"),tenantId:sale.tenantId,branchId:sale.branchId,entityType:"saleReversalTransactions",entityId:sale.id,action:"upsert",payload,status:"pending",attempts:0,createdAt:now,updatedAt:now});
  db.auditLogs.push({id:makeId("audit"),tenantId:sale.tenantId,branchId:sale.branchId,actorUserId:localSession?.userId,action:"sales.reversal_queued",entityType:"saleReversalTransactions",entityId:sale.id,metadata:{deviceId:getLocalDeviceId(),payment:sale.payment,total:sale.total,reason,cashOutflow:cashMovement?.amount||0,restoredInventory:[...restoreByProduct.entries()]},createdAt:now});
  db.auditLogs=db.auditLogs.slice(-1500);
  return{ok:true as const,message:`Venta anulada · $${sale.total.toFixed(2)} · devolución e inventario registrados`};
}
