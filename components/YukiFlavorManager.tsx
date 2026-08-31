"use client";

import { FormEvent,useEffect,useState } from "react";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase,makeId,saveLocalDatabase,type TenantProduct } from "@/lib/local-store";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";

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
    if(existing){existing.active=true;persist(next,`${name} quedó disponible otra vez.`);form.reset();return}
    const key=slug(name),product:TenantProduct={id:makeId("tp"),tenantId:workspace.tenantId,branchId:workspace.branchId,masterProductId:`custom-yuki-yogurt-${key}`,barcode:`YUKI-YOG-${key.replace(/-/g,"").toUpperCase().slice(0,20)}`,name:`Yogurt ${name}`,price:Number(defaultPrice.toFixed(2)),cost:0,stock:VIRTUAL_STOCK,active:true,category:"Yogurts",trackStock:false};
    next.tenantProducts.push(product);persist(next,`${name} agregado. Ya aparece en yogures y combos.`);form.reset();
  };
  const removeFlavor=(product:TenantProduct)=>{const next=loadLocalDatabase(),target=next.tenantProducts.find(item=>item.id===product.id&&item.tenantId===ctx.tenantId&&item.branchId===ctx.branchId);if(!target)return;target.active=false;persist(next,`${flavorName(product)} dejó de aparecer para nuevas ventas. El historial se conserva.`)};
  return <section className="panel flavor-manager"><div className="panel-head"><div><span className="eyebrow">MENÚ · SABORES</span><h3>Sabores de yogurt</h3></div><span className="pill">{active.length} activos</span></div><p>Agrega o retira sabores sin tocar los combos. Los selectores se acomodan automáticamente y las ventas anteriores no cambian.</p><div className="flavor-manager-list">{active.map(product=><div className="flavor-manager-chip" key={product.id}><i/><strong>{flavorName(product)}</strong><button type="button" onClick={()=>removeFlavor(product)} aria-label={`Quitar ${flavorName(product)}`}>×</button></div>)}</div><form className="flavor-manager-form" onSubmit={addFlavor}><input name="flavor" placeholder="Nuevo sabor, por ejemplo Coco" maxLength={60} required/><button className="button secondary" type="submit">＋ Agregar sabor</button></form>{message&&<small className="flavor-manager-message">✓ {message}</small>}<small>La foto se puede cargar después editando el producto del yogurt. Si no tiene foto, KIUBO usa la imagen neutra en el selector.</small></section>;
}
