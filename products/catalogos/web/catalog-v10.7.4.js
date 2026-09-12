/* Hakuna Matata 10.7.4 compatibility — visual fallback only. Brand routing moved to 10.8. */
(()=>{
'use strict';
if(window.__hakunaCatalog1074Safe)return;window.__hakunaCatalog1074Safe=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const $all=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
try{const current=window.KIUBO_BRAND_ASSETS||{};if(current.halls){const clean={...current};delete clean.halls;window.KIUBO_BRAND_ASSETS=Object.freeze(clean)}}catch{}
function polish(){
 const assets=window.KIUBO_BRAND_ASSETS||{};
 $all('.hm-brand-visual.hm1072-fallback').forEach(v=>{
   const button=v.closest('[data-brand-chip],[data-brand-option]'),name=String(button?.dataset.brandChip??button?.dataset.brandOption??v.textContent??'').trim();if(!name)return;
   const k=norm(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(assets[k]||assets[k==='kinder'?'kinder-joy':k])return;
   let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))%360;v.classList.add('hm1074-wordmark');v.style.setProperty('--hm1074-h',String(h));v.setAttribute('title',`${name} · logo pendiente`);
 });
}
new MutationObserver(polish).observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',polish,{once:true});else polish();
})();