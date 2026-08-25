"use client";

import { useEffect } from "react";

function editable(target:EventTarget|null){
  return target instanceof Element&&Boolean(target.closest("input,textarea,select,[contenteditable='true'],[data-allow-selection='true']"));
}

export function NativeAppGuards(){
  useEffect(()=>{
    document.documentElement.classList.add("kiubo-native-interaction");
    const context=(event:MouseEvent)=>{if(!editable(event.target))event.preventDefault()};
    const select=(event:Event)=>{if(!editable(event.target))event.preventDefault()};
    const copy=(event:ClipboardEvent)=>{if(!editable(event.target))event.preventDefault()};
    const drag=(event:DragEvent)=>{if(!editable(event.target))event.preventDefault()};
    document.addEventListener("contextmenu",context,true);
    document.addEventListener("selectstart",select,true);
    document.addEventListener("copy",copy,true);
    document.addEventListener("dragstart",drag,true);
    return()=>{
      document.documentElement.classList.remove("kiubo-native-interaction");
      document.removeEventListener("contextmenu",context,true);
      document.removeEventListener("selectstart",select,true);
      document.removeEventListener("copy",copy,true);
      document.removeEventListener("dragstart",drag,true);
    };
  },[]);
  return null;
}
