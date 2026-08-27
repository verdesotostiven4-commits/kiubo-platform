"use client";

import { useEffect,useMemo,useState } from "react";
import type { ProductOptionChoice,ProductOptionConfig } from "@/lib/product-options";

const DEFAULT_YOGURT="https://blogger.googleusercontent.com/img/a/AVvXsEg_L3dUljGZBrjFX-1Nv-wUwqc9J37Dk2MlgL_HsLWYGPfccp8OSkeVItlthfRP9M0SqiUt6B07Xk7cG2rGxhKLRT0z7yyV-drSgPNRODjH676spZ0ZP7j2RCmUiAc6oryev9kl-1-c6wPhpbM04DqvQAGLeFcnK41ANXM6NKQKliFNx8ymF0fBJOcVlMQ";
const YUKI_YOGURT_ASSETS:Record<string,string>={
  mora:"https://blogger.googleusercontent.com/img/a/AVvXsEilt8lsN_JcJcHtvoetBzy7iiMAS-GKglc-UkziB8MbRtA9i2P56q777IoDpNRt1FEqi5eQ2s_8p761AASEKfpM7BOcXqPlNsZmUCCIsft00JillZJIcklm5pCks-JIlZf-9m-FgxSNsIPyJXN6UwEwJS7vs_d1fwKGXe1w8fdEx2wmqscU-ODYZ_GGdQg",
  fresa:"https://blogger.googleusercontent.com/img/a/AVvXsEhvMduk36pael28kbrh_Y0MHwnYXQlrK59m8VkLVOpaASS0tEqYAnfYI8Nb9DFIAXtLhlhY69HAo8mLc535W1IF2_-yAT3U0QUNpPpmZLOUOOdP2LqMEYN2dYdoNqHUW5qJ4zKOX0HpZfU7gJN_GI5gRL-q1Hzk3S0mgafQk8vbaVzGqtqLfo2jds4OMwk",
  frutilla:"https://blogger.googleusercontent.com/img/a/AVvXsEhvMduk36pael28kbrh_Y0MHwnYXQlrK59m8VkLVOpaASS0tEqYAnfYI8Nb9DFIAXtLhlhY69HAo8mLc535W1IF2_-yAT3U0QUNpPpmZLOUOOdP2LqMEYN2dYdoNqHUW5qJ4zKOX0HpZfU7gJN_GI5gRL-q1Hzk3S0mgafQk8vbaVzGqtqLfo2jds4OMwk",
  melon:"https://blogger.googleusercontent.com/img/a/AVvXsEjrLv-9zlOn0iu-iTVHq0cXG9bPnaeYE9wRx1jxoCESgYix2k9TogMm_v7D5DLryerpcFdyrTwyyTl_HifiRM-0fhEl3u_ZiGARDeh1a-TbmpAWBtuukDxru2spVdOHoJXbRIAgYB7-DcjqQXA4mdoeL4W6qWf9V9OSoJb57bJdStNgxndLKFyyJI94EUw",
  "tomate-de-arbol":"https://blogger.googleusercontent.com/img/a/AVvXsEgA-PQE2TqUV1QyY0CqcXrcxEobqnwtLPaQHwOhgfb2H8_mxvwmdYMWSnag2HeKoUyT5XM-x9AptAoYGc6iA86da5vZXDIMsHxu9T4R-0wvZjP5g9H-WkXdBv8dm5dQhhkVTYXVOjvS6bSxj3H44JKgQpFtZfKStAgXYAkFyJ2OYkEiYIjKpOXs1eZR_U0",
  banana:"https://blogger.googleusercontent.com/img/a/AVvXsEha3BOmizsoZ5Y40icn8JoOJiST1ckn8BVOjxC68x3FZff9grvvCuJrI5qOoQmzN3jJ6uczs8jvNV_Cx00hu62FZnGEl4cl5kXr_mc7blvog0XOEad0XyUyASpdyS09HiI9Zx_bLM9dziHvRNwvZe2weSgKAuDkkl1F4DykU_DtOSwo585UrT0M-iW2rqA",
  naranjilla:"https://blogger.googleusercontent.com/img/a/AVvXsEgaavO4_POGcQv3F9mC2zErI1B7RvwEaTYvx_fH-hhSCe404e0VqA9VADqi9P-VqtNWNEzlwrnTIbDRkuf8-fXQlWSGgUCSp7Vsut5hxDlHJXhnzZ0m68CjvzR7p0vvNcnnfOwxUyuRvBkS9bnKvi2Zv-gBRymqOBfA0euzJgrpgDeTLKVcpvKTgeRezmY",
  maracuya:"https://blogger.googleusercontent.com/img/a/AVvXsEg0cFkXkqLJVHNhrVerv31TH3rhPVQ2XPtw5wNnP14DrI412mLnLjDs4xh6vqsooaxUfMe6_yMI0-_KePEnMPx00WvVEyt_w5spkdXZiUsjXco6bl-BbGiYKDvVmk3Aqhoq5k4ldBNh3plSpvICZ16L7CWVAup5ahjvlzLAdluvIvEJKk8NMJe1G8FoNys",
  mango:"https://blogger.googleusercontent.com/img/a/AVvXsEi8WcDA6TkxZOTPcN8ob8hOdi0Rglp1_0W6cmvzeZ9KhYXziPFwR-7Cgrh-pDbGApjhRj78MzjS5Er4O9bdqBCJu_4u-txGoPwfTJqglKqVH90Kk9j6NtBDIEMwSVnoAC0uWU_yC0irXxQF958B1Nj9f-SUrZ2QST538uvULlIP239rc_wTPoq9O-ga0XQ"
};
const slug=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export type ProductOptionVisualPreset="yuki-yogurt";

