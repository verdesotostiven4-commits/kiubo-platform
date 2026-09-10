(()=>{
'use strict';
if(window.__hakunaCatalog786)return;window.__hakunaCatalog786=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let frame=0,last=performance.now(),gesture=null,resumeAt=0;
function isolateRail(rail){
  if(!rail||rail.dataset.v786Isolated)return;
  rail.dataset.v786Isolated='1';
  for(const type of ['touchstart','touchmove','touchend','touchcancel']) rail.addEventListener(type,e=>e.stopPropagation(),{passive:true});
}
function prepareCarousel(strip){
  if(!strip||strip.dataset.v786Carousel)return;
  const originals=[...strip.children].filter(x=>x.matches?.('.v7-product'));
  if(originals.length<2)return;
  strip.dataset.v786Carousel='1';
  const nativeTo=strip.scrollTo?.bind(strip),nativeBy=strip.scrollBy?.bind(strip);
  if(nativeTo)strip.scrollTo=(...args)=>{const o=args[0];if(o&&typeof o==='object'&&o.behavior==='smooth')return;return nativeTo(...args)};
  if(nativeBy)strip.scrollBy=(...args)=>{const o=args[0];if(o&&typeof o==='object'&&o.behavior==='smooth')return;return nativeBy(...args)};
  const frag=document.createDocumentFragment();
  originals.forEach(card=>{const clone=card.cloneNode(true);clone.dataset.v786Clone='1';frag.append(clone)});
  strip.append(frag);
  strip.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,mode:''}}, {passive:true});
  strip.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id||gesture.mode)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;gesture.mode=Math.abs(dx)>Math.abs(dy)*1.18?'horizontal':'vertical'}, {passive:true});
  const end=e=>{if(!gesture||e.pointerId!==gesture.id)return;if(gesture.mode==='horizontal')resumeAt=performance.now()+120;gesture=null};
  strip.addEventListener('pointerup',end,{passive:true});strip.addEventListener('pointercancel',end,{passive:true});
}
function cycleWidth(strip){const first=strip.querySelector('.v7-product:not([data-v786-clone])'),clone=strip.querySelector('[data-v786-clone]');return first&&clone?clone.offsetLeft-first.offsetLeft:0}
function tick(now){
  frame=requestAnimationFrame(tick);
  const strip=$('#homeView .v7-product-strip');
  if(!strip||!$('#homeView')?.classList.contains('active')){last=now;return}
  prepareCarousel(strip);
  const dt=Math.min(42,Math.max(0,now-last));last=now;
  if(gesture?.mode==='horizontal'||now<resumeAt||document.visibilityState!=='visible')return;
  const w=cycleWidth(strip);if(!w)return;
  strip.scrollLeft+=dt*.022;
  if(strip.scrollLeft>=w)strip.scrollLeft-=w;
}
function enhance(){
  $$('.v78-brand-hub-rail,.v78-home-brand-rail').forEach(isolateRail);
  prepareCarousel($('#homeView .v7-product-strip'));
}
const obs=new MutationObserver(()=>requestAnimationFrame(enhance));
function start(){enhance();obs.observe(document.body,{childList:true,subtree:true});last=performance.now();frame=requestAnimationFrame(tick)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();