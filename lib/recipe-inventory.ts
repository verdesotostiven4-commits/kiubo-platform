import type { TenantProduct } from "./local-store";
import { getProductOptionConfig } from "./product-options";

export type RecipeComponent={productId:string;qty:number};
export type InventoryProduct=TenantProduct&{
  inventoryOnly?:boolean;
  stockUnit?:string;
  lowStockThreshold?:number;
  recipe?:RecipeComponent[];
};
export type InventorySelectionLine={productId:string;qty:number;optionSelections?:string[]};
export type InventoryImpact={productId:string;qty:number;sources:string[]};

const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("es");
const cleanQty=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0};

export function asInventoryProduct(product:TenantProduct){return product as InventoryProduct}
export function productRecipe(product:TenantProduct):RecipeComponent[]{
  const raw=asInventoryProduct(product).recipe;
  if(!Array.isArray(raw))return[];
  const seen=new Map<string,number>();
  for(const item of raw){
    if(!item||typeof item.productId!=="string")continue;
    const qty=cleanQty(item.qty);if(!qty)continue;
    seen.set(item.productId,(seen.get(item.productId)||0)+qty);
  }
  return [...seen].map(([productId,qty])=>({productId,qty}));
}
export function inventoryOnly(product:TenantProduct){return asInventoryProduct(product).inventoryOnly===true}
export function stockUnit(product:TenantProduct){return String(asInventoryProduct(product).stockUnit||"u").trim()||"u"}
export function lowStockThreshold(product:TenantProduct){const value=Number(asInventoryProduct(product).lowStockThreshold);return Number.isFinite(value)&&value>=0?value:5}
export function hasRecipe(product:TenantProduct){return productRecipe(product).length>0}

function optionChoiceProduct(product:TenantProduct,label:string,products:TenantProduct[]){
  const config=getProductOptionConfig(product);if(!config||config.source!=="category"||!config.sourceCategory)return undefined;
  const category=normalize(config.sourceCategory),needle=normalize(label);
  return products.find(candidate=>{
    if(candidate.id===product.id||!candidate.active||normalize(candidate.category||"General")!==category)return false;
    let display=candidate.name.trim();
    if(category==="yogurts")display=display.replace(/^yogurt\s+/i,"").trim();
    return normalize(display)===needle||normalize(candidate.name)===needle;
  });
}

export function usesRecipeInventory(lines:InventorySelectionLine[],products:TenantProduct[]){
  const byId=new Map(products.map(product=>[product.id,product]));
  for(const line of lines){
    const product=byId.get(line.productId);if(!product)continue;
    if(hasRecipe(product))return true;
    for(const selection of line.optionSelections||[]){const choice=optionChoiceProduct(product,selection,products);if(choice&&hasRecipe(choice))return true}
  }
  return false;
}

export function resolveInventoryImpact(lines:InventorySelectionLine[],products:TenantProduct[]):InventoryImpact[]{
  const byId=new Map(products.map(product=>[product.id,product]));
  const impacts=new Map<string,InventoryImpact>();
  const addImpact=(product:TenantProduct,qty:number,source:string)=>{
    if(qty<=0)return;const current=impacts.get(product.id)||{productId:product.id,qty:0,sources:[]};current.qty+=qty;if(source&&!current.sources.includes(source))current.sources.push(source);impacts.set(product.id,current)
  };
  const consume=(product:TenantProduct,qty:number,source:string,path:Set<string>)=>{
    if(qty<=0)return;
    if(path.has(product.id))return;
    const recipe=productRecipe(product);
    if(recipe.length){
      const nextPath=new Set(path);nextPath.add(product.id);
      for(const component of recipe){const child=byId.get(component.productId);if(child)consume(child,qty*component.qty,source,nextPath)}
      return;
    }
    if(product.trackStock!==false)addImpact(product,qty,source);
  };
  for(const line of lines){
    const product=byId.get(line.productId),qty=cleanQty(line.qty);if(!product||!qty)continue;
    consume(product,qty,product.name,new Set());
    for(const selection of line.optionSelections||[]){const choice=optionChoiceProduct(product,selection,products);if(choice)consume(choice,qty,`${product.name} · ${selection}`,new Set())}
  }
  return [...impacts.values()].filter(item=>item.qty>0).sort((a,b)=>a.productId.localeCompare(b.productId));
}

export function formatStock(value:number,unit:string){
  const rounded=Math.abs(value-Math.round(value))<0.0005?String(Math.round(value)):value.toFixed(3).replace(/0+$/,"").replace(/\.$/,"");
  return `${rounded} ${unit}`;
}
