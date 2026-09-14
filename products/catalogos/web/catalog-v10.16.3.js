/* Hakuna Catalog 10.16.3 — stable first paint, search workspaces, product sheet and cart affordances. */
(()=>{
'use strict';
if(window.__hm1163Catalog)return;window.__hm1163Catalog=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const cacheKey=()=>`kiubo-v10-bootstrap:${slug()}`;
const cartKey=()=>`kiubo-v10-cart:${slug()}`;
const readJSON=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const initialCacheStamp=Number(readJSON(cacheKey(),{})?.cached_at||0);
const bootStarted=performance.now();
let liveReady=false,brandsReady=false,bootDone=false,lastMutation=performance.now(),bootTimer=0,searchScrollY=0;
let drag=null,brandSettleTimer=0;

root.classList.add('hm1163-boot','hm1163-float-blocked');

/* ---------- First paint: show one final UI, not cache -> live rerenders ---------- */
function criticalImages(){
  const home=$('#homeView');if(!home)return[];
  return [
    ...$$('.hm-brand-block img,.v10-brand-block img',home),
    ...$$('.hm-slide-main img,.hm109-image-slide img',home)
  ].slice(0,18);
}
function imageReady(img){
  if(!(img instanceof HTMLImageElement))return Promise.resolve();
  if(img.complete&&img.naturalWidth)return typeof img.decode==='function'?Promise.resolve(img.decode()).catch(()=>{}):Promise.resolve();
  return new Promise(resolve=>{
    let done=false;const finish=()=>{if(done)return;done=true;resolve()};
    img.addEventListener('load',finish,{once:true});img.addEventListener('error',finish,{once:true});setTimeout(finish,1100);
  }).then(()=>typeof img.decode==='function'?Promise.resolve(img.decode()).catch(()=>{}):undefined);
}
function markBootDone(){
  if(bootDone)return;bootDone=true;
  clearTimeout(bootTimer);
  root.classList.remove('hm1163-boot','hm1162-home-brands-pending');
  root.classList.add('hm1163-ready','hm1162-home-brands-ready');
  scheduleUi();
}
function attemptBootReveal(force=false){
  if(bootDone)return;
  const app=$('.v10-app'),home=$('#homeView .v10-home');
  if(!app||!home)return;
  const quiet=performance.now()-lastMutation>180;
  if(!force&&(!liveReady||!brandsReady||!quiet))return;
  const imgs=criticalImages();
  imgs.forEach(img=>{try{img.loading='eager';img.fetchPriority='high'}catch{}});
  Promise.all(imgs.map(imageReady)).finally(()=>requestAnimationFrame(()=>requestAnimationFrame(markBootDone)));
}
function watchCache(){
  if(bootDone)return;
  const stamp=Number(readJSON(cacheKey(),{})?.cached_at||0);
  if(stamp>initialCacheStamp){liveReady=true;attemptBootReveal(false)}
  if(!liveReady&&navigator.onLine===false&&readJSON(cacheKey(),null)?.account){liveReady=true;brandsReady=true;attemptBootReveal(false)}
  if(!bootDone)setTimeout(watchCache,70);
}
window.addEventListener('kiubo:brands-ready',()=>{brandsReady=true;lastMutation=performance.now();setTimeout(()=>attemptBootReveal(false),80)});
bootTimer=setTimeout(()=>{liveReady=true;brandsReady=true;attemptBootReveal(true)},4800);
watchCache();

/* ---------- Remove the two arrows that were never requested ---------- */
function neutralizeCustomArrows(){
  $$('.hm116-brand-next,.hm1162-brand-next').forEach(btn=>{btn.hidden=true;btn.setAttribute('aria-hidden','true');btn.tabIndex=-1});
}

/* ---------- Floating cart only in the plain catalog ---------- */
function cartCount(){
  const raw=readJSON(cartKey(),{})||{};
  return Object.values(raw).reduce((n,row)=>n+Math.max(0,Number(row?.quantity||0)),0);
}
function activeBrand(){
  return !!$('#activeFilterHost .v10-active-filter')||!!$('#catalogView .hm-v104-catalog-brands [data-brand-chip].active:not([data-brand-chip=""])');
}
function syncFloatingScope(){
  const catalogActive=!!$('.v10-nav [data-view="catalog"].active');
  const input=$('#catalogSearch');
  const hasQuery=!!input?.value?.trim();
  const sheetOpen=!!$('#sheetHost .v10-sheet');
  const focused=document.activeElement===input;
  const allowed=catalogActive&&!activeBrand()&&!hasQuery&&!sheetOpen&&!focused&&cartCount()>0;
  root.classList.toggle('hm1163-float-allowed',allowed);
  root.classList.toggle('hm1163-float-blocked',!allowed);
  const btn=$('#hm112Cart');if(btn&&btn.hidden===allowed)btn.hidden=!allowed;
}

/* ---------- General catalog search becomes a fixed, stable workspace ---------- */
function updateViewportVars(){
  const vv=window.visualViewport;
  root.style.setProperty('--hm1163-vvh',`${Math.round(vv?.height||innerHeight)}px`);
  root.style.setProperty('--hm1163-vvtop',`${Math.round(vv?.offsetTop||0)}px`);
}
function syncSearchWorkspace(){
  const input=$('#catalogSearch');
  const active=!!$('.v10-nav [data-view="catalog"].active')&&!!input?.value?.trim();
  if(active&&!root.classList.contains('hm1163-search-active'))searchScrollY=window.scrollY;
  root.classList.toggle('hm1163-search-active',active);
  if(!active&&root.classList.contains('hm1163-search-restoring'))return;
  updateViewportVars();
}
function highlightProduct(id){
  let tries=0;
  const locate=()=>{
    const card=$(`#catalogResults [data-product="${CSS.escape(String(id))}"]`);
    if(!card&&tries++<18){setTimeout(locate,45);return}
    if(!card)return;
    root.classList.remove('hm1163-search-active');
    requestAnimationFrame(()=>{
      card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.remove('hm1163-search-target');void card.offsetWidth;card.classList.add('hm1163-search-target');
      setTimeout(()=>card.classList.remove('hm1163-search-target'),2200);
    });
  };
  setTimeout(locate,90);
}
function routeSearchProduct(id){
  const input=$('#catalogSearch');
  input?.blur();
  const clearBrand=$('#clearBrand');if(clearBrand)clearBrand.click();
  const all=$('#catalogView .v10-category-rail [data-category="all"]');if(all&&!all.classList.contains('active'))all.click();
  if(input){input.value='';input.dispatchEvent(new Event('input',{bubbles:true,composed:true}))}
  const box=$('#searchSuggestions');if(box){box.hidden=true;box.innerHTML=''}
  root.classList.remove('hm1163-search-active');
  requestAnimationFrame(()=>window.scrollTo(0,searchScrollY));
  highlightProduct(id);
}

/* ---------- Brand search: neutralize legacy auto-scroll / keyboard jumps ---------- */
function brandParts(){
  const input=$('#brandSearch');if(!input)return null;
  const sheet=input.closest('.v10-sheet');if(!sheet)return null;
  return{input,sheet,scroller:$('.v10-sheet-scroll',sheet)};
}
function settleBrandSheet({reset=false}={}){
  const p=brandParts();if(!p)return;
  updateViewportVars();
  const focused=document.activeElement===p.input;
  p.sheet.classList.toggle('hm1163-brand-focus',focused);
  if(reset&&p.scroller)p.scroller.scrollTop=0;
}
function scheduleBrandSettle(reset=false){
  clearTimeout(brandSettleTimer);
  [0,60,150,250,360].forEach(ms=>setTimeout(()=>settleBrandSheet({reset}),ms));
  brandSettleTimer=setTimeout(()=>settleBrandSheet({reset:false}),430);
}

/* ---------- Product detail: real drag-down close; no horizontal drift ---------- */
function beginSheetDrag(e){
  const grab=e.target.closest?.('#sheetHost .v10-sheet:has(.v102-detail) .v10-grab');if(!grab)return;
  const sheet=grab.closest('.v10-sheet');if(!sheet)return;
  e.preventDefault();e.stopPropagation();
  try{grab.setPointerCapture(e.pointerId)}catch{}
  drag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,lastY:e.clientY,lastT:performance.now(),sheet,grab,backdrop:$('.v10-backdrop','#sheetHost')};
  sheet.classList.add('hm1163-dragging');
}
function moveSheetDrag(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  e.preventDefault();e.stopPropagation();
  const dy=Math.max(0,e.clientY-drag.startY);
  drag.lastY=e.clientY;drag.lastT=performance.now();
  drag.sheet.style.setProperty('transform',`translate(-50%, ${Math.min(dy,innerHeight*.72)}px)`,'important');
  if(drag.backdrop)drag.backdrop.style.opacity=String(Math.max(.08,.45-dy/innerHeight*.7));
}
function endSheetDrag(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  e.preventDefault();e.stopPropagation();
  const d=drag;drag=null;
  const dy=Math.max(0,e.clientY-d.startY);
  d.sheet.classList.remove('hm1163-dragging');
  d.sheet.style.removeProperty('transform');if(d.backdrop)d.backdrop.style.removeProperty('opacity');
  if(dy>82){const close=$('.v10-sheet-close',d.sheet);close?.click();return}
  d.sheet.classList.add('hm1163-snapback');setTimeout(()=>d.sheet.classList.remove('hm1163-snapback'),190);
}

/* ---------- Cart: hidden trash + visible +/- + down hint ---------- */
function polishCart(){
  $$('#cartView .hm-line-remove').forEach(btn=>{btn.hidden=true;btn.tabIndex=-1;btn.setAttribute('aria-hidden','true')});
  const lines=$('#cartView.active .v10-cart-lines'),layout=lines?.closest('.v10-cart-layout');if(!lines||!layout)return;
  let hint=$('.hm1163-cart-more',layout);
  if(!hint){
    hint=document.createElement('div');hint.className='hm1163-cart-more';hint.setAttribute('aria-hidden','true');
    hint.innerHTML='<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
    layout.append(hint);
  }
  if(lines.dataset.hm1163Hint!=='1'){
    lines.dataset.hm1163Hint='1';
    lines.addEventListener('scroll',()=>updateCartHint(lines,hint),{passive:true});
  }
  updateCartHint(lines,hint);
}
function updateCartHint(lines,hint){
  if(!lines||!hint)return;
  const more=lines.scrollHeight>lines.clientHeight+10;
  const atTop=lines.scrollTop<14;
  hint.classList.toggle('show',more&&atTop);
}

function polishPowerBrand(){
  $$('#searchSuggestions .hm1072-search-brands [data-brand-chip="Power"] img').forEach(img=>img.classList.add('hm1163-power-logo'));
}

let raf=0;
function syncUi(){
  raf=0;neutralizeCustomArrows();syncFloatingScope();syncSearchWorkspace();polishCart();polishPowerBrand();
}
function scheduleUi(){if(raf)return;raf=requestAnimationFrame(syncUi)}

/* Run before the base/module click handlers so product search results never open the bottom sheet. */
document.addEventListener('click',e=>{
  const result=e.target.closest?.('#searchSuggestions .hm1072-search-products [data-open],#searchSuggestions [data-search-product]');
  if(result){
    const id=result.dataset.open||result.dataset.searchProduct;
    if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();routeSearchProduct(id);return}
  }
  queueMicrotask(scheduleUi);setTimeout(scheduleUi,40);setTimeout(scheduleUi,150);
},true);
document.addEventListener('keydown',e=>{
  if(e.target?.id==='catalogSearch'&&e.key==='Enter'){
    const first=$('#searchSuggestions .hm1072-search-products [data-open],#searchSuggestions [data-search-product]');
    const id=first?.dataset.open||first?.dataset.searchProduct;if(id){e.preventDefault();e.stopImmediatePropagation();routeSearchProduct(id)}
  }
},true);
document.addEventListener('input',e=>{
  if(e.target?.id==='catalogSearch'){updateViewportVars();setTimeout(scheduleUi,0)}
  if(e.target?.id==='brandSearch')scheduleBrandSettle(true);
},true);
document.addEventListener('focusin',e=>{
  if(e.target?.id==='catalogSearch')setTimeout(scheduleUi,0);
  if(e.target?.id==='brandSearch')scheduleBrandSettle(true);
},true);
document.addEventListener('focusout',e=>{
  if(e.target?.id==='catalogSearch')setTimeout(scheduleUi,120);
  if(e.target?.id==='brandSearch')setTimeout(()=>settleBrandSheet({reset:false}),220);
},true);
document.addEventListener('pointerdown',beginSheetDrag,{capture:true,passive:false});
document.addEventListener('pointermove',moveSheetDrag,{capture:true,passive:false});
document.addEventListener('pointerup',endSheetDrag,{capture:true,passive:false});
document.addEventListener('pointercancel',endSheetDrag,{capture:true,passive:false});

window.visualViewport?.addEventListener('resize',()=>{updateViewportVars();scheduleUi();if(document.activeElement?.id==='brandSearch')scheduleBrandSettle(false)},{passive:true});
window.visualViewport?.addEventListener('scroll',()=>{updateViewportVars();if(document.activeElement?.id==='brandSearch')scheduleBrandSettle(false)},{passive:true});
window.addEventListener('resize',()=>{updateViewportVars();scheduleUi()},{passive:true});
window.addEventListener('pageshow',scheduleUi);
window.addEventListener('storage',e=>{if(e.key===cartKey()||e.key===cacheKey())scheduleUi()});

new MutationObserver(()=>{lastMutation=performance.now();scheduleUi();if(liveReady&&brandsReady)setTimeout(()=>attemptBootReveal(false),210)})
  .observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});

const start=()=>{updateViewportVars();scheduleUi();setTimeout(()=>attemptBootReveal(false),260);document.documentElement.dataset.hmCatalogClient='10.16.3'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
