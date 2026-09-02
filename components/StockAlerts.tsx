"use client";

import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";
import { formatStock,inventoryOnly,lowStockThreshold,stockUnit } from "@/lib/recipe-inventory";
import { InventoryQuickRestock } from "./InventoryQuickRestock";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./StockAlerts.module.css";

export function StockAlerts(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  useEffect(()=>{const refresh=()=>setDb(loadLocalDatabase());refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  const data=useMemo(()=>{
    if(!db)return null;
    const ctx=getWorkspaceContext(db),tracked=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&product.active&&product.trackStock!==false),byId=new Map(tracked.map(product=>[product.id,product]));
    const rows=tracked.map(product=>({product,threshold:lowStockThreshold(product)}));
    const out=rows.filter(row=>row.product.stock<=0),low=rows.filter(row=>row.product.stock>0&&row.product.stock<=row.threshold),attention=[...out,...low].sort((a,b)=>a.product.stock-b.product.stock);
    const stockRows=[...rows].sort((a,b)=>{
      const aAttention=a.product.stock<=a.threshold?0:1,bAttention=b.product.stock<=b.threshold?0:1,aIngredient=inventoryOnly(a.product)?0:1,bIngredient=inventoryOnly(b.product)?0:1;
      return aAttention-bAttention||aIngredient-bIngredient||a.product.name.localeCompare(b.product.name,"es");
    }).slice(0,10);
    const today=new Date();today.setHours(0,0,0,0);const consumed=new Map<string,number>();
    for(const movement of db.stockMovements){if(movement.tenantId!==ctx.tenantId||movement.branchId!==ctx.branchId||movement.type!=="sale"||movement.quantity>=0||new Date(movement.createdAt)<today)continue;consumed.set(movement.productId,(consumed.get(movement.productId)||0)+Math.abs(movement.quantity))}
    const consumedRows=[...consumed.entries()].map(([productId,qty])=>({product:byId.get(productId),qty})).filter((row):row is {product:NonNullable<typeof row.product>;qty:number}=>Boolean(row.product)).sort((a,b)=>b.qty-a.qty).slice(0,8);
    return{tracked,out,low,attention,stockRows,consumedRows};
  },[db]);
  if(!db||!data||!data.tracked.length)return null;
  const attentionTotal=data.out.length+data.low.length;
  return <section className={styles.card} aria-label="Resumen de inventario">
    <div className={styles.head}><div className={styles.copy}><span>INVENTARIO · HOY</span><h3>Qué queda y qué se consumió</h3><p>Vista rápida para revisar el negocio sin entrar a configurar.</p></div><div className={styles.actions}><InventoryQuickRestock/><Link className={styles.action} href="/inventory">Ver completo →</Link></div></div>
    <div className={styles.summary}><span className={styles.pill}><b>{data.tracked.length}</b> controlados</span>{attentionTotal>0?<span className={`${styles.pill} ${styles.warning}`}><b>{attentionTotal}</b> por reponer</span>:<span className={`${styles.pill} ${styles.good}`}><b>✓</b> stock al día</span>}<span className={styles.pill}><b>{data.consumedRows.length}</b> con consumo hoy</span></div>
    <div className={styles.columns}>
      <article className={styles.section}><div className={styles.sectionHead}><div><span>EXISTENCIAS</span><strong>Lo que queda</strong></div><small>Actualizado con cada venta</small></div><div className={styles.list}>{data.stockRows.map(({product,threshold})=>{const out=product.stock<=0,low=!out&&product.stock<=threshold;return <div className={`${styles.row} ${out?styles.rowCritical:low?styles.rowWarning:""}`} key={product.id}><div><strong>{product.name}</strong><small>{inventoryOnly(product)?"Ingrediente":"Producto"}{out||low?` · mínimo ${formatStock(threshold,stockUnit(product))}`:""}</small></div><div className={styles.stockValue}><b>{out?"0":formatStock(product.stock,stockUnit(product))}</b><em>{out?"Agotado":low?"Reponer":"Bien"}</em></div></div>})}</div></article>
      <article className={styles.section}><div className={styles.sectionHead}><div><span>CONSUMO DE HOY</span><strong>Lo que salió por ventas</strong></div><small>Desde las 00:00</small></div>{data.consumedRows.length?<div className={styles.list}>{data.consumedRows.map(({product,qty})=><div className={styles.row} key={product.id}><div><strong>{product.name}</strong><small>Quedan {formatStock(product.stock,stockUnit(product))}</small></div><div className={styles.consumed}><b>−{formatStock(qty,stockUnit(product))}</b><em>hoy</em></div></div>)}</div>:<div className={styles.empty}>Todavía no hay consumo registrado hoy.</div>}</article>
    </div>
    {attentionTotal>0&&<div className={styles.restockBar}><div><span>PARA REPONER</span><strong>{data.attention.slice(0,5).map(({product})=>product.name).join(" · ")}{data.attention.length>5?` · +${data.attention.length-5}`:""}</strong></div><InventoryQuickRestock/></div>}
  </section>;
}
