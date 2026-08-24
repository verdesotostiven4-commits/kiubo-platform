"use client";

import { useEffect } from "react";
import { initializeOfflineDurability,startOfflineDurability } from "@/lib/offline-durability";

export function DurabilityRuntime(){
  useEffect(()=>{
    let active=true;
    let stop=()=>{};
    void initializeOfflineDurability().then(result=>{
      if(!active)return;
      stop=startOfflineDurability();
      if(result.recoveredPrimary)window.location.reload();
    });
    return()=>{active=false;stop()};
  },[]);
  return null;
}
