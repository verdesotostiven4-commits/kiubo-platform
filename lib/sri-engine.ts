export type SriEnvironment="test"|"production";
export type SriTaxKind="vat"|"no_object"|"exempt";
export type SriTaxProfile={kind:SriTaxKind;rate:number;percentageCode:string;label:string};
export type SriBuyerIdentity={code:string;identification:string;name?:string};

export const SRI_TECHNICAL_BASELINE="2.33" as const;
export const SRI_INVOICE_XSD_VERSION="2.1.0" as const;
export const SRI_TAX_OPTIONS:SriTaxProfile[]=[
  {kind:"vat",rate:15,percentageCode:"4",label:"IVA 15%"},
  {kind:"vat",rate:5,percentageCode:"5",label:"IVA 5%"},
  {kind:"vat",rate:0,percentageCode:"0",label:"IVA 0%"},
  {kind:"no_object",rate:0,percentageCode:"6",label:"No objeto de IVA"},
  {kind:"exempt",rate:0,percentageCode:"7",label:"Exento de IVA"}
];

export function digits(value:string,length:number,label:string){const clean=value.replace(/\D/g,"");if(clean.length!==length)throw new Error(`${label} debe tener ${length} dígitos`);return clean}
export function padSequential(value:number){if(!Number.isInteger(value)||value<1||value>999999999)throw new Error("Secuencial fuera de rango");return String(value).padStart(9,"0")}
export function toSriDate(isoDate:string){const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);if(!match)throw new Error("Fecha de emisión inválida");return`${match[3]}${match[2]}${match[1]}`}
export function modulo11(base:string){if(!/^\d+$/.test(base))throw new Error("Módulo 11 requiere solo dígitos");let sum=0,factor=2;for(let i=base.length-1;i>=0;i--){sum+=Number(base[i])*factor;factor=factor===7?2:factor+1}const result=11-(sum%11);return result===11?0:result===10?1:result}
export function numericCodeFromSeed(seed:string){let hash=2166136261;for(let i=0;i<seed.length;i++){hash^=seed.charCodeAt(i);hash=Math.imul(hash,16777619)}return String(hash>>>0).slice(-8).padStart(8,"0")}
export function buildInvoiceAccessKey(input:{issueDate:string;ruc:string;environment:SriEnvironment;establishment:string;emissionPoint:string;sequential:number;numericCode:string;}){const date=toSriDate(input.issueDate),ruc=digits(input.ruc,13,"RUC"),environment=input.environment==="production"?"2":"1",estab=digits(input.establishment,3,"Establecimiento"),point=digits(input.emissionPoint,3,"Punto de emisión"),sequential=padSequential(input.sequential),numeric=digits(input.numericCode,8,"Código numérico"),emissionType="1",base=`${date}01${ruc}${environment}${estab}${point}${sequential}${numeric}${emissionType}`;if(base.length!==48)throw new Error("La base de clave de acceso debe tener 48 dígitos");return`${base}${modulo11(base)}`}
export function buyerIdType(identification?:string):SriBuyerIdentity{const value=(identification||"").trim();if(!value)return{code:"07",identification:"9999999999999",name:"CONSUMIDOR FINAL"};if(/^\d{13}$/.test(value))return{code:"04",identification:value};if(/^\d{10}$/.test(value))return{code:"05",identification:value};return{code:"06",identification:value}}
export function round2(value:number){return Math.round((value+Number.EPSILON)*100)/100}
export function taxTotalsFromGross(lines:Array<{gross:number;profile:SriTaxProfile}>){const groups=new Map<string,{profile:SriTaxProfile;gross:number}>();for(const line of lines){const key=`${line.profile.kind}:${line.profile.percentageCode}:${line.profile.rate}`,current=groups.get(key)??{profile:line.profile,gross:0};current.gross=round2(current.gross+line.gross);groups.set(key,current)}return[...groups.values()].map(group=>{const taxable=group.profile.kind==="vat"&&group.profile.rate>0,base=taxable?round2(group.gross/(1+group.profile.rate/100)):group.gross,tax=taxable?round2(group.gross-base):0;return{...group,base,tax}})}
export function runSriEngineSelfCheck(){const vector=modulo11("41261533")===6;const known="2103201601176001321000110010010000000061234567816";return vector&&known.length===49&&modulo11(known.slice(0,-1))===Number(known.at(-1))}
