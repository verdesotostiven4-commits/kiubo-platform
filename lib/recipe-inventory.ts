import type { TenantProduct } from "./local-store";
import { getProductOptionConfig,productOptionLabel } from "./product-options";
import { isIngredientProduct,isSellableProduct } from "./product-classification";

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
export function inventoryOnly(product:TenantProduct){return isIngredientProduct(product)}
export function stockUnit(product:TenantProduct){return String(asInventoryProduct(product).stockUnit||"u").trim()||"u"}
export function lowStockThreshold(product:TenantProduct){const value=Number(asInventoryProduct(product).lowStockThreshold);return Number.isFinite(value)&&value>=0?value:5}
export function hasRecipe(product:TenantProduct){return productRecipe(product).length>0}

export type RecipeReadiness="missing"|"partial"|"ready";
export function recipeReadiness(product:TenantProduct,products:TenantProduct[]):RecipeReadiness{
  const lines=productRecipe(product),config=getProductOptionConfig(product);
  if(!lines.length&&config?.source==="category"&&config.sourceCategory){
    const category=normalize(config.sourceCategory),choices=products.filter(candidate=>candidate.active&&candidate.id!==product.id&&normalize(candidate.category||"General")===category);
    if(!choices.length)return"missing";
    return choices.every(choice=>productRecipe(choice).length>0)?"ready":"partial";
  }
  if(!lines.length)return"missing";
  const byId=new Map(products.map(candidate=>[candidate.id,candidate]));
  return lines.every(line=>{const component=byId.get(line.productId);return Boolean(component&&component.active&&component.trackStock!==false)})?"ready":"partial";
}

function optionChoiceCandidates(product:TenantProduct,label:string,products:TenantProduct[]){
  const config=getProductOptionConfig(product);if(!config||config.source!=="category"||!config.sourceCategory)return[];
  const category=normalize(config.sourceCategory),needle=normalize(productOptionLabel({name:label},config));
  // Older saved orders may contain the former picker label "de Durazno".
  const legacyNeedle=category==="yogurts"?needle.replace(/^de\s+/,""):needle;
  return products.filter(candidate=>candidate.id!==product.id&&candidate.active&&isSellableProduct(candidate)&&
    candidate.tenantId===product.tenantId&&candidate.branchId===product.branchId&&
    normalize(candidate.category||"General")===category&&
    [needle,legacyNeedle].includes(normalize(productOptionLabel(candidate,config))));
}

function optionChoiceProduct(product:TenantProduct,label:string,products:TenantProduct[]){
  const candidates=optionChoiceCandidates(product,label,products);
  // A newly created duplicate without a recipe must not hide the configured flavor.
  const configured=candidates.filter(candidate=>hasRecipe(candidate)||candidate.trackStock!==false);
  const choices=configured.length?configured:candidates;
  const signatures=new Set(choices.map(candidate=>hasRecipe(candidate)?
    JSON.stringify(productRecipe(candidate).sort((a,b)=>a.productId.localeCompare(b.productId))):
    candidate.trackStock!==false?`stock:${candidate.id}`:"untracked"));
  // Different recipes behind one label need an explicit configuration decision.
  if(signatures.size>1)return undefined;
  return [...choices].sort((a,b)=>a.id.localeCompare(b.id))[0];
}

export function inventorySelectionError(lines:InventorySelectionLine[],products:TenantProduct[]):string|undefined{
  const byId=new Map(products.map(product=>[product.id,product]));
  for(const line of lines){
    const product=byId.get(line.productId);if(!product||!cleanQty(line.qty))continue;
    const config=getProductOptionConfig(product);
    if(!config&&!hasRecipe(product)&&product.trackStock===false&&isSellableProduct(product)){
      const usedAsRecipeChoice=products.some(parent=>{
        const parentConfig=getProductOptionConfig(parent);
        return parent.active&&parent.tenantId===product.tenantId&&parent.branchId===product.branchId&&hasRecipe(parent)&&
          parentConfig?.source==="category"&&normalize(parentConfig.sourceCategory||"")===normalize(product.category||"General");
      });
      if(usedAsRecipeChoice)return`Configura la receta de ${product.name} antes de registrar el pedido.`;
    }
    if(!config||config.source!=="category")continue;
    const selections=line.optionSelections||[];
    if(selections.length!==config.selectionCount)return`${product.name}: elige ${config.selectionCount} ${config.label.toLocaleLowerCase("es")} antes de registrar el pedido.`;
    const requiresInventory=hasRecipe(product)||products.some(candidate=>candidate.active&&
      candidate.tenantId===product.tenantId&&candidate.branchId===product.branchId&&
      normalize(candidate.category||"General")===normalize(config.sourceCategory||"")&&
      (hasRecipe(candidate)||candidate.trackStock!==false));
    for(const selection of selections){
      const choice=optionChoiceProduct(product,selection,products);
      if(!choice){
        if(optionChoiceCandidates(product,selection,products).length)return`${product.name}: ${selection} tiene varias recetas distintas. Revisa su configuración antes de registrar el pedido.`;
        return`${product.name}: la opción ${selection} ya no está disponible. Vuelve a elegirla.`;
      }
      if(requiresInventory&&!hasRecipe(choice)&&choice.trackStock===false)return`${product.name}: configura la receta de ${selection} antes de registrar el pedido.`;
    }
  }
  return undefined;
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
