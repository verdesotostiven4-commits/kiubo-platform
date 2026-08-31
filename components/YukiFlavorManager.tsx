"use client";

import { FormEvent,useEffect,useState } from "react";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase,makeId,saveLocalDatabase,type TenantProduct } from "@/lib/local-store";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";
import styles from "./YukiFlavorManager.module.css";

const VIRTUAL_STOCK=1_000_000;
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("es");
const clean=(value:string)=>value.replace(/[\r\n\t]+/g," ").replace(/\s{2,}/g," ").trim();
const slug=(value:string)=>normalize(value).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,28)||Date.now().toString(36);

export function YukiFlavorManager(){
  const[db,setDb]=useState<ReturnType<typeof loadLocalDatabase>|null>(null),[message,setMessage]=useState("");
  useEffect(()=>{const refresh=()=>setDb(loadLocalDatabase());refresh();window.addEventListener(KIUBO_DATA_REFRESHED,refresh);return()=>window.removeEventListener(KIUBO_DATA_REFRESHED,refresh)},[]);
  if(!db)return null;
  const ctx=getWorkspaceContext(db),settings=getTenantSettings(db,ctx.tenantId);
  if(ctx.tenant?.name.trim().toUpperCase()!=="YUKI"||settings.businessType!=="food_service"||!ctx.branchId)return null;
  const all=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&normalize(product.category||"")==="yogurts");
  const active=all.filter(product=>product.active).sort((a,b)=>a.name.localeCompare(b.name,"es"));
  const flavorName=(product:TenantProduct)=>product.name.replace(/^yogurt\s+/i,"").trim();
  const defaultPrice=active.length?active.reduce((sum,product)=>sum+product.price,0)/active.length:4.5;
  const persist=(next:ReturnType<typeof loadLocalDatabase>,text:string)=>{saveLocalDatabase(next);setDb(loadLocalDatabase());setMessage(text);window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"yuki-flavors"}}))};
  const addFlavor=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=event.currentTarget,data=new FormData(form),name=clean(String(data.get("flavor")||""));if(!name)return;
    const next=loadLocalDatabase(),workspace=getWorkspaceContext(next),existing=next.tenantProducts.find(product=>product.tenantId===workspace.tenantId&&product.branchId===workspace.branchId&&normalize(product.category||"")==="yogurts"&&normalize(product.name.replace(/^yogurt\s+/i,""))===normalize(name));
    if(existing){existing.active=true;persist(next,`${name} volvió a estar disponible.`);form.reset();return}
    const key=slug(name),product:TenantProduct={id:makeId("tp"),tenantId:workspace.tenantId,branchId:workspace.branchId,masterProductId:`custom-yuki-yogurt-${key}`,barcode:`YUKI-YOG-${key.replace(/-/g,"").toUpperCase().slice(0,20)}`,name:`Yogurt ${name}`,price:Number(defaultPrice.toFixed(2)),cost:0,stock:VIRTUAL_STOCK,active:true,category:"Yogurts",trackStock:false};
    next.tenantProducts.push(product);persist(next,`${name} agregado al menú y a los combos.`);form.reset();
  };
  const removeFlavor=(product:TenantProduct)=>{const next=loadLocalDatabase(),target=next.tenantProducts.find(item=>item.id===product.id&&item.tenantId===ctx.tenantId&&item.branchId===ctx.branchId);if(!target)return;target.active=false;persist(next,`${flavorName(product)} retirado de nuevas ventas. El historial se conserva.`)};
  return <section className={styles.shell}>
    <div className={styles.head}><div className={styles.copy}><span className={styles.eyebrow}>MENÚ DE YUKI</span><h3 className={styles.title}>Sabores disponibles</h3><p className={styles.subtitle}>Los cambios se reflejan automáticamente en yogures y combos.</p></div><span className={styles.count}>{active.length} activos</span></div>
    <div className={styles.body}><div className={styles.list}>{active.map(product=><div className={styles.chip} key={product.id}><i className={styles.chipDot}/><strong>{flavorName(product)}</strong><button type="button" onClick={()=>removeFlavor(product)} aria-label={`Quitar ${flavorName(product)}`}>×</button></div>)}</div><form className={styles.form} onSubmit={addFlavor}><input name="flavor" placeholder="Agregar sabor" maxLength={60} required/><button className="button secondary" type="submit">＋ Agregar</button></form></div>
    <div className={styles.foot}><span className={styles.note}>Las fotos de producto del POS se administran por separado. La imagen visual del selector de sabores es independiente.</span>{message&&<span className={styles.message}>✓ {message}</span>}</div>
  </section>;
}