/* Hakuna Matata 10.16.1 — final mobile/catalog polish. */
(()=>{
'use strict';
if(window.__hakunaCatalog10161)return;window.__hakunaCatalog10161=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const bootstrapKey=()=>`kiubo-v10-bootstrap:${slug()}`;
let raf=0,cartGuard=false;

/* The old Pony x24 URL was deleted from Storage. Keep cached clients from flashing a broken image
   while the live bootstrap arrives; only repair that exact stale reference. */
function repairCachedPony(){
  try{
    const key=bootstrapKey(),payload=JSON.parse(localStorage.getItem(key)||'null');
    if(!payload)return;
    const product=(payload.products||[]).find(p=>String(p.id)==='2f4b5ef7-485e-4d6b-a52b-3ee8a513f46f');
    const presentation=(payload.presentations||[]).find(p=>String(p.id)==='b9708bbe-f935-4221-bc51-7e92d02faeff');
    if(product?.image_url&&presentation?.image_url?.includes('61ca31b1-f544-4bcc-bcb7-a9f1fb5aee94.jpg')){
      presentation.image_url=product.image_url;
      localStorage.setItem(key,JSON.stringify(payload));
    }
  }catch{}
}

/* Floating cart belongs to Catalog only. Older runtimes may resync hidden, so guard that attribute. */
function cartCount(){
  try{
    const raw=JSON.parse(localStorage.getItem(`kiubo-v10-cart:${slug()}`)||'{}')||{};
    return Object.values(raw).reduce((n,row)=>n+Math.max(0,Number(row?.quantity||0)),0);
  }catch{return 0}
}
function scopeFloatingCart(){
  const btn=$('#hm112Cart');if(!btn)return;
  const onCatalog=!!$('.v10-nav [data-view="catalog"].active');
  const hide=cartCount()<=0||!onCatalog;
  if(btn.hidden!==hide){
    cartGuard=true;btn.hidden=hide;queueMicrotask(()=>{cartGuard=false});
  }
}
function bindFloatingGuard(){
  const btn=$('#hm112Cart');if(!btn||btn.dataset.hm10161Guard==='1')return;
  btn.dataset.hm10161Guard='1';
  new MutationObserver(()=>{if(!cartGuard)scopeFloatingCart()})
    .observe(btn,{attributes:true,attributeFilter:['hidden','class']});
  scopeFloatingCart();
}

/* Right-arrow affordance for the horizontally scrollable catalog brand rail. */
function updateRailArrow(rail,btn){
  if(!rail?.isConnected||!btn?.isConnected)return;
  const max=Math.max(0,rail.scrollWidth-rail.clientWidth);
  const overflow=max>8;
  btn.hidden=!overflow||rail.scrollLeft>=max-6;
  btn.classList.toggle('is-visible',!btn.hidden);
}
function ensureRailArrow(){
  const rail=$('.hm-v104-catalog-brands');if(!rail)return;
  const parent=rail.parentElement;if(!parent)return;
  parent.classList.add('hm116-brand-scroll-wrap');
  let btn=parent.querySelector(':scope > .hm116-brand-next');
  if(!btn){
    btn=document.createElement('button');
    btn.type='button';btn.className='hm116-brand-next';btn.setAttribute('aria-label','Ver más marcas');
    btn.innerHTML='<span aria-hidden="true">›</span>';
    parent.append(btn);
    btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const step=Math.max(180,Math.round(rail.clientWidth*.72));
      rail.scrollBy({left:step,behavior:'smooth'});
      setTimeout(()=>updateRailArrow(rail,btn),260);
    });
  }
  if(rail.dataset.hm10161Arrow!=='1'){
    rail.dataset.hm10161Arrow='1';
    rail.addEventListener('scroll',()=>updateRailArrow(rail,btn),{passive:true});
  }
  updateRailArrow(rail,btn);
}

/* Preserve explicit minus / quantity / plus controls and keep the plus discoverable. */
function normalizeCartControls(){
  $$('#cartView .v10-mini-step').forEach(step=>{
    const minus=$('[data-cart-minus]',step),plus=$('[data-cart-plus]',step);
    if(minus){minus.classList.add('hm116-minus');minus.setAttribute('aria-label','Quitar uno')}
    if(plus){plus.classList.add('hm116-plus');plus.setAttribute('aria-label','Agregar uno')}
  });
}

/* Toni is a high-priority visible brand; decode it eagerly to avoid a blank logo repaint. */
function prioritizeToni(){
  $$('[data-brand-chip="Toni"] img,[data-brand-option="Toni"] img').forEach(img=>{
    img.loading='eager';try{img.fetchPriority='high'}catch{}
    if(img.complete&&img.naturalWidth&&typeof img.decode==='function')img.decode().catch(()=>{});
  });
}

function sync(){
  raf=0;
  bindFloatingGuard();scopeFloatingCart();
  ensureRailArrow();normalizeCartControls();prioritizeToni();
}
function schedule(){if(raf)return;raf=requestAnimationFrame(sync)}

repairCachedPony();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('pageshow',schedule);
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('storage',e=>{if(e.key?.includes('kiubo-v10-cart')||e.key?.includes('kiubo-v10-bootstrap'))schedule()});
document.addEventListener('click',()=>{queueMicrotask(schedule);setTimeout(schedule,50)},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
})();
