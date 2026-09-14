/* Hakuna Catalog 10.16.2 — no startup brand flash + final cart/brand affordances. */
(()=>{
'use strict';
if(window.__hm1162Catalog)return;window.__hm1162Catalog=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
let brandLive=false,brandRevealToken=0,brandRevealPending=false,raf=0;

root.classList.add('hm1162-home-brands-pending');

function bootstrapKey(){return`kiubo-v10-bootstrap:${slug()}`}
function cartKey(){return`kiubo-v10-cart:${slug()}`}
function cartCount(){
  try{
    const raw=JSON.parse(localStorage.getItem(cartKey())||'{}')||{};
    return Object.values(raw).reduce((n,row)=>n+Math.max(0,Number(row?.quantity||0)),0);
  }catch{return 0}
}
function repairPonyCache(){
  try{
    const key=bootstrapKey(),payload=JSON.parse(localStorage.getItem(key)||'null');if(!payload)return;
    const product=(payload.products||[]).find(p=>String(p.id)==='2f4b5ef7-485e-4d6b-a52b-3ee8a513f46f');
    const box=(payload.presentations||[]).find(p=>String(p.id)==='b9708bbe-f935-4221-bc51-7e92d02faeff');
    if(product?.image_url&&box&&(!box.image_url||box.image_url.includes('61ca31b1-f544-4bcc-bcb7-a9f1fb5aee94.jpg'))){
      box.image_url=product.image_url;
      localStorage.setItem(key,JSON.stringify(payload));
    }
  }catch{}
}
function imageReady(img){
  if(!(img instanceof HTMLImageElement))return Promise.resolve();
  if(img.complete&&img.naturalWidth){
    return typeof img.decode==='function'?img.decode().catch(()=>{}):Promise.resolve();
  }
  return new Promise(resolve=>{
    const done=()=>resolve();
    img.addEventListener('load',done,{once:true});
    img.addEventListener('error',done,{once:true});
    setTimeout(done,1800);
  }).then(()=>typeof img.decode==='function'?img.decode().catch(()=>{}):undefined);
}
function revealHomeBrands(){
  const block=$('#homeView .hm-brand-block,#homeView .v10-brand-block');
  if(!block||!brandLive||brandRevealPending||root.classList.contains('hm1162-home-brands-ready'))return;
  const token=++brandRevealToken;brandRevealPending=true;
  const imgs=$$('img',block);
  Promise.all(imgs.map(imageReady)).then(()=>{
    brandRevealPending=false;
    if(token!==brandRevealToken||!block.isConnected)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      root.classList.remove('hm1162-home-brands-pending');
      root.classList.add('hm1162-home-brands-ready');
    }));
  });
}
function currentView(){
  return $('.v10-nav [data-view].active')?.dataset.view||'';
}
function scopeFloatingCart(){
  const btn=$('#hm112Cart');
  const onCatalog=currentView()==='catalog';
  root.classList.toggle('hm1162-catalog-active',onCatalog);
  if(!btn)return;
  const shouldHide=!onCatalog||cartCount()<=0;
  if(btn.hidden!==shouldHide)btn.hidden=shouldHide;
}
const minusSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
const plusSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
function normalizeCart(){
  $$('#cartView .v10-cart-line').forEach(line=>{
    $$('button',line).forEach(b=>{
      if(!b.closest('.v10-mini-step')&&(b.matches('[data-remove],[data-delete],.v10-remove,.v10-trash,.trash')||/eliminar|borrar/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`)))b.remove();
    });
    const step=$('.v10-mini-step',line);
    if(!step)return;
    const minus=$('[data-cart-minus]',step),plus=$('[data-cart-plus]',step);
    if(minus&&minus.dataset.hm1162Icon!=='1'){
      minus.dataset.hm1162Icon='1';
      minus.classList.add('hm1162-minus');
      minus.innerHTML=minusSvg;
      minus.setAttribute('aria-label','Quitar uno');
      minus.removeAttribute('title');
    }
    if(plus&&plus.dataset.hm1162Icon!=='1'){
      plus.dataset.hm1162Icon='1';
      plus.classList.add('hm1162-plus');
      plus.innerHTML=plusSvg;
      plus.setAttribute('aria-label','Agregar uno');
      plus.removeAttribute('title');
    }
  });
}
function updateBrandArrow(wrap,rail,btn){
  if(!wrap?.isConnected||!rail?.isConnected||!btn?.isConnected)return;
  const max=Math.max(0,rail.scrollWidth-rail.clientWidth);
  const show=max>10&&rail.scrollLeft<max-6;
  btn.classList.toggle('hm1162-visible',show);
  btn.setAttribute('aria-hidden',String(!show));
}
function ensureBrandArrow(){
  const rail=$('#catalogView .hm-v104-catalog-brands');if(!rail)return;
  let wrap=rail.closest('.hm1162-brand-wrap');
  if(!wrap){
    wrap=document.createElement('div');wrap.className='hm1162-brand-wrap';
    rail.parentNode.insertBefore(wrap,rail);wrap.append(rail);
  }
  let btn=$(':scope > .hm1162-brand-next',wrap);
  if(!btn){
    btn=document.createElement('button');btn.type='button';btn.className='hm1162-brand-next';
    btn.setAttribute('aria-label','Ver más marcas');btn.innerHTML='<span aria-hidden="true">›</span>';
    wrap.append(btn);
    btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      rail.scrollBy({left:Math.max(190,Math.round(rail.clientWidth*.72)),behavior:'smooth'});
      setTimeout(()=>updateBrandArrow(wrap,rail,btn),280);
    });
  }
  if(rail.dataset.hm1162Arrow!=='1'){
    rail.dataset.hm1162Arrow='1';
    rail.addEventListener('scroll',()=>updateBrandArrow(wrap,rail,btn),{passive:true});
  }
  updateBrandArrow(wrap,rail,btn);
}
function sync(){
  raf=0;
  scopeFloatingCart();
  normalizeCart();
  ensureBrandArrow();
  revealHomeBrands();
}
function schedule(){if(raf)return;raf=requestAnimationFrame(sync)}

repairPonyCache();
window.addEventListener('kiubo:brands-ready',()=>{
  brandLive=true;
  revealHomeBrands();
  schedule();
});

document.addEventListener('click',()=>{queueMicrotask(schedule);setTimeout(schedule,40);setTimeout(schedule,140)},true);
window.addEventListener('pageshow',schedule);
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('storage',e=>{if(e.key===cartKey()||e.key===bootstrapKey()){repairPonyCache();schedule()}});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
