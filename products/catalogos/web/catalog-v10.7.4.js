/* Hakuna Matata 10.7.4 — root fix for brand selection flicker + safe asset cleanup. */
(()=>{
'use strict';
if(window.__hakunaCatalog1074)return;window.__hakunaCatalog1074=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const railKey=`hm1074-brand-left:${slug}`;
let savedLeft=Number(sessionStorage.getItem(railKey)||0)||0;
let routing=false;

/* 10.7.3 briefly used an unrelated Halls department-store mark. Remove it rather than display a false logo. */
try{const current=window.KIUBO_BRAND_ASSETS||{};if(current.halls){const clean={...current};delete clean.halls;window.KIUBO_BRAND_ASSETS=Object.freeze(clean)}}catch{}

function rail(){return $('.hm-v104-catalog-brands')}
function remember(){const r=rail();if(!r)return;savedLeft=r.scrollLeft;try{sessionStorage.setItem(railKey,String(savedLeft))}catch{}}
function restore(){const r=rail();if(!r)return;const max=Math.max(0,r.scrollWidth-r.clientWidth);r.scrollLeft=Math.max(0,Math.min(savedLeft,max))}
function settle(){restore();queueMicrotask(restore);requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});setTimeout(restore,40);setTimeout(restore,120)}

/*
  The legacy catalog listener fully re-rendered the page for every brand-chip click.
  That was the actual source of the blink and scroll reset. Route the rail click through
  the already-existing in-place brand filter instead, without exposing private state.
*/
window.addEventListener('pointerdown',e=>{if(e.target.closest?.('.hm-v104-catalog-brands [data-brand-chip]'))remember()},true);
window.addEventListener('click',e=>{
  const chip=e.target.closest?.('.hm-v104-catalog-brands [data-brand-chip]');
  if(!chip||routing)return;
  const filter=$('#filterBtn');
  if(!filter)return;
  e.preventDefault();e.stopImmediatePropagation();remember();
  const wanted=String(chip.dataset.brandChip||'');
  routing=true;
  try{
    filter.click();
    requestAnimationFrame(()=>{
      try{
        const sheet=$('#sheetHost .v10-sheet');
        const option=sheet?$$('[data-brand-option]',sheet).find(b=>norm(b.dataset.brandOption||'')===norm(wanted)):null;
        if(option&&typeof option.onclick==='function')option.onclick();
        else option?.click();
      }finally{routing=false;settle()}
    });
  }catch{routing=false;settle()}
},true);

function polishFallbacks(){
  const assets=window.KIUBO_BRAND_ASSETS||{};
  $$('.hm-brand-visual.hm1072-fallback').forEach(v=>{
    const button=v.closest('[data-brand-chip],[data-brand-option]');
    const name=String(button?.dataset.brandChip??button?.dataset.brandOption??v.textContent??'').trim();
    if(!name)return;
    const k=norm(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    if(assets[k]||assets[k==='kinder'?'kinder-joy':k])return;
    let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))%360;
    v.classList.add('hm1074-wordmark');
    v.style.setProperty('--hm1074-h',String(h));
    v.setAttribute('title',`${name} · logo pendiente`);
  })
}
function enhance(){polishFallbacks();settle();document.documentElement.dataset.hmCatalog='10.7.4'}
new MutationObserver(()=>{restore();polishFallbacks()}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('kiubo:brands-ready',()=>{polishFallbacks();settle()});window.addEventListener('pageshow',enhance);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
