"use client";

import { useEffect,useState } from "react";

const DEFAULT_YOGURT="https://blogger.googleusercontent.com/img/a/AVvXsEg_L3dUljGZBrjFX-1Nv-wUwqc9J37Dk2MlgL_HsLWYGPfccp8OSkeVItlthfRP9M0SqiUt6B07Xk7cG2rGxhKLRT0z7yyV-drSgPNRODjH676spZ0ZP7j2RCmUiAc6oryev9kl-1-c6wPhpbM04DqvQAGLeFcnK41ANXM6NKQKliFNx8ymF0fBJOcVlMQ";
const YOGURT_ASSETS:Record<string,string>={
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
const assetFor=(flavor:string)=>YOGURT_ASSETS[slug(flavor)]||DEFAULT_YOGURT;

type Props={productName:string;flavors:string[];onClose:()=>void;onConfirm:(first:string,second:string)=>void};

export function YukiCombo4Picker({productName,flavors,onClose,onConfirm}:Props){
  const[first,setFirst]=useState("");
  const[second,setSecond]=useState("");
  const[active,setActive]=useState<1|2>(1);
  useEffect(()=>{for(const src of new Set([DEFAULT_YOGURT,...Object.values(YOGURT_ASSETS)])){const image=new Image();image.src=src}},[]);
  const choose=(flavor:string)=>{if(active===1){setFirst(flavor);if(!second)setActive(2);return}setSecond(flavor);if(!first)setActive(1)};
  const clear=(slot:1|2)=>{if(slot===1)setFirst("");else setSecond("");setActive(slot)};
  const ready=Boolean(first&&second),current=active===1?first:second;
  return <div className="combo4-picker-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="combo4-picker" role="dialog" aria-modal="true" aria-label={`Personalizar ${productName}`}>
      <button className="combo4-close" onClick={onClose} aria-label="Cerrar">×</button>
      <header className="combo4-head"><span>COMBO 4</span><h3>Elige tus 2 yogures</h3></header>
      <div className="combo4-slots">
        <button className={`combo4-slot ${active===1?"active":""} ${first?"filled":""}`} onClick={()=>setActive(1)}>
          {first&&<span className="combo4-clear" aria-label="Quitar Yogur 1" onClick={event=>{event.stopPropagation();clear(1)}}>×</span>}
          <div className="combo4-cup-stage"><img key={first||"default-1"} src={first?assetFor(first):DEFAULT_YOGURT} alt={first?`Yogur de ${first}`:"Yogur 1 sin sabor seleccionado"}/></div>
          <small>YOGUR 1</small><strong>{first||"Elige un sabor"}</strong>{active===1&&<em>Seleccionando</em>}
        </button>
        <div className="combo4-plus" aria-hidden="true">＋</div>
        <button className={`combo4-slot ${active===2?"active":""} ${second?"filled":""}`} onClick={()=>setActive(2)}>
          {second&&<span className="combo4-clear" aria-label="Quitar Yogur 2" onClick={event=>{event.stopPropagation();clear(2)}}>×</span>}
          <div className="combo4-cup-stage"><img key={second||"default-2"} src={second?assetFor(second):DEFAULT_YOGURT} alt={second?`Yogur de ${second}`:"Yogur 2 sin sabor seleccionado"}/></div>
          <small>YOGUR 2</small><strong>{second||"Elige un sabor"}</strong>{active===2&&<em>Seleccionando</em>}
        </button>
      </div>
      <div className="combo4-flavor-head"><div><span>{active===1?"YOGUR 1":"YOGUR 2"}</span><strong>Sabores</strong></div><b>{ready?"2/2 listos":first||second?"1/2 listo":"0/2"}</b></div>
      <div className="combo4-flavors">{flavors.map(flavor=>{const key=slug(flavor),selected=current===flavor,used=first===flavor||second===flavor;return <button key={flavor} data-flavor={key} className={`${selected?"selected":""} ${used?"used":""}`} onClick={()=>choose(flavor)}><i/><span>{flavor}</span>{selected&&<b>✓</b>}</button>})}</div>
      <footer className="combo4-footer"><div className="combo4-summary"><span>{first||"Yogur 1"}</span><i>＋</i><span>{second||"Yogur 2"}</span></div><button className="combo4-confirm" disabled={!ready} onClick={()=>{if(ready)onConfirm(first,second)}}>{ready?`Agregar ${productName}`:"Elige los 2 sabores"}</button></footer>
    </section>
  </div>;
}
