"use client";

import Link from "next/link";
import { FormEvent,useEffect,useMemo,useState } from "react";
import { StockMovementRecord,getWorkspaceContext,loadLocalDatabase,makeId,saveLocalDatabase } from "@/lib/local-store";
import { enqueueInventoryAdjustment } from "@/lib/inventory-transaction";
import { formatStock,lowStockThreshold,stockUnit } from "@/lib/recipe-inventory";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./InventoryQuickRestock.module.css";

const displayQty=(value:number)=>Math.abs(value-Math.round(value))<.0005?String(Math.round(value)):value.toFixed(3).replace(/0+$/,"").replace(/\.$/,"");

export function InventoryQuickRestock({floating=false}:{floating?:boolean}){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null);
  const[open,setOpen]=useState(false);
  const[selectedId,setSelectedId]=useState("");
  const[qty,setQty]=useState("");
  const[message,setMessage]=useState("");

  useEffect(()=>{const refresh=()=>setDb(loadLocalDatabase());refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  const data=useMemo(()=>{
    if(!db)return null;
    const ctx=getWorkspaceContext(db),tracked=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&product.active&&product.trackStock!==false).sort((a,b)=>{
      const aLow=a.stock<=lowStockThreshold(a)?0:1,bLow=b.stock<=lowStockThreshold(b)?0:1;
      return aLow-bLow||a.name.localeCompare(b.name,"es");
    });
    const selected=tracked.find(product=>product.id===selectedId)||tracked[0];
    return{ctx,tracked,selected,isYuki:ctx.tenant?.name.trim().toUpperCase()==="YUKI"};
  },[db,selectedId]);

  if(!db||!data||!data.tracked.length)return null;
  const selected=data.selected,parsedQty=Number(qty||0),validQty=Number.isFinite(parsedQty)&&parsedQty>0&&(!data.isYuki||Number.isInteger(parsedQty)),nextStock=selected?Number((selected.stock+(validQty?parsedQty:0)).toFixed(4)):0;

  const submit=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(!selected||!validQty){setMessage(data.isYuki?"Usa una cantidad completa: 1, 2, 3…":"Escribe una cantidad válida");return}
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),product=next.tenantProducts.find(item=>item.id===selected.id&&item.tenantId===workspace.tenantId&&item.branchId===workspace.branchId&&item.active&&item.trackStock!==false);
    if(!product){setMessage("Producto no disponible");return}
    const now=new Date().toISOString(),productBefore={...product},newStock=Number((product.stock+parsedQty).toFixed(4));product.stock=newStock;const productAfter={...product},movementId=makeId("stock");
    const movement:StockMovementRecord={id:movementId,tenantId:workspace.tenantId,branchId:workspace.branchId,productId:product.id,type:"adjustment_in",quantity:parsedQty,previousStock:productBefore.stock,newStock,reference:"Reposición",clientOperationId:movementId,createdAt:now};
    next.stockMovements.unshift(movement);enqueueInventoryAdjustment(next,{productId:product.id,delta:parsedQty,reason:"Reposición",movementId,createdAt:now,productBefore,productAfter,movement});saveLocalDatabase(next,{trackChanges:false});
    setDb(loadLocalDatabase());setQty("");setMessage(`${product.name}: ${formatStock(newStock,stockUnit(product))}`);window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"quick-restock"}}));
  };

  return <>
    <button type="button" className={`${styles.trigger} ${floating?styles.floating:""}`} onClick={()=>{setOpen(true);setSelectedId(selected?.id||"");setMessage("")}}>＋ Reponer stock</button>
    {open&&<div className={styles.backdrop} role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)setOpen(false)}}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Reponer stock">
        <div className={styles.head}><div><span>INVENTARIO</span><h3>Reponer stock</h3></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">×</button></div>
        <form onSubmit={submit} className={styles.form}>
          <label><span>Existencia / insumo</span><select value={selected?.id||""} onChange={e=>{setSelectedId(e.target.value);setMessage("")}}>{data.tracked.map(product=><option key={product.id} value={product.id}>{product.name} · {formatStock(product.stock,stockUnit(product))}</option>)}</select></label>
          <label><span>Cantidad que llegó</span><input autoFocus name="qty" type="number" min={data.isYuki?"1":"0.001"} step={data.isYuki?"1":"0.001"} value={qty} onChange={e=>{setQty(e.target.value);setMessage("")}} placeholder="Ej. 10" required/></label>
          {selected&&<div className={styles.preview}><span>Ahora</span><b>{formatStock(selected.stock,stockUnit(selected))}</b><i>→</i><span>Quedará</span><strong>{formatStock(nextStock,stockUnit(selected))}</strong></div>}
          <button className={styles.save} type="submit" disabled={!validQty}>＋ Sumar al stock</button>
          {message&&<div className={styles.message}>{message}</div>}
        </form>
        <div className={styles.foot}><Link href="/purchases" onClick={()=>setOpen(false)}>Registrar compra con proveedor/costo →</Link></div>
      </section>
    </div>}
  </>;
}
