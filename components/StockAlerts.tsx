"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { formatStock,inventoryOnly,lowStockThreshold,stockUnit } from "@/lib/recipe-inventory";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./StockAlerts.module.css";

export function StockAlerts(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  useEffect(()=>{const refresh=()=>setDb(loadLocalDatabase());refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  const data=useMemo(()=>{
    if(!db)return null;
    const ctx=getWorkspaceContext(db),tracked=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&product.active&&product.trackStock!==false);
    const rows=tracked.map(product=>({product,threshold:lowStockThreshold(product)}));
    const out=rows.filter(row=>row.product.stock<=0),low=rows.filter(row=>row.product.stock>0&&row.product.stock<=row.threshold);
    const attention=[...out,...low].sort((a,b)=>a.product.stock-b.product.stock).slice(0,6);
    return{out,low,attention};
  },[db]);
  if(!db||!data)return null;
  const total=data.out.length+data.low.length;
  return <section className={styles.card} aria-label="Alertas de stock">
    <div className={styles.head}><div className={styles.copy}><span>INVENTARIO · ATENCIÓN</span><h3>{total?"Stock que necesita atención":"Inventario al día"}</h3><p>{total?"KIUBO usa el mínimo configurado de cada producto o ingrediente.":"No hay productos controlados por debajo de su mínimo."}</p></div><Link className={styles.action} href="/inventory">Abrir inventario →</Link></div>
    {total?<><div className={styles.summary}>{data.out.length>0&&<span className={`${styles.pill} ${styles.critical}`}><b>{data.out.length}</b> sin stock</span>}{data.low.length>0&&<span className={`${styles.pill} ${styles.warning}`}><b>{data.low.length}</b> con stock bajo</span>}</div><div className={styles.list}>{data.attention.map(({product,threshold})=><div className={styles.row} key={product.id}><div><strong>{product.name}</strong><small>{inventoryOnly(product)?"Ingrediente":"Producto"} · mínimo {formatStock(threshold,stockUnit(product))}</small></div><b>{product.stock<=0?"SIN STOCK":formatStock(product.stock,stockUnit(product))}</b></div>)}</div></>:<div className={styles.ok}><b>✓</b><span>Todo lo controlado está por encima de su nivel mínimo.</span></div>}
  </section>;
}
