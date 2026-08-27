"use client";

import { useEffect } from "react";

export function PosVisualPolishRuntime(){
  useEffect(()=>{
    let frame=0;
    const polish=()=>{
      document.querySelectorAll<HTMLElement>(".table-selector-grid button.live.active>span").forEach(node=>{
        const current=node.textContent||"";
        const cleaned=current.replace(/\s*·\s*En vivo\s*$/i,"").replace(/Pedido vacío\s*·?\s*$/i,"Pedido vacío");
        if(cleaned!==current)node.textContent=cleaned;
      });
      document.querySelectorAll<HTMLElement>(".checkout-table-state").forEach(node=>{
        if(/Actualizando en vivo/i.test(node.textContent||""))node.textContent="Pedido activo";
      });
      const helper=document.querySelector<HTMLElement>(".table-selector-head small");
      if(helper&&/actualiza en vivo/i.test(helper.textContent||""))helper.textContent="La mesa activa refleja al instante lo que agregas. Al cambiar entre mesas, KIUBO guarda la anterior automáticamente.";
    };
    const schedule=()=>{window.cancelAnimationFrame(frame);frame=window.requestAnimationFrame(polish)};
    polish();
    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>{observer.disconnect();window.cancelAnimationFrame(frame)};
  },[]);
  return null;
}
