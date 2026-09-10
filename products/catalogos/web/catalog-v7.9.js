(()=>{
'use strict';
if(window.__hakunaCatalog79)return;window.__hakunaCatalog79=true;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
let data=null,dataPromise=null,gesture=null,last=performance.now(),raf=0,scheduled=false,readyTimer=0;

// Keep the base view history only. v7.8's synthetic overlay states were racing
// product sheets and could make a tap appear to open and immediately go back.
if(!history.__hakuna79Patched){
  history.__hakuna79Patched=true;
  const nativePush=history.pushState.bind(history);
  history.pushState=(state,title,url)=>state?.v78Overlay?undefined:nativePush(state,title,url);
}

async function boot(){
  if(data)return data;if(dataPromise)return dataPromise;
  dataPromise=fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version||'7.9.0'},body:JSON.stringify({action:'catalog_bootstrap',slug})})
    .then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'bootstrap_failed');data=b;return b})
    .finally(()=>dataPromise=null);
  return dataPromise;
}
function presentations(id){return(data?.presentations||[]).filter(p=>String(p.product_id)===String(id)&&p.visible!==false)}

// Multi-presentation cards must open the native detail sheet instead of silently
// adding the default presentation. The native sheet already owns stock, cart and
// presentation state, so this keeps one source of truth.
document.addEventListener('click',e=>{
  const add=e.target.closest?.('[data-add]');
  if(!add||!data||presentations(add.dataset.add).length<2)return;
  e.preventDefault();e.stopImmediatePropagation();
  const card=add.closest('.v7-product');
  const open=card?.querySelector('[data-open]');
  if(open)requestAnimationFrame(()=>open.click());
},true);

// Brand rails live inside the catalog body. Stop their touch gesture before the
// old body-level category swipe can see it; native scrolling remains untouched.
function isolateRail(rail){
  if(!rail||rail.dataset.v79Isolated)return;rail.dataset.v79Isolated='1';
  for(const type of ['touchstart','touchmove','touchend','touchcancel'])rail.addEventListener(type,e=>e.stopPropagation(),{passive:true});
}

// One continuous carousel. The legacy 7.8 interval still exists but its smooth
// scroll calls are ignored on this strip, so it cannot fight this animation.
function prepareCarousel(){
  const strip=$('#homeView .v7-product-strip');
  if(!strip||strip.dataset.v79Carousel==='1')return;
  const cards=[...strip.children].filter(x=>x.matches?.('.v7-product'));
  if(cards.length<2)return;
  strip.dataset.v79Carousel='1';
  const nativeTo=strip.scrollTo?.bind(strip),nativeBy=strip.scrollBy?.bind(strip);
  if(nativeTo)strip.scrollTo=(...args)=>{const o=args[0];if(o&&typeof o==='object'&&o.behavior==='smooth')return;return nativeTo(...args)};
  if(nativeBy)strip.scrollBy=(...args)=>{const o=args[0];if(o&&typeof o==='object'&&o.behavior==='smooth')return;return nativeBy(...args)};
  const frag=document.createDocumentFragment();
  cards.forEach(card=>{const clone=card.cloneNode(true);clone.dataset.v79Clone='1';frag.append(clone)});
  strip.append(frag);
  strip.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,mode:''}},{passive:true});
  strip.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id||gesture.mode)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;gesture.mode=Math.abs(dx)>Math.abs(dy)*1.16?'horizontal':'vertical'},{passive:true});
  const finish=e=>{if(!gesture||e.pointerId!==gesture.id)return;gesture=null;last=performance.now();normalizeCarousel(strip)};
  strip.addEventListener('pointerup',finish,{passive:true});strip.addEventListener('pointercancel',finish,{passive:true});
}
function cycleWidth(strip){const first=strip.querySelector('.v7-product:not([data-v79-clone])'),clone=strip.querySelector('[data-v79-clone]');return first&&clone?clone.offsetLeft-first.offsetLeft:0}
function normalizeCarousel(strip){const w=cycleWidth(strip);if(w&&strip.scrollLeft>=w)strip.scrollLeft-=w}
function tick(now){
  raf=requestAnimationFrame(tick);
  const strip=$('#homeView .v7-product-strip[data-v79-carousel="1"]');
  if(!strip||!strip.isConnected||!$('#homeView')?.classList.contains('active')){last=now;return}
  const dt=Math.min(42,Math.max(0,now-last));last=now;
  if(document.visibilityState!=='visible'||gesture?.mode==='horizontal')return;
  strip.scrollLeft+=dt*.022;normalizeCarousel(strip);
}

// Make bottom navigation feel immediate. The base click still performs the real
// state/render work; this pointer preview removes the visible delay on touch.
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest?.('.v7-nav [data-view]');if(!b)return;
  const name=b.dataset.view;if(!name)return;
  $$('.v7-nav [data-view]').forEach(x=>x.classList.toggle('active',x===b));
  $$('[data-panel]').forEach(p=>p.classList.toggle('active',p.dataset.panel===name));
},{passive:true,capture:true});

function markReady(){
  if(document.documentElement.classList.contains('k79-ready'))return;
  if($('.v78-home-showcase')||$('.v78-brand-hub'))document.documentElement.classList.add('k79-ready');
}
function enhance(){
  scheduled=false;
  $$('.v78-brand-hub-rail,.v78-home-brand-rail').forEach(isolateRail);
  prepareCarousel();markReady();
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(enhance))}
function observe(sel){const el=$(sel);if(el&&!el.dataset.v79Observed){el.dataset.v79Observed='1';new MutationObserver(schedule).observe(el,{childList:true,subtree:true})}}
function start(){
  boot().then(schedule).catch(()=>{});
  ['#homeView','#catalogView','#sheetHost','#cartView'].forEach(observe);
  enhance();last=performance.now();raf=requestAnimationFrame(tick);
  clearTimeout(readyTimer);readyTimer=setTimeout(()=>document.documentElement.classList.add('k79-ready'),1400);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
