import type { ProductKind,TenantProduct } from "./local-store";

const normalized=(value:unknown)=>String(value??"").trim().toLocaleLowerCase("es");

export function productKind(product:TenantProduct):ProductKind{
  if(product.productKind==="ingredient"||product.inventoryOnly===true)return"ingredient";
  if(product.productKind==="charge"||normalized(product.category)==="cargos")return"charge";
  if(product.productKind==="option")return"option";
  return"sellable";
}

export function isIngredientProduct(product:TenantProduct){return productKind(product)==="ingredient"}
export function isChargeProduct(product:TenantProduct){return productKind(product)==="charge"}
export function isSellableProduct(product:TenantProduct){return productKind(product)==="sellable"}
export function isMenuFeatured(product:TenantProduct){return isSellableProduct(product)&&product.menuFeatured===true}
