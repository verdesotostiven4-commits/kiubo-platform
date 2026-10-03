import type { SaleRecord,StockMovementRecord,TenantProduct } from "./local-store";
import { parseOperationalItemName } from "./sale-adjustments";
import { getProductOptionConfig,parseProductOptionSelection } from "./product-options";
import { resolveInventoryImpact,stockUnit } from "./recipe-inventory";

export type IngredientConsumptionRow={productId:string;name:string;qty:number;unit:string;sourceCount:number};

export function ingredientConsumptionRows(sales:SaleRecord[],tenantProducts:TenantProduct[],stockMovements:StockMovementRecord[]){
  const salesById=new Map(sales.map(sale=>[sale.id,sale])),movementsBySale=new Map<string,StockMovementRecord[]>();
  for(const movement of stockMovements){const sale=salesById.get(movement.reference);if(!sale||movement.tenantId!==sale.tenantId||movement.branchId!==sale.branchId||movement.type!=="sale"||movement.quantity>=0)continue;const list=movementsBySale.get(movement.reference)||[];list.push(movement);movementsBySale.set(movement.reference,list)}
  const rows=new Map<string,IngredientConsumptionRow>(),add=(branchId:string,product:TenantProduct,qty:number)=>{if(qty<=0)return;const key=`${branchId}:${product.id}`,row=rows.get(key)||{productId:product.id,name:product.name,qty:0,unit:stockUnit(product),sourceCount:0};row.qty+=qty;row.sourceCount+=1;rows.set(key,row)};
  for(const sale of sales){
    const saleProducts=tenantProducts.filter(product=>product.tenantId===sale.tenantId&&product.branchId===sale.branchId),byId=new Map(saleProducts.map(product=>[product.id,product])),recorded=movementsBySale.get(sale.id)||[];
    if(recorded.length){for(const movement of recorded){const product=byId.get(movement.productId);if(product)add(sale.branchId,product,Math.abs(movement.quantity))}continue}
    for(const item of sale.items){const meta=parseOperationalItemName(item.name);if(meta.mode!=="sale"&&meta.mode!=="courtesy"&&meta.mode!=="internal")continue;const product=byId.get(item.productId);if(!product)continue;const optionSelections=item.optionSelections?.length?item.optionSelections:parseProductOptionSelection(getProductOptionConfig(product),item.optionLabel);for(const impact of resolveInventoryImpact([{productId:item.productId,qty:item.qty,optionSelections}],saleProducts)){const consumed=byId.get(impact.productId);if(consumed)add(sale.branchId,consumed,impact.qty)}}
  }
  return[...rows.values()].sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name,"es"));
}
