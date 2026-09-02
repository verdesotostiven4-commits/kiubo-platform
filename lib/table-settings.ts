import type { TenantSettings } from "./local-store";

export type TableAwareSettings=TenantSettings&{tableLabels?:string[];tableSetupVersion?:number};

const normalize=(value:unknown)=>String(value??"").trim().replace(/^mesa\s+/i,"").replace(/[^0-9]/g,"").slice(0,3);

export function tableLabelsFromSettings(settings:TenantSettings){
  const configured=(settings as TableAwareSettings).tableLabels;
  if(Array.isArray(configured)){
    const labels=[...new Set(configured.map(normalize).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
    if(labels.length)return labels;
  }
  return Array.from({length:Math.max(0,settings.tableCount||0)},(_,index)=>String(index+1));
}

export function normalizeTableLabel(value:unknown){return normalize(value)}

export function withTableLabels(settings:TenantSettings,labels:string[],extra:Partial<TableAwareSettings>={}){
  const normalized=[...new Set(labels.map(normalize).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  return {...settings,...extra,tableLabels:normalized,tableCount:normalized.length} as TableAwareSettings;
}
