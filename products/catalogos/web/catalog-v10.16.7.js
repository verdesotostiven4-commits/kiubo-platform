/* Hakuna Catalog 10.16.7 — isolated smooth brand marquee + frozen detail background. */
(()=>{
'use strict';
if(window.__hm1167Catalog)return;window.__hm1167Catalog=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let marqueeSeq=0,raf=0,detailOpen=false,pendingOrigin=null,lockState=null;

function sourceBrands(){
  const source=$('.hm-v104-catalog-brands');
  if(!source)return{source:null,buttons:[]};
  const buttons=$$(':scope > [data-brand-chip]',source).filter(b=>String(b.dataset.brandChip||'').trim());
  return{source,buttons};
}
function brandSignature(buttons){return buttons.map(b=>`${norm(b.dataset.brandChip||'')}:${b.querySelector('img')?.getAttribute('src')||''}`).join('|')}
function cloneBrandButton(button,copy){
  const clone=button.cloneNode(true),name=button.dataset.brandChip||'';
  clone.removeAttribute('data-brand-chip');
  clone.dataset.hm1167Brand=name;
  clone.dataset.hm1167Copy=String(copy);
  clone.classList.remove('active');
  clone.classList.add('hm1167-brand-chip');
  clone.querySelectorAll('img').forEach(img=>{img.loading='eager';img.decoding='async';try{img.fetchPriority='auto'}catch{}});
  return clone;
}
function syncBrandActive(viewport,source){
  if(!viewport||!source)return;
  const active=[...source.querySelectorAll(':scope > [data-brand-chip].active')].find(b=>String(b.dataset.brandChip||'').trim());
  const name=norm(active?.dataset.brandChip||'');
  $$('[data-hm1167-brand]',viewport).forEach(b=>b.classList.toggle('active',!!name&&norm(b.dataset.hm1167Brand||'')===name));
}
function startMarquee(viewport){
  const first=$('.hm1167-segment[data-copy="1"]',viewport),second=$('.hm1167-segment[data-copy="2"]',viewport);
  if(!first||!second)return;
  const seq=++marqueeSeq;
  let dragging=false,last=performance.now(),position=viewport.scrollLeft;
  const speed=.055;
  const loopWidth=()=>Math.max(0,second.offsetLeft-first.offsetLeft);
  const begin=()=>{dragging=true;position=viewport.scrollLeft};
  const end=()=>{position=viewport.scrollLeft;dragging=false;last=performance.now()};
  viewport.addEventListener('pointerdown',begin,{passive:true});
  viewport.addEventListener('pointerup',end,{passive:true});
  viewport.addEventListener('pointercancel',end,{passive:true});
  viewport.addEventListener('touchend',end,{passive:true});
  viewport.addEventListener('scroll',()=>{if(dragging)position=viewport.scrollLeft},{passive:true});
  const tick=now=>{
    if(seq!==marqueeSeq||!viewport.isConnected)return;
    const dt=Math.min(34,Math.max(0,now-last));last=now;
    const w=loopWidth();
    if(!dragging&&document.visibilityState==='visible'&&w>0){
      position+=dt*speed;
      if(position>=w)position-=w;
      viewport.scrollLeft=position;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function buildBrandMarquee(){
  const {source,buttons}=sourceBrands();
  if(!source||buttons.length<2)return;
  source.classList.add('hm1167-brand-source');
  const signature=brandSignature(buttons);
  let viewport=$('#hm1167BrandMarquee');
  if(viewport&&viewport.dataset.signature===signature){syncBrandActive(viewport,source);return}
  marqueeSeq++;
  viewport?.remove();
  viewport=document.createElement('div');
  viewport.id='hm1167BrandMarquee';
  viewport.className='hm1167-brand-marquee';
  viewport.dataset.signature=signature;
  const track=document.createElement('div');track.className='hm1167-brand-track';
  for(const copy of [1,2]){
    const segment=document.createElement('div');segment.className='hm1167-segment';segment.dataset.copy=String(copy);
    buttons.forEach(b=>segment.append(cloneBrandButton(b,copy)));
    track.append(segment);
  }
  viewport.append(track);
  source.insertAdjacentElement('afterend',viewport);
  viewport.addEventListener('click',e=>{
    const chip=e.target.closest?.('[data-hm1167-brand]');if(!chip)return;
    e.preventDefault();e.stopPropagation();
    const name=norm(chip.dataset.hm1167Brand||'');
    const real=[...source.querySelectorAll(':scope > [data-brand-chip]')].find(b=>norm(b.dataset.brandChip||'')===name);
    real?.click();
  },true);
  syncBrandActive(viewport,source);
  requestAnimationFrame(()=>requestAnimationFrame(()=>startMarquee(viewport)));
}

function rememberDetailOrigin(target){
  const trigger=target?.closest?.('#catalogView.active [data-open]');
  if(trigger)pendingOrigin={y:window.scrollY};
}
function lockBackground(){
  if(lockState||!document.body)return;
  const y=Math.max(0,Number(pendingOrigin?.y??window.scrollY));pendingOrigin=null;
  const body=document.body;
  lockState={y,body:{position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width,overflow:body.style.overflow},htmlOverflow:root.style.overflow};
  body.style.position='fixed';body.style.top=`-${y}px`;body.style.left='0';body.style.right='0';body.style.width='100%';body.style.overflow='hidden';root.style.overflow='hidden';root.classList.add('hm1167-detail-locked');
}
function unlockBackground(){
  const state=lockState;if(!state||!document.body)return;lockState=null;
  const body=document.body;
  body.style.position=state.body.position;body.style.top=state.body.top;body.style.left=state.body.left;body.style.right=state.body.right;body.style.width=state.body.width;body.style.overflow=state.body.overflow;root.style.overflow=state.htmlOverflow;root.classList.remove('hm1167-detail-locked');
  const y=Math.max(0,Number(state.y||0));
  const prev=root.style.scrollBehavior;root.style.setProperty('scroll-behavior','auto','important');
  window.scrollTo(0,y);
  requestAnimationFrame(()=>{window.scrollTo(0,y);if(prev)root.style.scrollBehavior=prev;else root.style.removeProperty('scroll-behavior')});
}
function syncDetailLock(){
  const open=!!$('#sheetHost .v102-detail');
  if(open&&!detailOpen){detailOpen=true;lockBackground()}
  else if(!open&&detailOpen){detailOpen=false;unlockBackground()}
}
function sync(){raf=0;buildBrandMarquee();syncDetailLock();document.documentElement.dataset.hmCatalogClient='10.16.7'}
function schedule(){if(raf)return;raf=requestAnimationFrame(sync)}

document.addEventListener('pointerdown',e=>rememberDetailOrigin(e.target),true);
window.addEventListener('pageshow',schedule);
window.addEventListener('resize',schedule,{passive:true});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','src']});
const start=()=>{buildBrandMarquee();syncDetailLock();schedule()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
