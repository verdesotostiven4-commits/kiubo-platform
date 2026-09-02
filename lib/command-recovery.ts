import {getLocalDeviceId,loadLocalSession,makeId,type CashMovementRecord,type CashSessionRecord,type CreditPaymentRecord,type CreditRecord,type FoodOrderRecord,type KiuboLocalDatabase,type PurchaseRecord,type SaleRecord,type StockMovementRecord,type SupplierPaymentRecord,type TenantProduct} from "./local-store";
import type {SyncQueueRecord} from "./sync-types";

type SalePayload={sale?:SaleRecord;stockMovements?:StockMovementRecord[];credit?:CreditRecord;orderBefore?:FoodOrderRecord;orderAfter?:FoodOrderRecord;cashMovement?:CashMovementRecord};
type SaleReversalPayload={saleBefore?:SaleRecord;saleAfter?:SaleRecord;productBeforeSnapshots?:TenantProduct[];productAfterSnapshots?:TenantProduct[];stockMovements?:StockMovementRecord[];cashMovement?:CashMovementRecord};
type CashPayload=|{kind:"open"|"close";session?:CashSessionRecord}|{kind:"movement";movement?:CashMovementRecord};
type CreditPayload={payment?:CreditPaymentRecord;creditSnapshot?:CreditRecord;cashMovement?:CashMovementRecord};
type PurchasePayload={purchase?:PurchaseRecord;productBeforeSnapshots?:TenantProduct[];productSnapshots?:TenantProduct[];stockMovements?:StockMovementRecord[];initialPayment?:SupplierPaymentRecord;initialCashMovement?:CashMovementRecord};
type SupplierPaymentPayload={payment?:SupplierPaymentRecord;purchaseBefore?:PurchaseRecord;purchaseAfter?:PurchaseRecord;cashMovement?:CashMovementRecord};
type AdjustmentPayload={productBefore?:TenantProduct;productAfter?:TenantProduct;movement?:StockMovementRecord};

const COMMAND_TYPES=new Set(["saleTransactions","saleReversalTransactions","cashTransactions","creditPaymentTransactions","purchaseTransactions","supplierPaymentTransactions","inventoryAdjustmentTransactions"]);
const TERMINAL_ERROR_HINTS=["insufficient stock","stock_nonnegative","negative stock","product not found","product is inactive","customer not found","credit not found","credit already paid","cash session already open","cash session already closed","cash session is not open","cash session not found","branch denied","branch mismatch","branch does not belong","role denied","tenant is not allowed","tenant mismatch","sale id mismatch","invalid sale","sale not found","sale reversal","sale cannot be reversed","cash refund","invalid product","invalid payment","invalid cash","invalid credit","invalid finance","supplier not found","purchase not found","purchase already paid","duplicate purchase document","payment exceeds purchase balance","supplier payment","invalid purchase","purchase id mismatch","inventory adjustment","invalid inventory","requires customer","must contain","must be positive","cannot be negative","already open","already closed","violates check constraint"];
const eq=(a:number,b:number)=>Math.abs(a-b)<.000001;
const clean=(error:string)=>error.replace(/\s+/g," ").trim().slice(0,500);
export function shouldRecoverRejectedCommand(item:SyncQueueRecord,error:string){return COMMAND_TYPES.has(item.entityType)&&TERMINAL_ERROR_HINTS.some(x=>error.toLowerCase().includes(x))}
function removeById<T extends {id:string}>(items:T[],id?:string){if(!id)return{items,changed:false};const next=items.filter(x=>x.id!==id);return{items:next,changed:next.length!==items.length}}
function audit(db:KiuboLocalDatabase,item:SyncQueueRecord,error:string,changed:boolean,needsCanonicalPull:boolean){const session=loadLocalSession();db.auditLogs.push({id:makeId("audit"),tenantId:item.tenantId,branchId:item.branchId,actorUserId:session?.userId,action:"system.command_recovered",entityType:"system",entityId:item.entityId,metadata:{deviceId:getLocalDeviceId(),commandType:item.entityType,operationId:item.operationId,changed,needsCanonicalPull,error:clean(error)},createdAt:new Date().toISOString()});db.auditLogs=db.auditLogs.slice(-1500)}

