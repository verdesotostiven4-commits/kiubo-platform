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

function zeroInitialDetailDraft(){
  const sheet=$('#sheetHost .v10-sheet');
  const detail=sheet?.querySelector('.v102-detail');
  if(!sheet||!detail||sheet.dataset.hm1169Zeroed==='1')return;
  sheet.dataset.hm1169Zeroed='1';

  const reset=()=>{
    const qtyEls=$$('[data-pick-qty]',sheet);
    if(!qtyEls.length)return;
    let changed=false;
    for(const qtyEl of qtyEls){
      const id=String(qtyEl.dataset.pickQty||'');
      let qty=Math.max(0,Math.floor(Number(qtyEl.textContent||0)));
      const minus=sheet.querySelector(`[data-pick-minus="${CSS.escape(id)}"]`);
      while(minus&&qty>0&&qty<50){
        minus.click();
        qty--;
        changed=true;
      }
    }
    if(!changed){
      const total=qtyEls.reduce((sum,el)=>sum+Math.max(0,Number(el.textContent||0)),0);
      if(total>0)setTimeout(reset,0);
    }
  };

  reset();
}

function sync(){
  uiRaf=0;
  manualizeBrandRail();
  zeroInitialDetailDraft();
  root.dataset.hmCatalogClient='10.16.9';
}
function schedule(){if(uiRaf)return;uiRaf=requestAnimationFrame(sync)}

window.addEventListener('pageshow',schedule);
window.addEventListener('resize',schedule,{passive:true});
new MutationObserver(schedule).observe(document.documentElement,{
  childList:true,
  subtree:true
});

const start=()=>{manualizeBrandRail();zeroInitialDetailDraft();schedule()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
