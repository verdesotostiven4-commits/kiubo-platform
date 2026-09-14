/* Hakuna Matata 10.13 — viewport product detail + live cart synchronization. */
(()=>{
'use strict';
if(window.__hakunaCatalog10130)return;window.__hakunaCatalog10130=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const cartKey=()=>`kiubo-v10-cart:${slug()}`;
const bootstrapKey=()=>`kiubo-v10-bootstrap:${slug()}`;
let contextRaf=0,badgeObserver=null,boundBadge=null,lastFloatCount=-1;

function readJSON(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function cartSummary(){
  const raw=readJSON(cartKey(),{})||{};
  return Object.values(raw).reduce((acc,row)=>{
    const q=Math.max(0,Number(row?.quantity||0));
    acc.count+=q;acc.total+=q*Number(row?.price||0);return acc;
  },{count:0,total:0});
}
function currency(){return readJSON(bootstrapKey(),null)?.account?.currency||'USD'}
function money(value){try{return new Intl.NumberFormat('es-EC',{style:'currency',currency:currency(),minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}catch{return`$${Number(value||0).toFixed(2)}`}}

/* Keep the existing floating cart synchronized with the real cart state. */
function syncFloatingCart(){
  const btn=$('#hm112Cart');if(!btn)return false;
  const {count,total}=cartSummary(),onCart=!!$('.v10-nav [data-view="cart"].active');
  const shouldHide=count<=0||onCart;if(btn.hidden!==shouldHide)btn.hidden=shouldHide;
  const countEl=$('[data-hm112-count]',btn),labelEl=$('[data-hm112-label]',btn),totalEl=$('[data-hm112-total]',btn);
  const countText=String(count),labelText=`${count} ${count===1?'producto':'productos'}`,totalText=money(total);
  if(countEl&&countEl.textContent!==countText)countEl.textContent=countText;
  if(labelEl&&labelEl.textContent!==labelText)labelEl.textContent=labelText;
  if(totalEl&&totalEl.textContent!==totalText)totalEl.textContent=totalText;
  btn.setAttribute('aria-label',`Abrir carrito. ${count} ${count===1?'producto':'productos'}, total ${money(total)}`);
  if(lastFloatCount>=0&&count>lastFloatCount){btn.classList.remove('hm113-live');void btn.offsetWidth;btn.classList.add('hm113-live')}
  lastFloatCount=count;
  return true;
}
function bindCartBadge(){
  const badge=$('#cartBadge');
  if(!badge||badge===boundBadge)return;
  badgeObserver?.disconnect();boundBadge=badge;
  badgeObserver=new MutationObserver(()=>{syncFloatingCart();scheduleContext()});
  badgeObserver.observe(badge,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});
  syncFloatingCart();
}

/* Product sheet and cart page get explicit viewport modes; no global route logic is changed. */
function syncContext(){
  contextRaf=0;
  const detail=$('#sheetHost .v102-detail');
  const sheet=detail?.closest('.v10-sheet')||null;
  root.classList.toggle('hm113-product-open',!!detail);
  if(sheet){
    const count=detail.querySelectorAll('.v102-presentation-row').length;
    sheet.dataset.hm113Presentations=String(count);
  }
  const cartFocus=!!$('#cartView.active .v10-cart-lines')&&!!$('#cartView.active #checkoutStart');
  root.classList.toggle('hm113-cart-focus',cartFocus);
  bindCartBadge();
}
function scheduleContext(){if(contextRaf)return;contextRaf=requestAnimationFrame(syncContext)}

window.addEventListener('click',e=>{
  const target=e.target;
  if(target?.closest?.('#detailAdd,[data-add],[data-minus],[data-cart-plus],[data-cart-minus],[data-remove],[data-view]')){
    queueMicrotask(syncFloatingCart);
    requestAnimationFrame(()=>{syncFloatingCart();scheduleContext()});
    setTimeout(()=>{syncFloatingCart();scheduleContext()},40);
  }
},true);
window.addEventListener('pageshow',()=>{syncFloatingCart();scheduleContext()});
window.addEventListener('storage',e=>{if(e.key===cartKey()){syncFloatingCart();scheduleContext()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncFloatingCart();scheduleContext()}});

new MutationObserver(scheduleContext).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden']});
function boot(){syncContext();syncFloatingCart();setTimeout(()=>{bindCartBadge();syncFloatingCart()},0)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
