/* Hakuna Matata 10.12 — approved catalog UX consolidation. No search-result routing overrides. */
(()=>{
'use strict';
if(window.__hakunaCatalog10120)return;window.__hakunaCatalog10120=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const C=window.KIUBO_CATALOG_CONFIG||{};
const HERO_IMAGES=[
  'https://blogger.googleusercontent.com/img/a/AVvXsEi0hDelNFtHhwoe6guvslOKkEqE0a4o3qVn_Mnut7m2IPdXwfoGDifE1S5QksIbMEDzm_LFESZjvksQ3JEKR_i5iFIYzTkCryXadiPRtu7R9w00ZOtqLTFnDZEUdStZX1IyEbuPqy4CR8QCVlqrVoMEl2Q7FqCzkreaLh26NUkdZJ-TCRQbrvooScWcthA',
  'https://blogger.googleusercontent.com/img/a/AVvXsEi3HryNfbEOSl5KpAX1VsCus8Q_o3YRxcfb-_BSAsd-yPGyY_KRxIFyM-HnIaEWrEY7BImj7Dio2dze84LecAO2aBYxTXEUimky3GtqS3ln_dbsOtNAXtwAEMLKiut-zoN7P-7D_oov6-AFg42_Uwzg_dBKwd9IE7AhhTJZHTJoQHQxacyy6OWCchoiBog',
  'https://blogger.googleusercontent.com/img/a/AVvXsEjwNc7uz385CAxTzuZEaQSMdo-TBctEwPRxDSRk-bcYjgiNqu_Sol5tiTHaWaa1-zh6GQ9KHR-D-VNEEKU9zkcONv_7K_68wWIDEkoJxCEtclhN1bBBo4fUX16ZE7o-yCLcxDBhs3cikH8Tbf_oVXwfdJcX1b3gtPbgeypeW85otTQ3dj6bqrAK1ETvzkQ'
];
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const bootstrapKey=()=>`kiubo-v10-bootstrap:${slug()}`;
const cartKey=()=>`kiubo-v10-cart:${slug()}`;

/* ---------- first paint: never expose legacy home artwork ---------- */
let heroTimer=0;
function markReady(noHero=false){
  root.classList.add('hm112-ready');
  root.classList.toggle('hm112-no-hero',Boolean(noHero));
  if(heroTimer){clearTimeout(heroTimer);heroTimer=0;}
}
function watchFinalHero(){
  const img=$('#homeView .hm-slide-main.hm109-image-slide .hm109-hero-image');
  if(!img)return false;
  const done=()=>{
    const reveal=()=>markReady(false);
    if(typeof img.decode==='function')Promise.resolve(img.decode()).catch(()=>{}).finally(reveal);
    else reveal();
  };
  if(img.complete&&img.naturalWidth){done();return true;}
  if(img.dataset.hm112Bound!=='1'){
    img.dataset.hm112Bound='1';
    img.addEventListener('load',done,{once:true});
    img.addEventListener('error',()=>markReady(true),{once:true});
  }
  return true;
}
function ensureHeroGuard(){
  if(watchFinalHero())return;
  if(!heroTimer)heroTimer=setTimeout(()=>{
    if(!root.classList.contains('hm112-ready'))markReady(true);
  },4200);
}

/* ---------- background image prewarm/decode ---------- */
const seen=new Set(),queue=[],live=new Set();
let active=0;
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const concurrency=connection?.saveData?2:/2g/.test(String(connection?.effectiveType||''))?2:5;
const validUrl=v=>typeof v==='string'&&/^https?:\/\//i.test(v.trim());
function finish(img){live.delete(img);active=Math.max(0,active-1);pump();}
function pump(){
  while(active<concurrency&&queue.length){
    const {url,priority}=queue.shift();active++;
    const img=new Image();live.add(img);img.decoding='async';
    try{img.fetchPriority=priority}catch{}
    const done=()=>{
      if(typeof img.decode==='function')Promise.resolve(img.decode()).catch(()=>{}).finally(()=>finish(img));
      else finish(img);
    };
    img.onload=done;img.onerror=()=>finish(img);img.src=url;
  }
}
function enqueue(url,priority='low',front=false){
  url=String(url||'').trim();if(!validUrl(url)||seen.has(url))return;
  seen.add(url);const item={url,priority};front?queue.unshift(item):queue.push(item);pump();
}
function decodeMetaImages(description=''){
  try{
    const m=String(description||'').match(/\[\[KIUBO_PI:([A-Za-z0-9_-]+)\]\]\s*$/);if(!m)return[];
    let s=m[1].replace(/-/g,'+').replace(/_/g,'/');s+='='.repeat((4-s.length%4)%4);
    const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    const obj=JSON.parse(new TextDecoder().decode(bytes));
    return Object.values(obj||{}).map(x=>x?.u).filter(validUrl);
  }catch{return[];}
}
function cachedPayload(){try{return JSON.parse(localStorage.getItem(bootstrapKey())||'null')}catch{return null;}}
function warmPayload(payload){
  if(!payload||typeof payload!=='object')return;
  if(validUrl(payload.account?.logo_url))enqueue(payload.account.logo_url,'high',true);
  const urls=[];
  for(const product of Array.isArray(payload.products)?payload.products:[]){
    if(validUrl(product?.image_url))urls.push(product.image_url);
    urls.push(...decodeMetaImages(product?.description||''));
  }
  for(const presentation of Array.isArray(payload.presentations)?payload.presentations:[]){
    if(validUrl(presentation?.image_url))urls.push(presentation.image_url);
  }
  [...new Set(urls)].forEach((url,index)=>enqueue(url,index<24?'auto':'low',index<12));
}
function warmBrands(){
  const urls=Object.values(window.KIUBO_BRAND_ASSETS||{}).filter(validUrl);
  urls.slice(0,12).forEach(url=>enqueue(url,'auto'));
  urls.slice(12).forEach(url=>enqueue(url,'low'));
}
HERO_IMAGES.forEach((url,index)=>enqueue(url,index===0?'high':'auto',index===0));
if(validUrl(C.brandLogoUrl))enqueue(C.brandLogoUrl,'high',true);
warmPayload(cachedPayload());
setTimeout(warmBrands,0);
let warmTicks=0;
const warmPoll=setInterval(()=>{
  warmPayload(cachedPayload());warmBrands();
  if(++warmTicks>=36)clearInterval(warmPoll);
},350);

function markImage(img){
  if(!(img instanceof HTMLImageElement)||img.dataset.hm112Visual==='1'||!img.getAttribute('src'))return;
  img.dataset.hm112Visual='1';
  const ready=()=>{img.classList.remove('hm112-img-pending');img.classList.add('hm112-img-ready');};
  const decoded=()=>typeof img.decode==='function'?Promise.resolve(img.decode()).catch(()=>{}).finally(ready):ready();
  if(img.complete&&img.naturalWidth){decoded();return;}
  img.classList.add('hm112-img-pending');
  img.addEventListener('load',decoded,{once:true});img.addEventListener('error',ready,{once:true});
}
function scanImages(node=document){
  if(node instanceof HTMLImageElement)markImage(node);
  if(node?.querySelectorAll)node.querySelectorAll('img').forEach(markImage);
}

/* ---------- brand picker + mobile keyboard ---------- */
let brandRevealTimer=0;
function brandPickerParts(){
  const input=$('#brandSearch');if(!input)return null;
  const sheet=input.closest('.v10-sheet');if(!sheet)return null;
  return {input,sheet,scroller:$('.v10-sheet-scroll',sheet),search:input.closest('.v10-brand-search'),options:$('.v10-brand-options',sheet)};
}
function firstVisibleBrand(options){
  if(!options)return null;
  return $$('[data-brand-option]',options).find(el=>{
    if(el.hidden||!String(el.dataset.brandOption||'').trim())return false;
    const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden';
  })||null;
}
function fitBrandPicker(parts){
  if(!parts||document.activeElement!==parts.input||!window.visualViewport)return false;
  const vv=window.visualViewport;
  const keyboardOpen=(window.innerHeight-vv.height)>90||vv.height<window.innerHeight*.88;
  if(!keyboardOpen)return false;
  const top=Math.max(6,Math.round(vv.offsetTop+6));
  const height=Math.max(250,Math.round(vv.height-12));
  parts.sheet.classList.add('hm112-brand-keyboard');
  parts.sheet.style.setProperty('--hm112-top',`${top}px`);
  parts.sheet.style.setProperty('--hm112-height',`${height}px`);
  return true;
}
function revealFilteredBrand(){
  const parts=brandPickerParts();if(!parts?.scroller||!parts.search||!parts.options)return;
  if(!fitBrandPicker(parts)||!parts.input.value.trim())return;
  const first=firstVisibleBrand(parts.options);if(!first)return;
  requestAnimationFrame(()=>{
    const scRect=parts.scroller.getBoundingClientRect(),searchRect=parts.search.getBoundingClientRect(),firstRect=first.getBoundingClientRect();
    const desiredTop=Math.max(scRect.top+6,searchRect.bottom+8),delta=firstRect.top-desiredTop;
    if(Math.abs(delta)>2)parts.scroller.scrollTop+=delta;
  });
}
function scheduleBrandReveal(){
  clearTimeout(brandRevealTimer);requestAnimationFrame(revealFilteredBrand);
  brandRevealTimer=setTimeout(revealFilteredBrand,80);setTimeout(revealFilteredBrand,180);setTimeout(revealFilteredBrand,320);
}
function clearBrandKeyboard(){
  setTimeout(()=>{
    const parts=brandPickerParts();if(!parts||document.activeElement===parts.input)return;
    parts.sheet.classList.remove('hm112-brand-keyboard');
    parts.sheet.style.removeProperty('--hm112-top');parts.sheet.style.removeProperty('--hm112-height');
  },180);
}
window.addEventListener('input',e=>{if(e.target?.id==='brandSearch')scheduleBrandReveal()},true);
window.addEventListener('focusin',e=>{if(e.target?.id==='brandSearch')scheduleBrandReveal()},true);
window.addEventListener('focusout',e=>{if(e.target?.id==='brandSearch')clearBrandKeyboard()},true);
window.visualViewport?.addEventListener('resize',scheduleBrandReveal,{passive:true});
window.visualViewport?.addEventListener('scroll',scheduleBrandReveal,{passive:true});

/* ---------- selecting a brand always resets category to Todos ---------- */
let brandPassThrough=false;
function equivalentBrandTarget(name,kind){
  const wanted=norm(name),selector=kind==='option'?'#sheetHost [data-brand-option]':'#catalogView [data-brand-chip]';
  return $$(selector).find(el=>!el.closest?.('#searchSuggestions')&&norm(kind==='option'?el.dataset.brandOption:el.dataset.brandChip)===wanted)||null;
}
function rerouteBrandClick(original,name,kind){
  const all=$('#catalogView .v10-category-rail [data-category="all"]')||$('#catalogView [data-category="all"]');
  if(!all)return;all.click();let tries=0;
  const handoff=()=>{
    const target=(original?.isConnected?original:null)||equivalentBrandTarget(name,kind);
    if(target){brandPassThrough=true;target.click();setTimeout(()=>{brandPassThrough=false},0);return;}
    if(tries++<16)setTimeout(handoff,30);
  };
  setTimeout(handoff,35);
}
window.addEventListener('click',e=>{
  const target=e.target.closest?.('[data-brand-option],[data-brand-chip]');
  if(!target||target.closest?.('#searchSuggestions'))return;
  if(brandPassThrough){brandPassThrough=false;return;}
  const kind=target.hasAttribute('data-brand-option')?'option':'chip';
  const name=(kind==='option'?target.dataset.brandOption:target.dataset.brandChip)||'';
  if(!String(name).trim())return;
  const active=$('#catalogView .v10-category-rail [data-category].active')||$('#catalogView [data-category].active');
  if(!active||active.dataset.category==='all')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();rerouteBrandClick(target,name,kind);
},true);

/* ---------- discoverable shortcut to the existing cart ---------- */
let cartButton=null,lastCount=0,cartSyncTimer=0;
function readCart(){
  try{
    const raw=JSON.parse(localStorage.getItem(cartKey())||'{}')||{};
    return Object.values(raw).reduce((acc,row)=>{
      const q=Math.max(0,Number(row?.quantity||0));acc.count+=q;acc.total+=q*Number(row?.price||0);return acc;
    },{count:0,total:0});
  }catch{return{count:0,total:0};}
}
function currency(){try{return cachedPayload()?.account?.currency||'USD'}catch{return'USD';}}
function money(value){try{return new Intl.NumberFormat('es-EC',{style:'currency',currency:currency(),minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0));}catch{return`$${Number(value||0).toFixed(2)}`;}}
function cartMarkup(){return `<button type="button" id="hm112Cart" class="hm112-cart" hidden aria-label="Abrir carrito"><span class="hm112-cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 4h2l2 12h10l3-8H6"/><circle cx="9" cy="20" r="1.45"/><circle cx="17" cy="20" r="1.45"/></svg><b data-hm112-count>0</b></span><span class="hm112-cart-copy"><strong>Ver carrito</strong><small data-hm112-label>0 productos</small></span><span class="hm112-cart-total" data-hm112-total>$0.00</span></button>`;}
function ensureCart(){
  if(cartButton?.isConnected)return cartButton;if(!$('.v10-app'))return null;
  document.body.insertAdjacentHTML('beforeend',cartMarkup());cartButton=$('#hm112Cart');
  cartButton?.addEventListener('click',()=>{const real=$('.v10-nav [data-view="cart"]');if(real){real.click();setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),60);}});
  return cartButton;
}
function syncCart(){
  cartSyncTimer=0;const btn=ensureCart();if(!btn)return;
  const {count,total}=readCart(),onCart=$('.v10-nav [data-view="cart"].active');
  btn.hidden=count<=0||Boolean(onCart);
  btn.querySelector('[data-hm112-count]').textContent=String(count);
  btn.querySelector('[data-hm112-label]').textContent=`${count} ${count===1?'producto':'productos'}`;
  btn.querySelector('[data-hm112-total]').textContent=money(total);
  btn.setAttribute('aria-label',`Abrir carrito. ${count} ${count===1?'producto':'productos'}, total ${money(total)}`);
  if(count>lastCount){btn.classList.remove('hm112-bump');void btn.offsetWidth;btn.classList.add('hm112-bump');}
  lastCount=count;
}
function scheduleCart(delay=40){clearTimeout(cartSyncTimer);cartSyncTimer=setTimeout(syncCart,delay);}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-add],[data-minus],[data-view],[data-cart],[data-remove]')){scheduleCart(30);setTimeout(syncCart,140);}},true);
window.addEventListener('storage',e=>{if(e.key===cartKey())scheduleCart(0)});

/* ---------- lifecycle ---------- */
function sync(){ensureHeroGuard();scanImages();scheduleCart(0);}
function boot(){sync();warmPayload(cachedPayload());warmBrands();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('pageshow',boot);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)boot();});
new MutationObserver(records=>{
  let images=false,hero=false,cart=false;
  for(const r of records)for(const node of r.addedNodes){
    if(node.nodeType!==1)continue;
    if(node instanceof HTMLImageElement||node.querySelector?.('img'))images=true;
    if(node.matches?.('#homeView,.hm109-image-slide,.hm109-hero-image')||node.querySelector?.('#homeView .hm109-hero-image'))hero=true;
    if(node.matches?.('.v10-app,.v10-nav')||node.querySelector?.('.v10-app,.v10-nav'))cart=true;
  }
  if(images)scanImages();if(hero)ensureHeroGuard();if(cart)scheduleCart(0);
}).observe(document.documentElement,{childList:true,subtree:true});

/* Absolute fallback: show the app without the legacy carousel rather than leave a blank screen. */
heroTimer=setTimeout(()=>{if(!root.classList.contains('hm112-ready'))markReady(true);},4200);
})();
