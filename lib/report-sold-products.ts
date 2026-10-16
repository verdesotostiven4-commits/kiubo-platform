import type {SaleRecord,TenantProduct} from "./local-store";
import {parseOperationalItemName} from "./sale-adjustments";
import {productKind} from "./product-classification";

export type ProductVariantSummary={label:string;qty:number};
export type SoldProductRow={
  id:string;name:string;qty:number;revenue:number;tickets:Set<string>;
  variants:ProductVariantSummary[];
};
export type ExcludedProductLines={courtesy:number;internal:number;charge:number};

// Totals must use product IDs, not display names. A product's first sale
// can be a particular variant (e.g. Combo 1 · Yogur Fresa). Display the
// canonical catalog name for totals and show flavour breakdowns separately.
export function soldProductReport(sales:SaleRecord[],products:TenantProduct[]){
  const productByKey=new Map(products.map(product=>[`${product.branchId}:${product.id}`,product]));
  const excluded:ExcludedProductLines={courtesy:0,internal:0,charge:0};
  const rows=new Map<string,SoldProductRow>();
  const variantMaps=new Map<string,Map<string,number>>();
  const visited=new Set<string>();
  for(const sale of sales){
    const saleKey=`${sale.branchId}:${sale.id}`;
    if(visited.has(saleKey))continue;
    visited.add(saleKey);
    for(const item of sale.items){
      const meta=parseOperationalItemName(item.name);
      if(meta.mode==="courtesy"){excluded.courtesy+=item.qty;continue}
      if(meta.mode==="internal"){excluded.internal+=item.qty;continue}
      const key=`${sale.branchId}:${item.productId}`;
      const catalog=productByKey.get(key);
      const kind=catalog?productKind(catalog):undefined;
      if(kind==="charge"||item.productId==="yuki-service-packaging"){excluded.charge+=item.qty;continue}
      if(kind==="ingredient"||kind==="option")continue;
      const baseName=catalog?.name||meta.displayName.split(" · ")[0];
      const row=rows.get(key)||{id:key,name:baseName,qty:0,revenue:0,tickets:new Set<string>(),variants:[]};
      row.qty+=item.qty;
      row.revenue+=item.qty*item.unitPrice;
      row.tickets.add(saleKey);
      rows.set(key,row);
      // Prior sales store selections in optionLabel, and some only in their
      // displayed item name. Normalize "Yogurt"/"Yogur" to one flavour group.
      const textFromName=meta.displayName.startsWith(baseName+" · ")
        ?meta.displayName.slice(baseName.length+3):"";
      const variant=(item.optionLabel||textFromName).trim().replace(/\bYogurt\b/gi,"Yogur");
      if(!variant)continue;
      const variants=variantMaps.get(key)||new Map<string,number>();
      variants.set(variant,(variants.get(variant)||0)+item.qty);
      variantMaps.set(key,variants);
    }
  }
  for(const [key,row] of rows){
    row.variants=[...(variantMaps.get(key)||new Map()).entries()]
      .map(([label,qty])=>({label,qty}))
      .sort((a,b)=>b.qty-a.qty||a.label.localeCompare(b.label,"es"));
  }
  const summary=[...rows.values()].sort((a,b)=>b.qty-a.qty||b.revenue-a.revenue||a.name.localeCompare(b.name,"es"));
  return{summary,excluded,totalUnits:summary.reduce((sum,item)=>sum+item.qty,0)};
}
