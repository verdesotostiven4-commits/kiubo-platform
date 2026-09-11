(()=>{
'use strict';
if(window.__kiuboPanelStability1033)return;window.__kiuboPanelStability1033=true;
if(!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const upstreamFetch=window.fetch.bind(window);
const snapshot={products:[],orders:[],customers:[]};
const previousValues=new Map();
let healTimer=0,lastRecovery=0;

const parseBody=init=>{try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}};
function cacheBootstrap(payload){
  if(!payload||typeof payload!=='object')return;
  if(Array.isArray(payload.products))snapshot.products=payload.products;
  if(Array.isArray(payload.orders))snapshot.orders=payload.orders;
  if(Array.isArray(payload.customers))snapshot.customers=payload.customers;
}
window.fetch=async(input,init={})=>{
  const response=await upstreamFetch(input,init);
  const url=typeof input==='string'?input:input?.url||'';
  const body=url===C.apiUrl?parseBody(init):null;
  if(response.ok&&body&&['provider_bootstrap','master_bootstrap'].includes(body.action)){
    response.clone().json().then(cacheBootstrap).catch(()=>{});
  }
  return response;
};

function statusOf(product){if(product?.archived_at)return'archived';if(product?.visible===false)return'hidden';return product?.status||'available'}
function expectedProductRows(){
  const status=$('[data-product-filter].active')?.dataset.productFilter||'all';
  const category=$('[data-v75-category].active')?.dataset.v75Category||'all';
  return snapshot.products.filter(product=>{
    const s=statusOf(product);
    const statusOk=status==='all'?!product.archived_at:s===status;
    const categoryOk=category==='all'||String(product.category_id)===String(category);
    return statusOk&&categoryOk;
  }).length;
}
function expectedOrderRows(){
  const filter=$('[data-order-filter].active')?.dataset.orderFilter||'open';
  return snapshot.orders.filter(order=>{
    if(filter==='open')return !['delivered','cancelled'].includes(order.status);
    if(filter==='new')return order.status==='new';
    if(filter==='done')return ['delivered','cancelled'].includes(order.status);
    return true;
  }).length;
}
function visibleProductRows(){return $$('#adminProductList .admin-product').filter(row=>!row.hidden).length}
function rowCount(id){
  if(id==='productSearch')return visibleProductRows();
  if(id==='customerSearch')return $$('#customerList .customer-card').length;
  if(id==='orderSearch')return $$('#adminOrderList .order-card').length;
  return 0;
}
function expectedCount(id){
  if(id==='productSearch')return expectedProductRows();
  if(id==='customerSearch')return snapshot.customers.length;
  if(id==='orderSearch')return expectedOrderRows();
  return 0;
}
function recoverIfStale(id){
  const input=$(`#${id}`);if(!input||input.value.trim())return;
  const expected=expectedCount(id);if(!expected&&id!=='customerSearch'&&id!=='orderSearch')return;
  const actual=rowCount(id);
  if(actual===expected)return;
  const now=Date.now();if(now-lastRecovery<1400)return;
  const refresh=$('#refreshBtn');if(!refresh||refresh.classList.contains('spinning')||!navigator.onLine)return;
  lastRecovery=now;
  refresh.click();
}
function scheduleRecovery(id){
  clearTimeout(healTimer);
  healTimer=setTimeout(()=>recoverIfStale(id),360);
  setTimeout(()=>recoverIfStale(id),850);
}
function emitInput(input){input.dispatchEvent(new Event('input',{bubbles:true,composed:true}))}
function clearSearch(input){
  if(!input)return;
  input.value='';
  previousValues.set(input.id,'');
  syncClearButton(input);
  emitInput(input);
  input.dispatchEvent(new Event('change',{bubbles:true}));
  input.focus({preventScroll:true});
  scheduleRecovery(input.id);
}
function syncClearButton(input){
  const wrap=input?.closest?.('.admin-search');if(!wrap)return;
  const button=$('.v1033-search-clear',wrap);if(button)button.hidden=!input.value;
}
function enhanceSearch(id){
  const input=$(`#${id}`);if(!input||input.dataset.v1033Search==='1')return;
  input.dataset.v1033Search='1';previousValues.set(id,input.value||'');
  const wrap=input.closest('.admin-search');
  if(wrap){
    wrap.classList.add('v1033-search-ready');
    let button=$('.v1033-search-clear',wrap);
    if(!button){
      button=document.createElement('button');button.type='button';button.className='v1033-search-clear';button.setAttribute('aria-label','Limpiar búsqueda');button.textContent='×';button.hidden=!input.value;wrap.append(button);
      button.addEventListener('pointerdown',event=>event.preventDefault());
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();clearSearch(input)});
    }
  }
  input.addEventListener('input',()=>{
    const before=previousValues.get(id)||'';const current=input.value||'';previousValues.set(id,current);syncClearButton(input);
    if(before&& !current.trim())scheduleRecovery(id);
  },true);
  input.addEventListener('search',()=>{
    previousValues.set(id,input.value||'');syncClearButton(input);
    queueMicrotask(()=>{emitInput(input);if(!input.value.trim())scheduleRecovery(id)});
  });
  input.addEventListener('change',()=>{if(!input.value.trim()){emitInput(input);scheduleRecovery(id)}},true);
  input.addEventListener('keydown',event=>{if(event.key==='Escape'&&input.value){event.preventDefault();event.stopPropagation();clearSearch(input)}},true);
}

function ensureMobileCustomersNav(){
  const nav=$('.bottom-nav');if(!nav)return;
  if(!nav.querySelector('[data-nav="customers"]')){
    const business=nav.querySelector('[data-nav="business"]');
    const button=document.createElement('button');button.type='button';button.dataset.nav='customers';button.innerHTML='<svg class="icon"><use href="#i-users"/></svg><span>Clientes</span>';
    if(business)nav.insertBefore(button,business);else nav.append(button);
  }
  nav.classList.add('v1033-six-nav');
}
function earlySetup(){
  ensureMobileCustomersNav();
  ['productSearch','orderSearch','customerSearch'].forEach(enhanceSearch);
}
function lateSetup(){
  earlySetup();
  const app=$('#adminApp');if(app&&app.dataset.v1033Observed!=='1'){
    app.dataset.v1033Observed='1';new MutationObserver(()=>['productSearch','orderSearch','customerSearch'].forEach(id=>{const input=$(`#${id}`);if(input)syncClearButton(input)})).observe(app,{childList:true,subtree:true});
  }
}

earlySetup();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lateSetup,{once:true});else lateSetup();
window.addEventListener('online',()=>setTimeout(()=>{['productSearch','orderSearch','customerSearch'].forEach(id=>{const input=$(`#${id}`);if(input&&!input.value.trim())recoverIfStale(id)})},250));
})();
