export type OperationalLineMode="sale"|"courtesy"|"internal";

export type OperationalItemMeta={
  displayName:string;
  mode:OperationalLineMode;
  discountPercent:number;
};

const COURTESY_SUFFIX=" · Cortesía";
const INTERNAL_SUFFIX=" · Consumo interno";
const DISCOUNT_RE=/ · Desc\. ([0-9]+(?:\.[0-9]+)?)%$/i;

export const roundMoney=(value:number)=>Math.round((Number(value)||0)*100)/100;
export const clampDiscount=(value:number)=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));

export function effectiveUnitPrice(basePrice:number,mode:OperationalLineMode,discountPercent=0){
  if(mode==="courtesy"||mode==="internal")return 0;
  const discount=clampDiscount(discountPercent);
  return Number((Math.max(0,basePrice)*(1-discount/100)).toFixed(4));
}

export function encodeOperationalItemName(baseName:string,mode:OperationalLineMode,discountPercent=0){
  const clean=String(baseName||"Producto").replace(/\s+/g," ").trim();
  if(mode==="courtesy")return`${clean}${COURTESY_SUFFIX}`;
  if(mode==="internal")return`${clean}${INTERNAL_SUFFIX}`;
  const discount=clampDiscount(discountPercent);
  return discount>0?`${clean} · Desc. ${Number(discount.toFixed(2))}%`:clean;
}

export function parseOperationalItemName(name:string):OperationalItemMeta{
  const clean=String(name||"Producto").trim();
  if(clean.toLocaleLowerCase("es").endsWith(COURTESY_SUFFIX.toLocaleLowerCase("es")))return{displayName:clean.slice(0,-COURTESY_SUFFIX.length),mode:"courtesy",discountPercent:0};
  if(clean.toLocaleLowerCase("es").endsWith(INTERNAL_SUFFIX.toLocaleLowerCase("es")))return{displayName:clean.slice(0,-INTERNAL_SUFFIX.length),mode:"internal",discountPercent:0};
  const discount=clean.match(DISCOUNT_RE);if(discount){const percent=clampDiscount(Number(discount[1]));return{displayName:clean.slice(0,discount.index),mode:"sale",discountPercent:percent}}
  return{displayName:clean,mode:"sale",discountPercent:0};
}

export function operationalDiscountAmount(unitPrice:number,qty:number,percent:number){
  const discount=clampDiscount(percent);if(discount<=0||discount>=100)return 0;
  const net=Math.max(0,unitPrice)*Math.max(0,qty),base=net/(1-discount/100);
  return roundMoney(Math.max(0,base-net));
}

type SalesHistoryResetSettings={salesHistoryResetAtByBranch?:Record<string,string>};

export function historyResetAtForBranch(settings:unknown,branchId:string){
  const reset=(settings as SalesHistoryResetSettings|undefined)?.salesHistoryResetAtByBranch?.[branchId]||"";
  const parsed=Date.parse(reset);
  return Number.isFinite(parsed)?parsed:0;
}

export function saleVisibleAfterHistoryReset(sale:{branchId:string;createdAt:string},settings:unknown){
  const cutoff=historyResetAtForBranch(settings,sale.branchId),created=Date.parse(sale.createdAt);
  return !cutoff||!Number.isFinite(created)||created>=cutoff;
}

export function orderVisibleAfterHistoryReset(order:{branchId:string;createdAt:string;updatedAt?:string},settings:unknown){
  const cutoff=historyResetAtForBranch(settings,order.branchId),created=Date.parse(order.createdAt||order.updatedAt||"");
  return !cutoff||!Number.isFinite(created)||created>=cutoff;
}

export function historyRecordVisibleAfterReset(record:{branchId:string;createdAt?:string;openedAt?:string},settings:unknown){
  const cutoff=historyResetAtForBranch(settings,record.branchId),created=Date.parse(record.createdAt||record.openedAt||"");
  return !cutoff||!Number.isFinite(created)||created>=cutoff;
}
