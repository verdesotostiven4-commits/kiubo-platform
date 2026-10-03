"use client";

import { useEffect,useMemo,useState } from "react";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { saleVisibleAfterHistoryReset } from "@/lib/sale-adjustments";
import { saleLifecycle } from "@/lib/sale-reversal";
import { yukiFlavorImage } from "@/lib/yuki-flavor-visuals";
import { addBusinessDays,businessDateKey,businessTimeZone,businessTodayKey } from "@/lib/business-time";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./YukiFlavorAnalytics.module.css";

type Range="today"|"7d"|"30d"|"all";
const labels:Record<Range,string>={today:"Hoy","7d":"7 días","30d":"30 días",all:"Todo"};
const normalize=(value:string)=>value.replace(/\s+/g," ").trim();
function periodStart(range:Range,timeZone:string){const today=businessTodayKey(timeZone);return range==="all"?"":range==="today"?today:addBusinessDays(today,range==="7d"?-6:-29)}

function flavorsFromName(name:string){
  const values:string[]=[],matcher=/Yogur(?:t)?(?:\s+\d+\s*:)?\s*([^·/×]+?)(?:\s*×\s*(\d+))?(?=\s*·|\s*\/|\s*$)/gi;let match:RegExpExecArray|null;
  while((match=matcher.exec(name))){const flavor=normalize(match[1]||""),count=Math.max(1,Number(match[2])||1);for(let index=0;index<count;index++)values.push(flavor)}
  return values.filter(value=>value&&!/^sin especificar$/i.test(value));
}

export function YukiFlavorAnalytics(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[range,setRange]=useState<Range>("30d");
  useEffect(()=>{const refresh=()=>setDb(loadLocalDatabase());refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);

  const data=useMemo(()=>{
    if(!db)return null;
    const ctx=getWorkspaceContext(db);if(ctx.tenant?.name.trim().toUpperCase()!=="YUKI")return null;
    const settings=getTenantSettings(db,ctx.tenantId),timeZone=businessTimeZone(settings.timeZone),start=periodStart(range,timeZone),counts=new Map<string,{name:string;qty:number}>();let selections=0,salesWithFlavor=0;
    for(const sale of db.sales){
      if(sale.tenantId!==ctx.tenantId||sale.branchId!==ctx.branchId||saleLifecycle(sale)!=="completed"||!saleVisibleAfterHistoryReset(sale,settings)||(start&&businessDateKey(sale.createdAt,timeZone)<start))continue;
      let hasFlavor=false;
      for(const item of sale.items){
        const stored=item.optionSelections?.map(normalize).filter(Boolean)||[],parsed=stored.length?stored:flavorsFromName(item.name),flavors=stored.length?Array.from({length:Math.max(1,Number(item.qty)||1)},()=>parsed).flat():!item.optionLabel&&item.productId.startsWith("yuki-menu-yogurt-")&&item.qty>1?Array.from({length:item.qty},()=>parsed).flat():parsed;
        if(!flavors.length)continue;
        hasFlavor=true;
        for(const flavor of flavors){const key=flavor.toLocaleLowerCase("es"),row=counts.get(key)||{name:flavor,qty:0};row.qty+=1;counts.set(key,row);selections+=1}
      }
      if(hasFlavor)salesWithFlavor++;
    }
    const ranking=[...counts.values()].sort((a,b)=>b.qty-a.qty||a.name.localeCompare(b.name,"es"));
    return{ranking,selections,salesWithFlavor};
  },[db,range]);

  if(!data)return null;
  const max=Math.max(1,data.ranking[0]?.qty||1),favorite=data.ranking[0],favoriteImage=favorite?yukiFlavorImage(favorite.name):undefined;
  return <section className={styles.card} aria-label="Sabores de yogurt más vendidos">
    <header className={styles.header}><div><span>YOGURT · DEMANDA REAL</span><h2>Sabores más pedidos</h2><p>Calculado únicamente con ventas registradas; no usa datos inventados.</p></div><div className={styles.range}>{(Object.keys(labels) as Range[]).map(key=><button key={key} className={range===key?styles.active:""} onClick={()=>setRange(key)}>{labels[key]}</button>)}</div></header>
    {data.ranking.length?<div className={styles.body}><div className={`${styles.hero} ${favoriteImage?styles.heroWithImage:""}`}>{favoriteImage&&<img className={styles.heroImage} src={favoriteImage} alt={`Yogurt ${favorite.name}`}/>}<span>Favorito del período</span><strong>{favorite.name}</strong><small>{favorite.qty} selecciones</small></div><div className={styles.list}>{data.ranking.slice(0,6).map((item,index)=><div className={styles.row} key={item.name}><b>{index+1}</b><div><div className={styles.rowHead}><strong>{item.name}</strong><span>{item.qty}</span></div><div className={styles.track}><i style={{width:`${Math.max(8,item.qty/max*100)}%`}}/></div></div></div>)}</div><div className={styles.summary}><span><b>{data.selections}</b> sabores seleccionados</span><span><b>{data.salesWithFlavor}</b> ventas con yogurt</span></div></div>:<div className={styles.empty}><strong>Aún no hay datos de sabores en este período.</strong><span>Cuando se registren ventas con yogurt, KIUBO mostrará aquí el ranking real.</span></div>}
  </section>;
}
