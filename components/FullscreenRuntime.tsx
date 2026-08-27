"use client";

import { useEffect } from "react";

function isInstalled(){return window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: window-controls-overlay)").matches||window.matchMedia("(display-mode: fullscreen)").matches}
function isAlreadyFullscreen(){return window.matchMedia("(display-mode: fullscreen)").matches||Boolean(document.fullscreenElement)}

export function FullscreenRuntime(){
  useEffect(()=>{
    if(!isInstalled()||isAlreadyFullscreen())return;
    let done=false;
    const cleanup=()=>{window.removeEventListener("pointerdown",activate,true);window.removeEventListener("keydown",activate,true)};
    const activate=()=>{
      if(done||isAlreadyFullscreen()){cleanup();return}
      done=true;
      const request=document.documentElement.requestFullscreen;
      if(!request){cleanup();return}
      void request.call(document.documentElement).catch(()=>undefined).finally(cleanup);
    };
    window.addEventListener("pointerdown",activate,true);
    window.addEventListener("keydown",activate,true);
    return cleanup;
  },[]);
  return null;
}
