"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getWorkspaceContext,loadLocalDatabase } from "@/lib/local-store";

const LIST_ID="kiubo-product-categories";

export function ProductCategoryAssist(){
  const path=usePathname();
  useEffect(()=>{
    if(!path.startsWith("/catalog"))return;
    const enhance=()=>{
      const input=document.querySelector<HTMLInputElement>('input[name="category"]');
      if(!input)return;
      const db=loadLocalDatabase(),ctx=getWorkspaceContext(db);
      const categories=[...new Set(db.tenantProducts.filter(product=>product.tenantId===ctx.tenantId&&product.branchId===ctx.branchId&&product.active&&product.barcode!=="YUKI-ENVASE").map(product=>(product.category||"General").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
      let list=document.getElementById(LIST_ID) as HTMLDataListElement|null;
      if(!list){list=document.createElement("datalist");list.id=LIST_ID;document.body.appendChild(list)}
      list.replaceChildren(...categories.map(category=>{const option=document.createElement("option");option.value=category;return option}));
      input.setAttribute("list",LIST_ID);
      input.setAttribute("autocomplete","off");
      input.placeholder="Selecciona una categoría o escribe una nueva…";
      input.title="Puedes elegir una categoría existente o escribir una nueva";
    };
    enhance();
    const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[path]);
  return null;
}
