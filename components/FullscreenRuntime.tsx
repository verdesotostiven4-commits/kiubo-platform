"use client";

import { useEffect } from "react";

function isInstalled(){
  const navigatorWithStandalone=navigator as Navigator&{standalone?:boolean};
  return window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: window-controls-overlay)").matches||window.matchMedia("(display-mode: fullscreen)").matches||Boolean(navigatorWithStandalone.standalone);
}
function isAlreadyFullscreen(){return window.matchMedia("(display-mode: fullscreen)").matches||Boolean(document.fullscreenElement)}

export function FullscreenRuntime(){
  useEffect(()=>{
    if(!isInstalled()||isAlreadyFullscreen())return;
    const root=document.documentElement;
    const request=root.requestFullscreen?.bind(root);
    if(!request)return;
    let finished=false;
    const cleanup=()=>{
      window.removeEventListener("pointerdown",activate,true);
      window.removeEventListener("keydown",activate,true);
      window.removeEventListener("touchend",activate,true);
      window.removeEventListener("click",activate,true);
      document.removeEventListener("fullscreenchange",onFullscreenChange);
    };
    const succeed=()=>{finished=true;cleanup()};
    const tryFullscreen=()=>{
      if(finished||isAlreadyFullscreen()){succeed();return}
      void request().then(succeed).catch(()=>undefined);
    };
    const activate=(event:Event)=>{
      if(finished||isAlreadyFullscreen()){succeed();return}
      if(!event.isTrusted)return;
      tryFullscreen();
    };
    const onFullscreenChange=()=>{if(isAlreadyFullscreen())succeed()};

    // Best-effort launch attempt. Browsers that allow manifest/app fullscreen can accept it;
    // browsers requiring user activation will reject silently and use the first real gesture below.
    tryFullscreen();
    window.addEventListener("pointerdown",activate,true);
    window.addEventListener("keydown",activate,true);
    window.addEventListener("touchend",activate,true);
    window.addEventListener("click",activate,true);
    document.addEventListener("fullscreenchange",onFullscreenChange);
    return cleanup;
  },[]);
  return null;
}
