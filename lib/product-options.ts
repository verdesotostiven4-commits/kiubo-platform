import type { TenantProduct } from "./local-store";

export type ProductOptionSource="category"|"custom";
export type ProductOptionConfig={
  label:string;
  selectionCount:number;
  source:ProductOptionSource;
  sourceCategory?:string;
  options?:string[];
  allowRepeat?:boolean;
};
export type ProductOptionChoice={label:string;imageUrl?:string};
type ConfigurableProduct=TenantProduct&{optionConfig?:ProductOptionConfig};

const clean=(value:unknown,max=120)=>String(value??"").replace(/[\r\n\t]+/g," ").replace(/\s{2,}/g," ").trim().slice(0,max);
const unique=(values:string[])=>{const seen=new Set<string>();return values.filter(value=>{const key=value.toLocaleLowerCase("es");if(!value||seen.has(key))return false;seen.add(key);return true})};

export function sanitizeProductOptionConfig(value:unknown):ProductOptionConfig|undefined{
  if(!value||typeof value!=="object")return undefined;
  const raw=value as Partial<ProductOptionConfig>,label=clean(raw.label,60)||"Opción",selectionCount=Math.max(1,Math.min(8,Math.floor(Number(raw.selectionCount)||1))),source:ProductOptionSource=raw.source==="custom"?"custom":"category",allowRepeat=raw.allowRepeat!==false;
  if(source==="category"){
    const sourceCategory=clean(raw.sourceCategory,80);if(!sourceCategory)return undefined;
    return{label,selectionCount,source,sourceCategory,allowRepeat};
  }
  const options=unique((Array.isArray(raw.options)?raw.options:[]).map(item=>clean(item,80)).filter(Boolean));
  if(!options.length)return undefined;
  return{label,selectionCount,source,options,allowRepeat};
}

export function getProductOptionConfig(product:TenantProduct):ProductOptionConfig|undefined{
  return sanitizeProductOptionConfig((product as ConfigurableProduct).optionConfig);
}

function displayName(product:TenantProduct,config:ProductOptionConfig){
  const name=clean(product.name,160);
  if((config.sourceCategory||"").toLocaleLowerCase("es")==="yogurts")return name.replace(/^yogurt\s+/i,"").trim()||name;
  const label=config.label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return name.replace(new RegExp(`^${label}\\s+`,"i"),"").trim()||name;
}

export function getProductOptionChoices(config:ProductOptionConfig,products:TenantProduct[],currentProductId?:string):ProductOptionChoice[]{
  if(config.source==="custom")return unique((config.options||[]).map(item=>clean(item,80)).filter(Boolean)).map(label=>({label}));
  const wanted=(config.sourceCategory||"").toLocaleLowerCase("es");
  const seen=new Set<string>(),choices:ProductOptionChoice[]=[];
  for(const product of products){
    if(product.id===currentProductId||!product.active||(product.category||"General").toLocaleLowerCase("es")!==wanted)continue;
    const label=displayName(product,config),key=label.toLocaleLowerCase("es");if(!label||seen.has(key))continue;seen.add(key);choices.push({label,imageUrl:product.imageUrl});
  }
  return choices.sort((a,b)=>a.label.localeCompare(b.label,"es"));
}

export function formatProductOptionSelection(config:ProductOptionConfig,selections:string[]){
  const cleanSelections=selections.map(value=>clean(value,80)).filter(Boolean);
  if(cleanSelections.length<=1)return cleanSelections.length?`${config.label} ${cleanSelections[0]}`:"";
  return cleanSelections.map((value,index)=>`${config.label} ${index+1}: ${value}`).join(" · ");
}

export function parseProductOptionSelection(config:ProductOptionConfig|undefined,value:unknown){
  if(!config)return[];
  const text=clean(value,500);if(!text)return[];
  if(config.selectionCount<=1){
    const prefix=new RegExp(`^${config.label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s+`,"i");
    const selection=clean(text.replace(prefix,""),80);return selection?[selection]:[];
  }
  const label=config.label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),matcher=new RegExp(`${label}\\s+\\d+\\s*:\\s*([^·/]+)`,"gi"),result:string[]=[];let match:RegExpExecArray|null;
  while((match=matcher.exec(text))!==null){const selection=clean(match[1],80);if(selection)result.push(selection)}
  return result.slice(0,Math.max(1,config.selectionCount));
}
