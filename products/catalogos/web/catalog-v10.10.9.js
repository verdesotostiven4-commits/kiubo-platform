/* Hakuna Matata 10.10.9 — brand/category handoff + discoverable floating cart. */
(()=>{
'use strict';
if(window.__hakunaCatalog10109)return;window.__hakunaCatalog10109=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const slug=()=>{
  const C=window.KIUBO_CATALOG_CONFIG||{};
  return (new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
};

/*
 * UX rule: selecting a concrete brand always means “show me this brand”,
 * regardless of the category the shopper had selected before.
 * We reset category to Todos first, then hand the original brand click back
 * to the existing catalog runtime. Search suggestions are intentionally excluded.
 */
let brandPassThrough=false;
function equivalentBrandTarget(name,kind){
  const wanted=norm(name);
  const selector=kind==='option'?'#sheetHost [data-brand-option]':'#catalogView [data-brand-chip]';
  return $$(selector).find(el=>{
    if(el.closest?.('#searchSuggestions'))return false;
    const value=kind==='option'?el.dataset.brandOption:el.dataset.brandChip;
    return norm(value||'')===wanted;
  })||null;
}
function rerouteBrandClick(original,name,kind){
  const all=$('#catalogView .v10-category-rail [data-category="all"]')||$('#catalogView [data-category="all"]');
  if(!all)return;
  all.click();
  let tries=0;
  const handoff=()=>{
    const target=(original?.isConnected?original:null)||equivalentBrandTarget(name,kind);
    if(target){
      brandPassThrough=true;
      target.click();
      setTimeout(()=>{brandPassThrough=false},0);
      return;
    }
    if(tries++<16)setTimeout(handoff,30);
  };
  setTimeout(handoff,35);
}
window.addEventListener('click',e=>{
  const target=e.target.closest?.('[data-brand-option],[data-brand-chip]');
  if(!target||target.closest?.('#searchSuggestions'))return;
  if(brandPassThrough){brandPassThrough=false;return}
  const kind=target.hasAttribute('data-brand-option')?'option':'chip';
  const name=(kind==='option'?target.dataset.brandOption:target.dataset.brandChip)||'';
  if(!String(name).trim())return;
  const active=$('#catalogView .v10-category-rail [data-category].active')||$('#catalogView [data-category].active');
  if(!active||active.dataset.category==='all')return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  rerouteBrandClick(target,name,kind);
},true);

/* Floating shortcut to the ONE existing cart. No duplicated cart state. */
let cartButton=null,lastCount=0,cartSyncTimer=0;
function cartKey(){return`kiubo-v10-cart:${slug()}`}
function bootstrapKey(){return`kiubo-v10-bootstrap:${slug()}`}
function readCart(){
  try{
    const raw=JSON.parse(localStorage.getItem(cartKey())||'{}')||{};
    const entries=Object.values(raw);
    return entries.reduce((acc,row)=>{
      const q=Math.max(0,Number(row?.quantity||0));
      acc.count+=q;
      acc.total+=q*Number(row?.price||0);
      return acc;
    },{count:0,total:0});
  }catch{return{count:0,total:0}}
}
function currency(){
  try{return JSON.parse(localStorage.getItem(bootstrapKey())||'null')?.account?.currency||'USD'}catch{return'USD'}
}
function money(value){
  try{return new Intl.NumberFormat('es-EC',{style:'currency',currency:currency(),minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}
  catch{return`$${Number(value||0).toFixed(2)}`}
}
function cartMarkup(){
  return `<button type="button" id="hm10109Cart" class="hm10109-cart" hidden aria-label="Abrir carrito">
    <span class="hm10109-cart-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 4h2l2 12h10l3-8H6"/><circle cx="9" cy="20" r="1.45"/><circle cx="17" cy="20" r="1.45"/></svg><b data-hm-cart-count>0</b></span>
    <span class="hm10109-cart-copy"><strong>Ver carrito</strong><small data-hm-cart-label>0 productos</small></span>
    <span class="hm10109-cart-total" data-hm-cart-total>$0,00</span>
  </button>`;
}
function ensureCart(){
  if(cartButton?.isConnected)return cartButton;
  if(!$('.v10-app'))return null;
  document.body.insertAdjacentHTML('beforeend',cartMarkup());
  cartButton=$('#hm10109Cart');
  cartButton?.addEventListener('click',()=>{
    const real=$('.v10-nav [data-view="cart"]');
    if(real){real.click();setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}),60)}
  });
  return cartButton;
}
function syncCart(){
  cartSyncTimer=0;
  const btn=ensureCart();if(!btn)return;
  const {count,total}=readCart();
  const onCart=$('.v10-nav [data-view="cart"].active');
  btn.hidden=count<=0||Boolean(onCart);
  btn.querySelector('[data-hm-cart-count]').textContent=String(count);
  btn.querySelector('[data-hm-cart-label]').textContent=`${count} ${count===1?'producto':'productos'}`;
  btn.querySelector('[data-hm-cart-total]').textContent=money(total);
  btn.setAttribute('aria-label',`Abrir carrito. ${count} ${count===1?'producto':'productos'}, total ${money(total)}`);
  if(count>lastCount&&lastCount>=0){btn.classList.remove('hm10109-bump');void btn.offsetWidth;btn.classList.add('hm10109-bump')}
  lastCount=count;
}
function scheduleCart(delay=40){
  clearTimeout(cartSyncTimer);
  cartSyncTimer=setTimeout(syncCart,delay);
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-add],[data-minus],[data-view],[data-cart],[data-remove]')){
    scheduleCart(30);setTimeout(syncCart,140);
  }
},true);
window.addEventListener('storage',e=>{if(e.key===cartKey())scheduleCart(0)});
window.addEventListener('pageshow',()=>scheduleCart(0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleCart(0)});

function boot(){ensureCart();syncCart()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,300);setTimeout(boot,900);setTimeout(boot,1800);
new MutationObserver(records=>{
  let relevant=false;
  for(const r of records){
    if(r.type==='childList'&&[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.v10-app,.v10-nav')||n.querySelector?.('.v10-app,.v10-nav')))){relevant=true;break}
  }
  if(relevant)scheduleCart(0);
}).observe(document.documentElement,{childList:true,subtree:true});
})();
