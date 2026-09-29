"use client";

import { useEffect } from "react";
import { getDataProvider } from "@/lib/data-provider";
import { getTenantSettings,getWorkspaceContext,loadLocalDatabase,saveLocalDatabase,type ServiceMode,type TenantProduct } from "@/lib/local-store";
import { tableLabelsFromSettings,withTableLabels,type TableAwareSettings } from "@/lib/table-settings";
import { runSyncCycle } from "@/lib/sync-engine";
import { YUKI_INGREDIENTS,YUKI_INGREDIENT_BY_KEY,YUKI_MENU,YUKI_MENU_VERSION,YUKI_VIRTUAL_STOCK } from "@/lib/yuki-menu";
import { KIUBO_DATA_REFRESHED } from "./RealtimeSyncRuntime";

const YUKI_TABLE_SETUP_VERSION=2;
// Esta URL pertenece únicamente al selector visual de sabores. Se conserva aquí solo para reparar el dato que se guardó por error como foto comercial del producto Coco.
const LEGACY_COCO_SELECTOR_IMAGE_URL="https://blogger.googleusercontent.com/img/a/AVvXsEiv07v-ruXVIQ8V8l1DhDNdrL8k7RWh8hIk1oWsz1oyhZpk6oWWR5OU7WafhAA_A6fj0lBiOAmG3r8zpiB2CUOD4nn7gUvJ1AVZ6zNHPg1s-1jKN6t2YutjWSSq_uF4NY40hxleLS-VvK7jQa86nYbelg9ASElDiFzEJwTeBKJgUS1GY1V5d7d9JT4FSBg";
export const YUKI_PACKAGING_BARCODE="YUKI-ENVASE";
export const YUKI_PACKAGING_PRICE=.50;
export function YukiPilotCatalogBootstrap(){
  useEffect(()=>{
    let disposed=false;
    const bootstrap=async()=>{
      let db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
      if(!ctx.user||!ctx.tenant||ctx.tenant.name.trim().toUpperCase()!=="YUKI"||!ctx.branchId)return;
      const settings=getTenantSettings(db,ctx.tenantId);
      if(settings.businessType!=="food_service")return;

      // Cloud is the source of truth for a real business. The old bootstrap
      // seeded a default menu as soon as the local cache was empty; that could
      // race the first Cloud pull and publish stale prices/products back to
      // Supabase. Hydrate first and never manufacture production catalog data.
      if(getDataProvider().mode==="supabase"){
        const result=await runSyncCycle().catch(()=>null);
        if(disposed)return;
        if(result&&(result.pulled>0||result.pushed>0))window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:result}));
        db=loadLocalDatabase();
        ctx=getWorkspaceContext(db);
        if(!ctx.tenant||ctx.tenant.name.trim().toUpperCase()!=="YUKI"||!ctx.branchId)return;
        // Any menu/settings migration must be performed from the canonical
        // Cloud records. If none arrived, leave the workspace untouched and
        // let the normal sync runtime continue retrying.
        if(!db.tenantProducts.some(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId))return;
        return;
      }

      let changed=false;

    const settingsIndex=db.settings.findIndex(item=>item.tenantId===ctx.tenantId);
    if(settingsIndex>=0){
      const current=db.settings[settingsIndex],version=Number((current as TableAwareSettings).tableSetupVersion||0);
      if(version<YUKI_TABLE_SETUP_VERSION){
        const existing=tableLabelsFromSettings(current),base=existing.length?existing:["1","2","3","4","5"],upgraded=[...new Set([...base,"6","7"])];
        const serviceModes:ServiceMode[]=current.serviceModes.length?current.serviceModes:["table","takeaway","delivery"];
        db.settings[settingsIndex]={...withTableLabels(current,upgraded,{tableSetupVersion:YUKI_TABLE_SETUP_VERSION}),serviceModes};
        changed=true;
      }
    }

    const ingredientIds=new Map<string,string>();
    for(const definition of YUKI_INGREDIENTS){
      let product=db.tenantProducts.find(candidate=>candidate.tenantId===ctx.tenantId&&candidate.branchId===ctx.branchId&&(candidate.id===definition.id||((candidate.inventoryOnly===true||candidate.productKind==="ingredient")&&candidate.name.toLocaleLowerCase("es")===definition.name.toLocaleLowerCase("es"))));
      if(!product){
        product={id:definition.id,tenantId:ctx.tenantId,branchId:ctx.branchId,masterProductId:`ingredient-${definition.key}`,barcode:`INS-YUKI-${definition.key.replace(/-/g,"").toUpperCase().slice(0,20)}`,name:definition.name,price:0,cost:0,stock:0,active:true,category:"Insumos",productKind:"ingredient",trackStock:definition.trackStock,inventoryOnly:true,stockUnit:definition.unit,lowStockThreshold:definition.lowStockThreshold};
        db.tenantProducts.push(product);changed=true;
      }
      ingredientIds.set(definition.key,product.id);
    }

    for(const item of YUKI_MENU){
      const quantities=new Map<string,number>();
      for(const key of item.recipe){const ingredientId=ingredientIds.get(key)||YUKI_INGREDIENT_BY_KEY.get(key)?.id;if(ingredientId)quantities.set(ingredientId,(quantities.get(ingredientId)||0)+1)}
      const recipe=[...quantities].map(([productId,qty])=>({productId,qty}));
      const current=db.tenantProducts.find(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&(product.id===item.id||product.barcode===item.barcode));
      if(!current){
        db.tenantProducts.push({id:item.id,tenantId:ctx.tenantId,branchId:ctx.branchId,masterProductId:`custom-yuki-${item.slug}`,barcode:item.barcode,name:item.name,price:item.price,cost:0,stock:YUKI_VIRTUAL_STOCK,active:true,category:item.category,productKind:"sellable",trackStock:false,menuFeatured:true,menuDescription:item.description,menuVersion:YUKI_MENU_VERSION,recipe,...(item.optionConfig?{optionConfig:item.optionConfig}: {})} as TenantProduct);
        changed=true;
        continue;
      }
      const before=JSON.stringify(current);
      Object.assign(current,{name:item.name,price:item.price,active:true,category:item.category,productKind:"sellable",trackStock:false,menuFeatured:true,menuDescription:item.description,menuVersion:YUKI_MENU_VERSION,recipe,...(item.optionConfig?{optionConfig:item.optionConfig}:{})});
      if(current.id==="yuki-menu-yogurt-coco"&&current.imageUrl===LEGACY_COCO_SELECTOR_IMAGE_URL)delete current.imageUrl;
      if(JSON.stringify(current)!==before)changed=true;
    }

    const currentBranchProducts=db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId);

    const packagingProduct=currentBranchProducts.find(product=>product.barcode===YUKI_PACKAGING_BARCODE);
    if(!packagingProduct){
      db.tenantProducts.push({
        id:"yuki-service-packaging",tenantId:ctx.tenantId,branchId:ctx.branchId,masterProductId:"custom-yuki-packaging",
        barcode:YUKI_PACKAGING_BARCODE,name:"Envase",price:YUKI_PACKAGING_PRICE,cost:0,stock:YUKI_VIRTUAL_STOCK,active:true,category:"Cargos",productKind:"charge",trackStock:false,
      });
      changed=true;
    }else{
      const needsRepair=!packagingProduct.active||packagingProduct.name!=="Envase"||packagingProduct.price!==YUKI_PACKAGING_PRICE||packagingProduct.category!=="Cargos"||packagingProduct.productKind!=="charge"||packagingProduct.trackStock!==false;
      if(needsRepair){
        packagingProduct.name="Envase";
        packagingProduct.price=YUKI_PACKAGING_PRICE;
        packagingProduct.active=true;
        packagingProduct.category="Cargos";
        packagingProduct.productKind="charge";
        packagingProduct.trackStock=false;
        if(packagingProduct.stock<=0)packagingProduct.stock=YUKI_VIRTUAL_STOCK;
        changed=true;
      }
    }

      if(!changed)return;
      saveLocalDatabase(db);
      window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:{source:"yuki-pilot-restaurant"}}));
      void runSyncCycle().then(result=>{if(!disposed&&(result.pulled>0||result.pushed>0))window.dispatchEvent(new CustomEvent(KIUBO_DATA_REFRESHED,{detail:result}))}).catch(()=>undefined);
    };
    void bootstrap();
    return()=>{disposed=true};
  },[]);
  return null;
}
