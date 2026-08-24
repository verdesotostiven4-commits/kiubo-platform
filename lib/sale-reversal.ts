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
  if(sale.payment==="credit")return{ok:false as const,message:"Los fiados con saldo requieren un flujo de reverso específico; esta venta no se anuló"};
  if(sale.payment==="mixed")return{ok:false as const,message:"Las ventas mixtas históricas no se pueden anular hasta reconstruir su reparto de pago"};
  const reason=rawReason.replace(/\s+/g," ").trim().slice(0,240);
  if(reason.length<3)return{ok:false as const,message:"Escribe un motivo de anulación de al menos 3 caracteres"};
  const products=sale.items.map(item=>db.tenantProducts.find(product=>product.id===item.productId&&product.tenantId===sale.tenantId&&product.branchId===sale.branchId));
  if(products.some(product=>!product))return{ok:false as const,message:"No se puede anular porque uno de los productos ya no existe en esta sucursal"};
  const session=sale.payment==="cash"?getOpenCashSession(db,sale.tenantId,sale.branchId):undefined;
  if(sale.payment==="cash"&&!session)return{ok:false as const,message:"Abre caja antes de devolver efectivo por una venta anulada"};

  const reversedAt=new Date().toISOString(),saleBefore={...sale,items:sale.items.map(item=>({...item}))};
  const saleAfter:SaleWithLifecycle={...saleBefore,status:"voided",voidedAt:reversedAt,voidReason:reason};
  const productBeforeSnapshots:TenantProduct[]=[],productAfterSnapshots:TenantProduct[]=[],stockMovements:StockMovementRecord[]=[];
  sale.items.forEach((item,index)=>{
    const product=products[index]!;
    productBeforeSnapshots.push({...product});
    const previous=product.stock,newStock=Number((previous+item.qty).toFixed(4));
    product.stock=newStock;
    productAfterSnapshots.push({...product});
    stockMovements.push({
      id:makeId("stock-void"),tenantId:sale.tenantId,branchId:sale.branchId,productId:product.id,
      type:"adjustment_in",quantity:item.qty,previousStock:previous,newStock,reference:`VOID:${sale.id}`,
      clientOperationId:makeId("op-void-stock"),createdAt:reversedAt,
    });
  });
  db.sales=db.sales.map(current=>current.id===sale.id?saleAfter:current);
  db.stockMovements.unshift(...stockMovements);

  let cashMovement:CashMovementRecord|undefined;
  if(sale.payment==="cash"&&session){
    const movementId=makeId("movement");
    cashMovement={id:movementId,tenantId:sale.tenantId,branchId:sale.branchId,sessionId:session.id,type:"out",amount:Number(sale.total.toFixed(2)),reason:`Anulación venta · ${reason}`,clientOperationId:movementId,createdAt:reversedAt};
    db.cashMovements.unshift(cashMovement);
  }

  const payload:SaleReversalPayload={saleBefore,saleAfter,productBeforeSnapshots,productAfterSnapshots,stockMovements,cashMovement,reason,reversedAt};
  const now=reversedAt,existing=db.syncQueue.find(item=>item.tenantId===sale.tenantId&&item.entityType==="saleReversalTransactions"&&item.entityId===sale.id&&(item.status==="pending"||item.status==="failed"));
  if(existing){existing.payload=payload;existing.branchId=sale.branchId;existing.status="pending";existing.attempts=0;existing.updatedAt=now;delete existing.lastError}
  else db.syncQueue.push({id:makeId("queue"),operationId:makeId("op-sale-void"),tenantId:sale.tenantId,branchId:sale.branchId,entityType:"saleReversalTransactions",entityId:sale.id,action:"upsert",payload,status:"pending",attempts:0,createdAt:now,updatedAt:now});
  const localSession=loadLocalSession();
  db.auditLogs.push({id:makeId("audit"),tenantId:sale.tenantId,branchId:sale.branchId,actorUserId:localSession?.userId,action:"sales.reversal_queued",entityType:"saleReversalTransactions",entityId:sale.id,metadata:{deviceId:getLocalDeviceId(),payment:sale.payment,total:sale.total,reason,cashOutflow:cashMovement?.amount||0},createdAt:now});
  db.auditLogs=db.auditLogs.slice(-1500);
  return{ok:true as const,message:`Venta anulada localmente · $${sale.total.toFixed(2)} · pendiente de confirmación Cloud`};
}
