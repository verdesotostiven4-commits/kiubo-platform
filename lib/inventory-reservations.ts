/**
 * Open/unpaid orders reserve *availability*, not physical stock. Only the
 * authoritative sale transaction debits stock. This prevents a checkout from
 * charging recipe ingredients twice and makes cancellation release reservations.
 *
 * Browser snapshots are eventually consistent: concurrent devices need
 * server-side atomic reservation enforcement before claiming a hard guarantee.
 */
import type {FoodOrderRecord,KiuboLocalDatabase,TenantProduct} from "./local-store";
import {getProductOptionConfig,parseProductOptionSelection} from "./product-options";
import {resolveInventoryImpact,type InventorySelectionLine} from "./recipe-inventory";

export type InventoryAvailability={
  product:TenantProduct;physical:number;reserved:number;available:number;
};
export type InventoryDeficit=InventoryAvailability&{requested:number};
const amount=(n:number)=>Number(n.toFixed(4));
const isHoldingOrder=(o:FoodOrderRecord)=>
  o.paymentStatus==="unpaid"&&!o.saleId&&o.status!=="cancelled"&&o.status!=="delivered";

export function reservedInventory(
  db:KiuboLocalDatabase,tenantId:string,branchId:string,excludeOrderId?:string
):Map<string,number>{
  const products=db.tenantProducts.filter(p=>p.tenantId===tenantId&&p.branchId===branchId);
  const byId=new Map(products.map(p=>[p.id,p]));
  const byOrder=new Map<string,FoodOrderRecord>();
  for(const order of db.orders){
    if(order.tenantId!==tenantId||order.branchId!==branchId||!isHoldingOrder(order)||order.id===excludeOrderId)continue;
    const previous=byOrder.get(order.id);
    if(!previous||Date.parse(order.updatedAt)>Date.parse(previous.updatedAt))byOrder.set(order.id,order);
  }
  const held=new Map<string,number>();
  for(const order of byOrder.values()){
    const lines:InventorySelectionLine[]=[];
    for(const item of order.items||[]){
      const product=byId.get(item.productId);
      if(!product||!Number.isFinite(item.qty)||item.qty<=0)continue;
      const optionText=item.notes||item.name.split(" · ").slice(1).join(" · ");
      const optionSelections=parseProductOptionSelection(getProductOptionConfig(product),optionText);
      lines.push({productId:product.id,qty:item.qty,optionSelections});
    }
    for(const impact of resolveInventoryImpact(lines,products)){
      held.set(impact.productId,amount((held.get(impact.productId)||0)+impact.qty));
    }
  }
  return held;
}

export function stockAvailability(
  db:KiuboLocalDatabase,tenantId:string,branchId:string,excludeOrderId?:string
):Map<string,InventoryAvailability>{
  const held=reservedInventory(db,tenantId,branchId,excludeOrderId);
  return new Map(db.tenantProducts
    .filter(p=>p.tenantId===tenantId&&p.branchId===branchId&&p.trackStock!==false)
    .map(product=>{
      const reserved=held.get(product.id)||0;
      return [product.id,{product,physical:product.stock,reserved,available:amount(product.stock-reserved)}] as const;
    }));
}

export function inventoryDeficits(
  db:KiuboLocalDatabase,tenantId:string,branchId:string,
  cartLines:InventorySelectionLine[],excludeOrderId?:string
):InventoryDeficit[]{
  const products=db.tenantProducts.filter(p=>p.tenantId===tenantId&&p.branchId===branchId);
  const availability=stockAvailability(db,tenantId,branchId,excludeOrderId);
  return resolveInventoryImpact(cartLines,products).flatMap(impact=>{
    const item=availability.get(impact.productId);
    if(!item||impact.qty<=item.available+0.0001)return[];
    return [{...item,requested:amount(impact.qty)}];
  });
}
