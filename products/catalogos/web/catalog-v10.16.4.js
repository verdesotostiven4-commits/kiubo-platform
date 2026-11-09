/* Hakuna Catalog 10.16.4 — final mobile stabilization for first paint, search, brands and product detail. */
(()=>{
'use strict';
if(window.__hm1164Catalog)return;window.__hm1164Catalog=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const cacheKey=()=>`kiubo-v10-bootstrap:${slug()}`;
const readJSON=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preferred=['Coca-Cola','Bubbaloo','Chiclets','Cheese Tris','Cheetos','Chips Ahoy!','Dasani','Fanta','Sprite','Gatorade','Oreo','Doritos','Ruffles','Tostitos','Trident','Ritz','Inacake','Mías','Rellenitas','Natura','Power','Yogu Yogu','Galak','Gansitos','Lechera','Vivant','Chiki','Club Social','De Todito','Fiora','Güitig','Halls','Kataboom','Plop','Pony Malta','Salticas','Apetitas','Barrilete','Ducales','Inca','Kinder','Manicho','Pulp','Rocklets','Sabiloe','Tru','Tumix'];
const initialStamp=Number(readJSON(cacheKey(),{})?.cached_at||0);
let released=false,bootDeadline=0,uiRaf=0,brandArrow=null,paintPending=false;

root.classList.add('hm1164-boot');

function orderedLiveBrands(payload){
  const counts=new Map(),canonical=new Map();
  for(const p of Array.isArray(payload?.products)?payload.products:[]){
    if(p?.visible===false||p?.archived_at)continue;
    const name=String(p?.brand||'').trim();if(!name)continue;
    const n=norm(name);canonical.set(n,canonical.get(n)||name);counts.set(n,(counts.get(n)||0)+1);
  }
  const first=preferred.map(name=>canonical.get(norm(name))).filter(Boolean),used=new Set(first.map(norm));
  const rest=[...canonical.values()].filter(name=>!used.has(norm(name))).sort((a,b)=>(counts.get(norm(b))||0)-(counts.get(norm(a))||0)||a.localeCompare(b,'es'));
  return[...first,...rest];
}
function brandVisual(name){
  const assets=window.KIUBO_BRAND_ASSETS||{},k=key(name),assetKey=k==='kinder'&&!assets[k]?'kinder-joy':k,url=assets[assetKey];
  return url?`<span class="hm-brand-visual has-image"><img src="${esc(url)}" alt="${esc(name)}" loading="eager" decoding="async"></span>`:`<span class="hm-brand-visual hm1164-brand-fallback"><b>${esc(name)}</b></span>`;
}
function normalizeHomeBrands(payload){
  const rail=$('#homeView .hm-brand-block .v10-brand-rail,#homeView .v10-brand-block .v10-brand-rail');if(!rail)return false;
  const names=orderedLiveBrands(payload).slice(0,5);if(!names.length)return false;
  const signature=names.map(norm).join('|');
  if(rail.dataset.hm1164Signature!==signature){
    rail.innerHTML=names.map(name=>`<button type="button" class="hm-brand-chip" data-brand-chip="${esc(name)}" aria-label="Ver productos ${esc(name)}">${brandVisual(name)}</button>`).join('');
    rail.dataset.hm1164Signature=signature;
    rail.dataset.hmRailReady='1';
  }
  return true;
}
function waitImage(img){
  if(!(img instanceof HTMLImageElement))return Promise.resolve();
  const decode=()=>typeof img.decode==='function'?Promise.resolve(img.decode()).catch(()=>{}):Promise.resolve();
  if(img.complete)return decode();
  return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve()};img.addEventListener('load',finish,{once:true});img.addEventListener('error',finish,{once:true});setTimeout(finish,900)}).then(decode);
}
function releaseBootShell(){
  if(released)return;
  released=true;clearTimeout(bootDeadline);
  root.classList.remove('hm1164-boot','hm1163-boot','hm1162-home-brands-pending','hm112-boot');
  root.classList.add('hm1164-ready','hm1163-ready','hm1162-home-brands-ready','hm112-ready');
  scheduleUi();
}
function releaseFirstPaint(payload){
  if(released)return;
  if(!normalizeHomeBrands(payload))return;
  const imgs=$('#homeView .hm-brand-block img,#homeView .v10-brand-block img,#homeView .hm-slide-main img,#homeView .hm109-image-slide img').slice(0,14);
  Promise.all(imgs.map(waitImage)).finally(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(released)return;normalizeHomeBrands(readJSON(cacheKey(),payload));releaseBootShell();
  })));
}
function tryFirstPaint(force=false){
  if(released)return;
  const payload=readJSON(cacheKey(),null);if(!payload?.account)return;
  const live=Number(payload.cached_at||0)>initialStamp;
  if(!force&&navigator.onLine!==false&&!live)return;
  if(!$('#homeView .v10-home')){setTimeout(()=>tryFirstPaint(force),70);return}
  if(paintPending)return;paintPending=true;
  setTimeout(()=>{paintPending=false;if(released)return;releaseFirstPaint(readJSON(cacheKey(),payload))},live?180:80);
}
function pollFirstPaint(){
  if(released)return;
  tryFirstPaint(false);
  if(!released)setTimeout(pollFirstPaint,70);
}
window.addEventListener('kiubo:brands-ready',()=>setTimeout(()=>tryFirstPaint(false),30));
bootDeadline=setTimeout(()=>{tryFirstPaint(true);setTimeout(()=>{if(!released)releaseBootShell()},450)},5500);
pollFirstPaint();

