"use client";

import { useEffect } from "react";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type TenantProduct } from "@/lib/local-store";
import type { ProductOptionConfig } from "@/lib/product-options";
import { runSyncCycle } from "@/lib/sync-engine";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";

const VIRTUAL_STOCK=1_000_000;
const YUKI_COCO_IMAGE_URL="https://blogger.googleusercontent.com/img/a/AVvXsEiv07v-ruXVIQ8V8l1DhDNdrL8k7RWh8hIk1oWsz1oyhZpk6oWWR5OU7WafhAA_A6fj0lBiOAmG3r8zpiB2CUOD4nn7gUvJ1AVZ6zNHPg1s-1jKN6t2YutjWSSq_uF4NY40hxleLS-VvK7jQa86nYbelg9ASElDiFzEJwTeBKJgUS1GY1V5d7d9JT4FSBg";
export const YUKI_PACKAGING_BARCODE="YUKI-ENVASE";
export const YUKI_PACKAGING_PRICE=.50;
const YUKI_MENU=[
  {slug:"yogurt-mora",name:"Yogurt Mora",category:"Yogurts",price:4.50},
  {slug:"yogurt-fresa",name:"Yogurt Fresa",category:"Yogurts",price:4.50},
  {slug:"yogurt-melon",name:"Yogurt Melón",category:"Yogurts",price:4.50},
  {slug:"yogurt-tomate-arbol",name:"Yogurt Tomate de árbol",category:"Yogurts",price:4.50},
  {slug:"yogurt-banana",name:"Yogurt Banana",category:"Yogurts",price:4.50},
  {slug:"yogurt-naranjilla",name:"Yogurt Naranjilla",category:"Yogurts",price:4.50},
  {slug:"yogurt-maracuya",name:"Yogurt Maracuyá",category:"Yogurts",price:4.50},
  {slug:"yogurt-mango",name:"Yogurt Mango",category:"Yogurts",price:4.50},
  {slug:"yogurt-coco",name:"Yogurt Coco",category:"Yogurts",price:4.50},
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
const YUKI_COMBO_OPTION_COUNTS:Record<string,number>={"YUKI-COMBO1":1,"YUKI-COMBO2":1,"YUKI-COMBO3":1,"YUKI-COMBO4":2};
type ConfigurableProduct=TenantProduct&{optionConfig?:ProductOptionConfig};

export function YukiPilotCatalogBootstrap(){
  useEffect(()=>{
    const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
    if(!ctx.tenant||ctx.tenant.name.trim().toUpperCase()!=="YUKI"||!ctx.branchId)return;
    const settings=getTenantSettings(db,ctx.tenantId);
    if(settings.businessType!=="food_service")return;
    let changed=false;

    const settingsIndex=db.settings.findIndex(item=>item.tenantId===ctx.tenantId);
    if(settingsIndex>=0){
      const current=db.settings[settingsIndex];
      const serviceModes:["table","takeaway","delivery"]=["table","takeaway","delivery"];
      if(current.tableCount!==5||JSON.stringify(current.serviceModes)!==JSON.stringify(serviceModes)){
        db.settings[settingsIndex]={...current,tableCount:5,serviceModes};
        changed=true;
      }
    }

    const branchProducts=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId);
    if(!branchProducts.length){
      const products:TenantProduct[]=YUKI_MENU.map(item=>({
        id:`yuki-menu-${item.slug}`,tenantId:ctx.tenantId,branchId:ctx.branchId,masterProductId:`custom-yuki-${item.slug}`,
        barcode:`YUKI-${item.slug.replace(/-/g,"").slice(0,22).toUpperCase()}`,name:item.name,price:item.price,cost:0,stock:VIRTUAL_STOCK,active:true,category:item.category,trackStock:false,
        imageUrl:item.slug==="yogurt-coco"?YUKI_COCO_IMAGE_URL:undefined,
      }));
      db.tenantProducts.push(...products);changed=true;
    }

    // Additive pilot upgrade: existing YUKI branches receive Coco once. If the business later archives it,
    // the inactive record remains and this bootstrap will not bring it back unexpectedly.
    const coconutProduct=db.tenantProducts.find(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&(product.barcode==="YUKI-YOGURTCOCO"||product.name.trim().toLocaleLowerCase("es")==="yogurt coco"));
    if(!coconutProduct){
      db.tenantProducts.push({id:"yuki-menu-yogurt-coco",tenantId:ctx.tenantId,branchId:ctx.branchId,masterProductId:"custom-yuki-yogurt-coco",barcode:"YUKI-YOGURTCOCO",name:"Yogurt Coco",price:4.50,cost:0,stock:VIRTUAL_STOCK,active:true,category:"Yogurts",trackStock:false,imageUrl:YUKI_COCO_IMAGE_URL});
      changed=true;
    }else if(coconutProduct.imageUrl!==YUKI_COCO_IMAGE_URL){
      coconutProduct.imageUrl=YUKI_COCO_IMAGE_URL;
      changed=true;
    }

    const currentBranchProducts=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId);
    for(const product of currentBranchProducts){
      const count=YUKI_COMBO_OPTION_COUNTS[product.barcode]||(/^combo\s*([1-4])$/i.test(product.name.trim())?(product.name.trim().endsWith("4")?2:1):0);
      const configurable=product as ConfigurableProduct;
      if(count&&!configurable.optionConfig){
        configurable.optionConfig={label:"Yogur",selectionCount:count,source:"category",sourceCategory:"Yogurts",allowRepeat:true};
        changed=true;
      }
    }

    const packagingProduct=currentBranchProducts.find(product=>product.barcode===YUKI_PACKAGING_BARCODE);
    if(!packagingProduct){
      db.tenantProducts.push({
        id:"yuki-service-packaging",tenantId:ctx.tenantId,branchId:ctx.branchId,masterProductId:"custom-yuki-packaging",
        barcode:YUKI_PACKAGING_BARCODE,name:"Envase",price:YUKI_PACKAGING_PRICE,cost:0,stock:VIRTUAL_STOCK,active:true,category:"Cargos",trackStock:false,
      });
      changed=true;
    }else{
      const needsRepair=!packagingProduct.active||packagingProduct.name!=="Envase"||packagingProduct.price!==YUKI_PACKAGING_PRICE||packagingProduct.category!=="Cargos"||packagingProduct.trackStock!==false;
      if(needsRepair){
        packagingProduct.name="Envase";
        packagingProduct.price=YUKI_PACKAGING_PRICE;
        packagingProduct.active=true;
        packagingProduct.category="Cargos";
        packagingProduct.trackStock=false;
        if(packagingProduct.stock<=0)packagingProduct.stock=VIRTUAL_STOCK;
        changed=true;
      }
    }

    if(!changed)return;
    saveLocalDatabase(db);
    window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"yuki-pilot-restaurant"}}));
    void runSyncCycle().then(result=>{if(result.pulled>0||result.pushed>0)window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:result}))}).catch(()=>undefined);
  },[]);
  return null;
}
