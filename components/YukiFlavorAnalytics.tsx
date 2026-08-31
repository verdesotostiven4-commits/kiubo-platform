"use client";

import { useEffect,useMemo,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { saleLifecycle } from "@/lib/sale-reversal";
import { yukiFlavorImage } from "@/lib/yuki-flavor-visuals";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./YukiFlavorAnalytics.module.css";

type Range="today"|"7d"|"30d"|"all";
const labels:Record<Range,string>={today:"Hoy","7d":"7 días","30d":"30 días",all:"Todo"};
const normalize=(value:string)=>value.replace(/\s+/g," ").trim();
const startOfDay=()=>{const date=new Date();date.setHours(0,0,0,0);return date.getTime()};

function periodStart(range:Range){
  if(range==="all")return 0;
  const today=startOfDay();
  if(range==="today")return today;
  return today-(range==="7d"?6:29)*86400000;
}

function flavorsFromName(name:string){
  const values:string[]=[];
  const slots=/Yogur(?:t)?\s+\d+\s*:\s*([^·/×]+?)(?=\s*·|\s*\/|\s*×|\s*$)/gi;
  let match:RegExpExecArray|null;
  while((match=slots.exec(name)))values.push(normalize(match[1]||""));
  if(values.length)return values.filter(Boolean);
  const simple=/Yogur(?:t)?\s+(?!\d+\s*:)([^·/×]+?)(?=\s*·|\s*\/|\s*×|\s*$)/gi;
  while((match=simple.exec(name)))values.push(normalize(match[1]||""));
  return values.filter(value=>value&&!/^sin especificar$/i.test(value));
}

export function YukiFlavorAnalytics(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[range,setRange]=useState<Range>("30d");
  useEffect(()=>{const refresh=()=>setDb(loadLocalDatabase());refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);

  const data=useMemo(()=>{
    if(!db)return null;
    const ctx=getWorkspaceContext(db);if(ctx.tenant?.name.trim().toUpperCase()!=="YUKI")return null;
    const start=periodStart(range),counts=new Map<string,{name:string;qty:number}>();let selections=0,salesWithFlavor=0;
    for(const sale of db.sales){
      if(sale.tenantId!==ctx.tenantId||sale.branchId!==ctx.branchId||saleLifecycle(sale)!=="completed"||Date.parse(sale.createdAt)<start)continue;
      let hasFlavor=false;
      for(const item of sale.items){
        const flavors=flavorsFromName(item.name);
        if(!flavors.length)continue;
        hasFlavor=true;
        for(const flavor of flavors){const key=flavor.toLocaleLowerCase("es");const row=counts.get(key)||{name:flavor,qty:0};row.qty+=Math.max(1,Number(item.qty)||1);counts.set(key,row);selections+=Math.max(1,Number(item.qty)||1)}
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
