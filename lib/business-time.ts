export const DEFAULT_BUSINESS_TIME_ZONE="America/Guayaquil";
export const GALAPAGOS_TIME_ZONE="Pacific/Galapagos";

export function businessTimeZone(value?:string){
  const candidate=String(value||DEFAULT_BUSINESS_TIME_ZONE).trim();
  try{new Intl.DateTimeFormat("en-US",{timeZone:candidate}).format(new Date(0));return candidate}catch{return DEFAULT_BUSINESS_TIME_ZONE}
}

function dateParts(value:Date|string,timeZone:string){
  const date=value instanceof Date?value:new Date(value),parts=new Intl.DateTimeFormat("en-US",{timeZone:businessTimeZone(timeZone),year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date),part=(type:string)=>parts.find(item=>item.type===type)?.value||"";
  return{year:part("year"),month:part("month"),day:part("day")};
}

export function businessDateKey(value:Date|string,timeZone:string){const parts=dateParts(value,timeZone);return`${parts.year}-${parts.month}-${parts.day}`}
export function businessTodayKey(timeZone:string){return businessDateKey(new Date(),timeZone)}
export function businessMonthKey(value:Date|string,timeZone:string){return businessDateKey(value,timeZone).slice(0,7)}
export function addBusinessDays(dateKey:string,days:number){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);if(!match)return dateKey;
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])+days,12));return date.toISOString().slice(0,10);
}
export function businessHour(value:Date|string,timeZone:string){
  const date=value instanceof Date?value:new Date(value),hour=new Intl.DateTimeFormat("en-US",{timeZone:businessTimeZone(timeZone),hour:"2-digit",hourCycle:"h23"}).formatToParts(date).find(item=>item.type==="hour")?.value;
  return Number(hour||0);
}
export function businessDateLabel(value:Date|string,timeZone:string,options:Intl.DateTimeFormatOptions){return new Intl.DateTimeFormat("es-EC",{...options,timeZone:businessTimeZone(timeZone)}).format(value instanceof Date?value:new Date(value))}
export function businessTimeLabel(value:Date|string,timeZone:string,options:Intl.DateTimeFormatOptions={hour:"2-digit",minute:"2-digit"}){return businessDateLabel(value,timeZone,options)}
