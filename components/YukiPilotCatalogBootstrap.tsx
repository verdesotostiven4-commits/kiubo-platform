"use client";

import { useEffect } from "react";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type TenantProduct } from "@/lib/local-store";
import { runSyncCycle } from "@/lib/sync-engine";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";

const VIRTUAL_STOCK=1_000_000;
const YUKI_MENU=[
  {slug:"yogurt-mora",name:"Yogurt Mora",category:"Yogurts",price:4.50},
  {slug:"yogurt-fresa",name:"Yogurt Fresa",category:"Yogurts",price:4.50},
  {slug:"yogurt-melon",name:"Yogurt Melón",category:"Yogurts",price:4.50},
  {slug:"yogurt-tomate-arbol",name:"Yogurt Tomate de árbol",category:"Yogurts",price:4.50},
  {slug:"yogurt-banana",name:"Yogurt Banana",category:"Yogurts",price:4.50},
  {slug:"yogurt-naranjilla",name:"Yogurt Naranjilla",category:"Yogurts",price:4.50},
  {slug:"yogurt-maracuya",name:"Yogurt Maracuyá",category:"Yogurts",price:4.50},
  {slug:"yogurt-mango",name:"Yogurt Mango",category:"Yogurts",price:4.50},
  {slug:"sandwich-pollo-cremoso",name:"Pollo Cremoso",category:"Sánduches",price:8.95},
  {slug:"sandwich-carne-brava",name:"Carne Brava",category:"Sánduches",price:9.90},
  {slug:"sandwich-la-fresca",name:"La Fresca",category:"Sánduches",price:7.75},
  {slug:"tortillas-queso",name:"Tortillas de yuca / verde rellenas de queso",category:"Especialidades",price:6.25},
  {slug:"tortillas-pollo-carne",name:"Tortillas de yuca rellena de pollo / verde rellena de carne",category:"Especialidades",price:6.95},
  {slug:"muchines-queso",name:"Muchines de queso",category:"Especialidades",price:6.25},
  {slug:"corviche-manaba",name:"Corviche Manaba",category:"Especialidades",price:6.95},
  {slug:"combo-1",name:"Combo 1",category:"Combos",price:5.75},
  {slug:"combo-2",name:"Combo 2",category:"Combos",price:7.50},
  {slug:"combo-3",name:"Combo 3",category:"Combos",price:7.50},
  {slug:"combo-4",name:"Combo 4",category:"Combos",price:14.00},
  {slug:"cafe-americano",name:"Café americano caliente / frío",category:"Bebidas",price:3.25},
  {slug:"cappuccino",name:"Cappuccino",category:"Bebidas",price:3.00},
  {slug:"espresso",name:"Espresso",category:"Bebidas",price:3.00},
  {slug:"te",name:"Té",category:"Bebidas",price:3.00},
  {slug:"smoothies",name:"Smoothies",category:"Bebidas",price:4.00},
  {slug:"jugo-frutas",name:"Jugo de frutas",category:"Bebidas",price:3.50},
  {slug:"colas",name:"Colas",category:"Bebidas",price:2.25},
  {slug:"agua-gas",name:"Agua con gas",category:"Bebidas",price:2.65},
] as const;

export function YukiPilotCatalogBootstrap(){
  useEffect(()=>{
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
    if(!ctx.tenant||ctx.tenant.name.trim().toUpperCase()!=="YUKI"||!ctx.branchId)return;
    const settings=getTenantSettings(db,ctx.tenantId);
    if(settings.businessType!=="food_service")return;
    if(db.tenantProducts.some(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId))return;

    const products:TenantProduct[]=YUKI_MENU.map(item=>({
      id:`yuki-menu-${item.slug}`,
      tenantId:ctx.tenantId,
      branchId:ctx.branchId,
      masterProductId:`custom-yuki-${item.slug}`,
      barcode:`YUKI-${item.slug.replace(/-/g,"").slice(0,22).toUpperCase()}`,
      name:item.name,
      price:item.price,
      cost:0,
      stock:VIRTUAL_STOCK,
      active:true,
      category:item.category,
      trackStock:false,
    }));

    db.tenantProducts.push(...products);
    saveLocalDatabase(db);
    window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"yuki-pilot-menu"}}));
    void runSyncCycle().then(result=>{
      if(result.pulled>0||result.pushed>0)window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:result}));
    }).catch(()=>undefined);
  },[]);
  return null;
}