/* Search results: every brand result keeps the same compact frame, whatever the source logo aspect ratio. */
function normalizeSearchBrandCards(){
  $$('#searchSuggestions .hm1072-search-brands > [data-brand-chip]').forEach(btn=>{
    btn.classList.add('hm1164-brand-result');
    const wrap=btn.firstElementChild;if(wrap)wrap.classList.add('hm1164-brand-result-visual');
    const visual=wrap?.querySelector?.('.hm-brand-visual');if(visual)visual.classList.add('hm1164-brand-result-logo');
  });
}
function stabilizeSearchScroller(){
  const input=$('#catalogSearch'),box=$('#searchSuggestions');if(!input||!box)return;
  const active=!!input.value.trim()&&!!$('.v10-nav [data-view="catalog"].active');
  box.classList.toggle('hm1164-search-scroll',active);
}

/* One arrow only: visible at the very beginning, hidden as soon as the customer scrolls horizontally. */
function syncBrandArrow(){
  const rail=$('.hm-v104-catalog-brands');if(!rail)return;
  $$('.hm116-brand-next,.hm1162-brand-next').forEach(old=>{old.hidden=true;old.setAttribute('aria-hidden','true')});
  let wrap=rail.closest('.hm1162-brand-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.className='hm1164-brand-wrap';rail.parentNode?.insertBefore(wrap,rail);wrap.append(rail)}
  else wrap.classList.add('hm1164-brand-wrap');
  let btn=$(':scope > .hm1164-brand-next',wrap);
  if(!btn){
    btn=document.createElement('button');btn.type='button';btn.className='hm1164-brand-next';btn.setAttribute('aria-label','Ver más marcas');btn.innerHTML='<span aria-hidden="true">›</span>';wrap.append(btn);
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();rail.scrollBy({left:Math.max(190,Math.round(rail.clientWidth*.72)),behavior:'smooth'})});
  }
  brandArrow=btn;
  const max=Math.max(0,rail.scrollWidth-rail.clientWidth),atStart=rail.scrollLeft<=6;
  btn.classList.toggle('show',max>10&&atStart);
  btn.hidden=!(max>10&&atStart);
  if(rail.dataset.hm1164Arrow!=='1'){
    rail.dataset.hm1164Arrow='1';
    rail.addEventListener('scroll',()=>{
      if(!brandArrow?.isConnected)return;
      const m=Math.max(0,rail.scrollWidth-rail.clientWidth),start=rail.scrollLeft<=6;
      brandArrow.hidden=!(m>10&&start);brandArrow.classList.toggle('show',m>10&&start);
    },{passive:true});
  }
}

function syncUi(){uiRaf=0;normalizeSearchBrandCards();stabilizeSearchScroller();syncBrandArrow()}
function scheduleUi(){if(uiRaf)return;uiRaf=requestAnimationFrame(syncUi)}

document.addEventListener('input',e=>{if(e.target?.id==='catalogSearch'){requestAnimationFrame(scheduleUi);setTimeout(scheduleUi,60)}},true);
document.addEventListener('focusin',e=>{if(e.target?.id==='catalogSearch')setTimeout(scheduleUi,0)},true);
document.addEventListener('click',()=>{queueMicrotask(scheduleUi);setTimeout(scheduleUi,60)},true);
window.addEventListener('resize',scheduleUi,{passive:true});window.addEventListener('pageshow',scheduleUi);
new MutationObserver(scheduleUi).observe(document.documentElement,{childList:true,subtree:true});

const start=()=>{scheduleUi();document.documentElement.dataset.hmCatalogClient='10.16.4'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
