"use client";

import { useEffect } from "react";

const isInstalled=()=>window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches||window.matchMedia("(display-mode: window-controls-overlay)").matches;

export function FullscreenRuntime(){
  useEffect(()=>{
    if(!isInstalled()||document.fullscreenElement)return;
    let attempted=false;
    const enter=()=>{
      if(attempted||document.fullscreenElement)return;
      attempted=true;
      void document.documentElement.requestFullscreen?.({navigationUI:"hide"}).catch(()=>undefined);
      cleanup();
    };
    const cleanup=()=>{
      window.removeEventListener("pointerdown",enter,true);
      window.removeEventListener("keydown",enter,true);
    };
    window.addEventListener("pointerdown",enter,true,{once:true});
    window.addEventListener("keydown",enter,true,{once:true});
    return cleanup;
  },[]);
  return null;
}
