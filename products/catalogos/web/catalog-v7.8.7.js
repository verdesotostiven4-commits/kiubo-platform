(()=>{
'use strict';
if(window.__hakunaCatalog787)return;window.__hakunaCatalog787=true;
const $=(s,r=document)=>r.querySelector(s);
let frame=0,last=performance.now(),gesture=null,currentStrip=null,scheduled=false;

// v7.8 used browser-history entries for sheets/legacy overlays. Those entries were
// racing the base catalog navigation and could make a product sheet appear and
// immediately return to the catalog. Keep normal view navigation, ignore only
// the synthetic v7.8 overlay entries.
if(!history.__hakuna787Patched){
  history.__hakuna787Patched=true;
  const nativePush=history.pushState.bind(history);
  history.pushState=function(state,title,url){
    if(state&&state.v78Overlay)return;
    return nativePush(state,title,url);
  };
}

// The base catalog attaches a horizontal category swipe to the whole catalog
// body. Brand rails live inside that body, so swiping brands also changed the
// category. Replacing only the body node removes those two direct touch
// listeners; all product/brand actions are delegated at document level and keep
// working normally.
function disableBodyCategorySwipe(){
  const body=$('#catalogView .v7-catalog-body');
  if(!body||body.dataset.v787SwipeDisabled==='1')return;
  const fresh=body.cloneNode(true);
  fresh.dataset.v787SwipeDisabled='1';
  body.replaceWith(fresh);
}

function cycleWidth(strip){
  const groups=[...strip.querySelectorAll(':scope > .v71-carousel-group')];
  if(groups.length>1){const w=groups[1].offsetLeft-groups[0].offsetLeft;if(w>0)return w}
  return groups[0]?.getBoundingClientRect().width||0;
}
function normalizeCarousel(strip){
  const w=cycleWidth(strip);if(!w)return;
  if(strip.scrollLeft<w*.45)strip.scrollLeft+=w;
  else if(strip.scrollLeft>w*1.55)strip.scrollLeft-=w;
}
function attachCarouselGesture(strip){
  strip.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,mode:''}}, {passive:true});
  strip.addEventListener('pointermove',e=>{
    if(!gesture||e.pointerId!==gesture.id||gesture.mode)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
    gesture.mode=Math.abs(dx)>Math.abs(dy)*1.16?'horizontal':'vertical';
  },{passive:true});
  const finish=e=>{if(!gesture||e.pointerId!==gesture.id)return;normalizeCarousel(strip);gesture=null;last=performance.now()};
  strip.addEventListener('pointerup',finish,{passive:true});
  strip.addEventListener('pointercancel',finish,{passive:true});
}

// catalog-v7-hotfix builds the real carousel and installs touchstart => pause +
// a 900ms delayed resume. Clone that already-built strip once: cloneNode keeps
// its exact visual content and data but drops the old event listeners. The old
// animation loop sees its node disconnected and exits. We then run one smooth
// continuous loop that pauses only after a genuinely horizontal gesture and
// resumes on the very next frame after release.
function takeOverCarousel(){
  const strip=$('#homeView .v7-product-strip.v71-infinite-strip');
  if(!strip||strip.dataset.v71Ready!=='1'||strip.dataset.v787Carousel==='1')return;
  const left=strip.scrollLeft;
  const fresh=strip.cloneNode(true);
  fresh.dataset.v787Carousel='1';
  fresh.dataset.v71Ready='1';
  const nativeTo=fresh.scrollTo?.bind(fresh),nativeBy=fresh.scrollBy?.bind(fresh);
  if(nativeTo)fresh.scrollTo=(...args)=>{const o=args[0];if(o&&typeof o==='object'&&o.behavior==='smooth')return;return nativeTo(...args)};
  if(nativeBy)fresh.scrollBy=(...args)=>{const o=args[0];if(o&&typeof o==='object'&&o.behavior==='smooth')return;return nativeBy(...args)};
  strip.replaceWith(fresh);
  fresh.scrollLeft=left;
  currentStrip=fresh;
  attachCarouselGesture(fresh);
  requestAnimationFrame(()=>{normalizeCarousel(fresh);last=performance.now()});
}
function enhance(){scheduled=false;disableBodyCategorySwipe();takeOverCarousel()}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
function tick(now){
  frame=requestAnimationFrame(tick);
  const strip=$('#homeView .v7-product-strip[data-v787-carousel="1"]');
  if(!strip||!strip.isConnected||!$('#homeView')?.classList.contains('active')){last=now;return}
  if(currentStrip!==strip)currentStrip=strip;
  const dt=Math.min(42,Math.max(0,now-last));last=now;
  if(document.visibilityState!=='visible'||gesture?.mode==='horizontal')return;
  strip.scrollLeft+=dt*.02;
  normalizeCarousel(strip);
}
const obs=new MutationObserver(schedule);
function start(){enhance();obs.observe(document.body,{childList:true,subtree:true});last=performance.now();frame=requestAnimationFrame(tick)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