export function recoverRejectedCommand(db:KiuboLocalDatabase,item:SyncQueueRecord,error:string){
  let changed=false,needsCanonicalPull=false;
  if(item.entityType==="saleTransactions"&&item.payload&&typeof item.payload==="object"){
    const p=item.payload as SalePayload,r=removeById(db.sales,p.sale?.id);db.sales=r.items;changed||=r.changed;
    const ids=new Set((p.stockMovements||[]).map(x=>x.id));if(ids.size){const n=db.stockMovements.filter(x=>!ids.has(x.id));changed||=n.length!==db.stockMovements.length;db.stockMovements=n}
    const cr=removeById(db.credits,p.credit?.id);db.credits=cr.items;changed||=cr.changed;
    const cm=removeById(db.cashMovements,p.cashMovement?.id);db.cashMovements=cm.items;changed||=cm.changed;
    for(const m of p.stockMovements||[]){const product=db.tenantProducts.find(x=>x.id===m.productId&&x.tenantId===item.tenantId);if(product&&eq(product.stock,m.newStock)){product.stock=Math.max(0,m.previousStock);changed=true}else needsCanonicalPull=true}
    if(p.orderAfter){
      const current=db.orders.find(order=>order.id===p.orderAfter?.id&&order.tenantId===item.tenantId);
      if(p.orderBefore){
        if(current&&current.paymentStatus==="paid"&&current.saleId===p.sale?.id){db.orders=db.orders.map(order=>order.id===p.orderAfter?.id?p.orderBefore!:order);changed=true}else needsCanonicalPull=true;
      }else{
        const orderRemoval=removeById(db.orders,p.orderAfter.id);db.orders=orderRemoval.items;changed||=orderRemoval.changed;
      }
    }
  }
  if(item.entityType==="saleReversalTransactions"&&item.payload&&typeof item.payload==="object"){
    const p=item.payload as SaleReversalPayload;
    const ids=new Set((p.stockMovements||[]).map(x=>x.id));if(ids.size){const n=db.stockMovements.filter(x=>!ids.has(x.id));changed||=n.length!==db.stockMovements.length;db.stockMovements=n}
    const cash=removeById(db.cashMovements,p.cashMovement?.id);db.cashMovements=cash.items;changed||=cash.changed;
    if(p.saleBefore&&p.saleAfter){const current=db.sales.find(x=>x.id===p.saleAfter?.id),status=(current as (SaleRecord&{status?:string})|undefined)?.status??"completed";if(current&&status==="voided"){db.sales=db.sales.map(x=>x.id===p.saleAfter?.id?p.saleBefore!:x);changed=true}else needsCanonicalPull=true}
    const before=new Map((p.productBeforeSnapshots||[]).map(x=>[x.id,x])),after=new Map((p.productAfterSnapshots||[]).map(x=>[x.id,x]));for(const [id,b] of before){const a=after.get(id),current=db.tenantProducts.find(x=>x.id===id&&x.tenantId===item.tenantId);if(a&&current&&eq(current.stock,a.stock)&&eq(current.cost,a.cost)){current.stock=b.stock;current.cost=b.cost;changed=true}else needsCanonicalPull=true}
  }
  if(item.entityType==="cashTransactions"&&item.payload&&typeof item.payload==="object"){
    const p=item.payload as CashPayload;
    if(p.kind==="open"){const r=removeById(db.cashSessions,p.session?.id);db.cashSessions=r.items;changed||=r.changed}
    else if(p.kind==="movement"){const r=removeById(db.cashMovements,p.movement?.id);db.cashMovements=r.items;changed||=r.changed}
    else if(p.kind==="close"&&p.session?.id){const current=db.cashSessions.find(x=>x.id===p.session?.id);if(current&&current.status==="closed"){current.status="open";delete current.closingAmount;delete current.closedAt;changed=true}else needsCanonicalPull=true}
  }
  if(item.entityType==="creditPaymentTransactions"&&item.payload&&typeof item.payload==="object"){
    const p=item.payload as CreditPayload,pr=removeById(db.creditPayments,p.payment?.id);db.creditPayments=pr.items;changed||=pr.changed;const mr=removeById(db.cashMovements,p.cashMovement?.id);db.cashMovements=mr.items;changed||=mr.changed;
    if(p.payment&&p.creditSnapshot){const current=db.credits.find(x=>x.id===p.creditSnapshot?.id);if(current&&eq(current.balance,p.creditSnapshot.balance)){current.balance=Math.min(current.originalAmount,Number((p.creditSnapshot.balance+p.payment.amount).toFixed(2)));current.status="open";changed=true}else needsCanonicalPull=true}
  }
  if(item.entityType==="purchaseTransactions"&&item.payload&&typeof item.payload==="object"){
    const p=item.payload as PurchasePayload,pu=removeById(db.purchases,p.purchase?.id);db.purchases=pu.items;changed||=pu.changed;const sp=removeById(db.supplierPayments,p.initialPayment?.id);db.supplierPayments=sp.items;changed||=sp.changed;const cm=removeById(db.cashMovements,p.initialCashMovement?.id);db.cashMovements=cm.items;changed||=cm.changed;
    const ids=new Set((p.stockMovements||[]).map(x=>x.id));if(ids.size){const n=db.stockMovements.filter(x=>!ids.has(x.id));changed||=n.length!==db.stockMovements.length;db.stockMovements=n}
    const before=new Map((p.productBeforeSnapshots||[]).map(x=>[x.id,x])),after=new Map((p.productSnapshots||[]).map(x=>[x.id,x]));for(const [id,b] of before){const a=after.get(id),current=db.tenantProducts.find(x=>x.id===id&&x.tenantId===item.tenantId);if(a&&current&&eq(current.stock,a.stock)&&eq(current.cost,a.cost)){current.stock=b.stock;current.cost=b.cost;changed=true}else needsCanonicalPull=true}
  }
  if(item.entityType==="supplierPaymentTransactions"&&item.payload&&typeof item.payload==="object"){
    const p=item.payload as SupplierPaymentPayload,sp=removeById(db.supplierPayments,p.payment?.id);db.supplierPayments=sp.items;changed||=sp.changed;const cm=removeById(db.cashMovements,p.cashMovement?.id);db.cashMovements=cm.items;changed||=cm.changed;
    if(p.purchaseBefore&&p.purchaseAfter){const current=db.purchases.find(x=>x.id===p.purchaseAfter?.id),paid=current?.paidAmount??0,after=p.purchaseAfter.paidAmount??0;if(current&&eq(paid,after)&&current.paymentStatus===p.purchaseAfter.paymentStatus){current.paidAmount=p.purchaseBefore.paidAmount;current.paymentStatus=p.purchaseBefore.paymentStatus;changed=true}else needsCanonicalPull=true}
  }
  if(item.entityType==="inventoryAdjustmentTransactions"&&item.payload&&typeof item.payload==="object"){
    const p=item.payload as AdjustmentPayload,mr=removeById(db.stockMovements,p.movement?.id);db.stockMovements=mr.items;changed||=mr.changed;if(p.productBefore&&p.productAfter){const current=db.tenantProducts.find(x=>x.id===p.productAfter?.id&&x.tenantId===item.tenantId);if(current&&eq(current.stock,p.productAfter.stock)){current.stock=p.productBefore.stock;changed=true}else needsCanonicalPull=true}
  }
  audit(db,item,error,changed,needsCanonicalPull);return{changed,needsCanonicalPull};
}
