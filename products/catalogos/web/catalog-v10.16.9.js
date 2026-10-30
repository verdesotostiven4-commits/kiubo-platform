/* Hakuna Catalog 10.16.9 — manual brand rail + zero-default product chooser. */
(()=>{
'use strict';
if(window.__hm1169Catalog)return;window.__hm1169Catalog=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let uiRaf=0;

function removeBrandExtras(){
  $('#hm1168BrandMarquee')?.remove();
  $('#hm1167BrandMarquee')?.remove();
  $$('.hm116-brand-next,.hm1162-brand-next,.hm1164-brand-next').forEach(x=>x.remove());
}

function manualizeBrandRail(){
  removeBrandExtras();
  const rail=$('.hm-v104-catalog-brands');
  if(!rail)return;

  const buttons=$$(':scope > [data-brand-chip]',rail);
  if(!buttons.length)return;
  const sig=buttons.map(b=>String(b.dataset.brandChip||'')).join('|');

  if(rail.dataset.hm1169Manual===sig){
    rail.dataset.hm1166Fresh='1';
    rail.dataset.hm1166Signature=sig;
    if(!rail.querySelector(':scope > .hm1169-marquee-sentinel')){
      const sentinel=document.createElement('span');
      sentinel.className='hm1165-brand-clone hm1169-marquee-sentinel';
      sentinel.hidden=true;
      rail.append(sentinel);
    }
    $$(':scope > .hm1165-brand-clone:not(.hm1169-marquee-sentinel)',rail).forEach(x=>x.remove());
    return;
  }

  const left=rail.scrollLeft;
  const clean=rail.cloneNode(false);
  clean.innerHTML='';
  clean.dataset.hm1169Manual=sig;
  clean.dataset.hm1166Fresh='1';
  clean.dataset.hm1166Signature=sig;
  clean.dataset.hm1072='1';
  delete clean.dataset.hm1072Bound;
  clean.style.removeProperty('transform');
  clean.style.removeProperty('scroll-behavior');

  for(const button of buttons){
    const clone=button.cloneNode(true);
    clone.classList.remove('hm1165-brand-clone');
    clone.removeAttribute('data-hm1165-brand-clone');
    clone.removeAttribute('data-hm1168-brand');
    clone.removeAttribute('data-hm1168-copy');
    clean.append(clone);
  }

  const sentinel=document.createElement('span');
  sentinel.className='hm1165-brand-clone hm1169-marquee-sentinel';
  sentinel.hidden=true;
  clean.append(sentinel);

  rail.replaceWith(clean);
  requestAnimationFrame(()=>{
    const max=Math.max(0,clean.scrollWidth-clean.clientWidth);
    clean.scrollLeft=Math.max(0,Math.min(left,max));
  });
}

// Product quantities start at zero in the catalog itself. Do not reset them asynchronously.

function sync(){
  uiRaf=0;
  manualizeBrandRail();
  root.dataset.hmCatalogClient='10.16.9';
}
function schedule(){if(uiRaf)return;uiRaf=requestAnimationFrame(sync)}

window.addEventListener('pageshow',schedule);
window.addEventListener('resize',schedule,{passive:true});
new MutationObserver(schedule).observe(document.documentElement,{
  childList:true,
  subtree:true
});

const start=()=>{manualizeBrandRail();schedule()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