type Props={productName:string;config:ProductOptionConfig;choices:ProductOptionChoice[];visualPreset?:ProductOptionVisualPreset;onClose:()=>void;onConfirm:(selections:string[])=>void};

export function ProductOptionPicker({productName,config,choices,visualPreset,onClose,onConfirm}:Props){
  const count=Math.max(1,Math.min(8,config.selectionCount||1));
  const[selections,setSelections]=useState<string[]>(()=>Array.from({length:count},()=>""));
  const[active,setActive]=useState(0);
  const imageMap=useMemo(()=>new Map(choices.map(choice=>{
    const presetAsset=visualPreset==="yuki-yogurt"?YUKI_YOGURT_ASSETS[slug(choice.label)]||DEFAULT_YOGURT:undefined;
    return[choice.label,presetAsset||choice.imageUrl] as const;
  })),[choices,visualPreset]);
  useEffect(()=>{
    const preload=visualPreset==="yuki-yogurt"?[DEFAULT_YOGURT,...Object.values(YUKI_YOGURT_ASSETS),...imageMap.values()]:[...imageMap.values()];
    for(const src of new Set(preload.filter((value):value is string=>Boolean(value)))){const image=new Image();image.src=src}
  },[imageMap,visualPreset]);
  const chosenCount=selections.filter(Boolean).length,ready=chosenCount===count,current=selections[active]||"";
  const choose=(value:string)=>{
    if(config.allowRepeat===false&&selections.some((selection,index)=>index!==active&&selection===value))return;
    setSelections(previous=>{const next=[...previous];next[active]=value;return next});
    const nextEmpty=selections.findIndex((selection,index)=>index>active&&!selection);
    if(nextEmpty>=0)setActive(nextEmpty);else if(active<count-1)setActive(active+1);
  };
  const clear=(slot:number)=>{setSelections(previous=>previous.map((value,index)=>index===slot?"":value));setActive(slot)};
  const plural=count===1?config.label:`${config.label}s`;
  return <div className="option-picker-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="option-picker" role="dialog" aria-modal="true" aria-label={`Personalizar ${productName}`}>
      <button className="option-picker-close" onClick={onClose} aria-label="Cerrar">×</button>
      <header className="option-picker-head"><span>PERSONALIZAR</span><h3>{productName}</h3><p>{count===1?`Elige 1 ${config.label.toLowerCase()}.`:`Elige ${count} ${plural.toLowerCase()}. Puedes repetir si el negocio lo permite.`}</p></header>
      <div className={`option-picker-slots option-picker-slots-${Math.min(count,4)}`}>
        {selections.map((selection,index)=>{const src=selection?imageMap.get(selection):visualPreset==="yuki-yogurt"?DEFAULT_YOGURT:undefined;return <button key={index} className={`option-picker-slot ${active===index?"active":""} ${selection?"filled":""}`} onClick={()=>setActive(index)}>
          {selection&&<span className="option-picker-clear" onClick={event=>{event.stopPropagation();clear(index)}}>×</span>}
          <div className="option-picker-visual">{src?<img key={`${index}-${selection||"default"}`} src={src} alt=""/>:<span>{selection?selection.slice(0,1).toUpperCase():String(index+1)}</span>}</div>
          <small>{config.label.toUpperCase()} {count>1?index+1:""}</small><strong>{selection||"Elige una opción"}</strong>{active===index&&<em>Seleccionando</em>}
        </button>})}
      </div>
      <div className="option-picker-choice-head"><div><span>{count>1?`${config.label.toUpperCase()} ${active+1}`:config.label.toUpperCase()}</span><strong>Opciones disponibles</strong></div><b>{chosenCount}/{count} {ready?"listos":""}</b></div>
      <div className="option-picker-choices">{choices.map(choice=>{const selected=current===choice.label,used=selections.includes(choice.label),disabled=config.allowRepeat===false&&used&&!selected;return <button key={choice.label} className={`${selected?"selected":""} ${used?"used":""}`} disabled={disabled} onClick={()=>choose(choice.label)}><i/><span>{choice.label}</span>{selected&&<b>✓</b>}</button>})}</div>
      <footer className="option-picker-footer"><div className="option-picker-summary">{selections.map((selection,index)=><span key={index}>{selection||`${config.label} ${count>1?index+1:""}`}</span>)}</div><button className="option-picker-confirm" disabled={!ready} onClick={()=>{if(ready)onConfirm(selections)}}>{ready?`Agregar ${productName}`:`Elige ${count-chosenCount} ${count-chosenCount===1?"opción":"opciones"}`}</button></footer>
    </section>
  </div>;
}
