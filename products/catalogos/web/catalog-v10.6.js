/* Hakuna Matata Catalog 10.6 — checkout persistence, retry-safe orders + native interaction polish. */
(()=>{
'use strict';
if(window.__hakunaCatalog106)return;window.__hakunaCatalog106=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s);
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const CUSTOMER_KEY=`kiubo-v10-customer:${slug}`;
const ORDER_RETRY_KEY=`kiubo-v106-order-retry:${slug}`;
const read=()=>{try{return JSON.parse(localStorage.getItem(CUSTOMER_KEY)||'{}')||{}}catch{return{}}};
const write=v=>{try{localStorage.setItem(CUSTOMER_KEY,JSON.stringify(v))}catch{}};
const fieldMap={cBusiness:'business',cName:'name',cPhone:'phone',cAddress:'address',cNotes:'notes'};
function saveDraft(){const draft={...read()};for(const [id,key] of Object.entries(fieldMap)){const el=$(`#${id}`);if(el)draft[key]=el.value}write(draft)}
function bindCheckoutDraft(){const form=$('#checkoutForm');if(!form||form.dataset.hm106Draft)return;form.dataset.hm106Draft='1';form.addEventListener('input',e=>{if(e.target?.id&&fieldMap[e.target.id])saveDraft()},true);form.addEventListener('change',saveDraft,true)}
function syncChoiceBeforeRerender(e){if(e.target.closest?.('[data-delivery],[data-payment]'))saveDraft()}
document.addEventListener('pointerdown',syncChoiceBeforeRerender,true);
document.addEventListener('touchstart',syncChoiceBeforeRerender,{capture:true,passive:true});

/* Reuse the same idempotency key only for an identical retry. If the first request reached the server but the response was lost, a retry cannot create a duplicate order. */
const priorFetch=window.fetch.bind(window);
const retryRead=()=>{try{return JSON.parse(sessionStorage.getItem(ORDER_RETRY_KEY)||'null')}catch{return null}};
const retryWrite=v=>{try{v?sessionStorage.setItem(ORDER_RETRY_KEY,JSON.stringify(v)):sessionStorage.removeItem(ORDER_RETRY_KEY)}catch{}};
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  if(url!==C.apiUrl||typeof init?.body!=='string')return priorFetch(input,init);
  let body;try{body=JSON.parse(init.body)}catch{return priorFetch(input,init)}
  if(body?.action!=='create_order')return priorFetch(input,init);
  const signature=JSON.stringify({items:body.items||[],customer:body.customer||{},payment_method:body.payment_method||''});
  const saved=retryRead(),fresh=saved&&Date.now()-Number(saved.at||0)<15*60*1000&&saved.signature===signature&&saved.key;
  const key=fresh?saved.key:body.idempotency_key;
  if(key){body={...body,idempotency_key:key};retryWrite({key,signature,at:Date.now()})}
  try{
    const res=await priorFetch(input,{...init,body:JSON.stringify(body)});
    if(res.ok||(res.status>=400&&res.status<500&&res.status!==429))retryWrite(null);
    return res;
  }catch(err){throw err}
};

function animateBadge(id){const el=$(id);if(!el||el.dataset.hm106Observed)return;el.dataset.hm106Observed='1';let last=`${el.hidden}:${el.textContent}`;new MutationObserver(()=>{const next=`${el.hidden}:${el.textContent}`;if(next===last)return;last=next;if(el.hidden||!Number(String(el.textContent).replace(/\D/g,'')))return;el.classList.remove('hm106-badge-pop');void el.offsetWidth;el.classList.add('hm106-badge-pop');setTimeout(()=>el.classList.remove('hm106-badge-pop'),360)}).observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})}
function polishCartBadges(){['#cartBadge','#favBadge','#orderBadge'].forEach(animateBadge)}
function markKeyboardOpen(){const vv=window.visualViewport;if(!vv)return;const sync=()=>document.documentElement.classList.toggle('hm106-keyboard',vv.height<innerHeight*.78);vv.addEventListener('resize',sync,{passive:true});sync()}
function enhance(){bindCheckoutDraft();polishCartBadges();document.documentElement.dataset.hmCatalog='10.6'}
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('pageshow',schedule);document.addEventListener('click',schedule,true);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{markKeyboardOpen();schedule()},{once:true});else{markKeyboardOpen();schedule()}
})();
