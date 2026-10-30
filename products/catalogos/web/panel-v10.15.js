/* Hakuna Panel 10.15 — inventory review, reliable promos and safe order confirmation. */
(()=>{
'use strict';
if(window.__hm115Panel)return;window.__hm115Panel=true;
if(!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const parse=i=>{try{return typeof i?.body==='string'?JSON.parse(i.body):null}catch{return null}};
const baseFetch=window.fetch.bind(window);
const products=new Map();let orders=[],activeProductId='',inventory=null,uiRaf=0,lastReminder=0;
const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug()}`)||'';
const apiHeaders=()=>({'Content-Type':'application/json','X-Client-Version':C.version||'10.15.0','X-Provider-Session':token()});
function toast(msg,type=''){const e=document.createElement('div');e.className=`hm115-toast ${type}`;e.textContent=msg;document.body.append(e);requestAnimationFrame(()=>e.classList.add('show'));setTimeout(()=>{e.classList.remove('show');setTimeout(()=>e.remove(),180)},2800)}
function remember(payload){if(Array.isArray(payload?.products))payload.products.forEach(p=>products.set(String(p.id),p));if(Array.isArray(payload?.orders))orders=payload.orders;if(activeProductId&&inventory&&!inventory.dirty){const baseQuantity=inventory.baseQuantity;inventory=inventoryFor(activeProductId);inventory.baseQuantity=baseQuantity}scheduleUi()}
function inventoryFor(id){const p=products.get(String(id));const initialized=p?.stock_initialized===true||p?.stock_tracking===true;return{productId:id||'',initialized,tracking:initialized?p?.stock_tracking===true:false,baseQuantity:p?.stock_quantity==null?null:Number(p.stock_quantity),dirty:false}}
function setActive(id){activeProductId=id||'';inventory=inventoryFor(activeProductId);[40,100,220].forEach(ms=>setTimeout(scheduleUi,ms))}
function ensureInventory(){if(!inventory)inventory=inventoryFor(activeProductId);return inventory}
function syncPromoLocal(row){if(!row)return;const p=(window.__hm111Presentations||[]).find(x=>String(x.id)===String(row.dataset.id));const on=$('[data-hm-promo]',row),price=$('[data-hm-promo-price]',row),label=$('[data-hm-promo-label]',row),fields=$('.hm111-promo-fields',row);if(fields)fields.hidden=!on?.checked;if(!p)return;p.promo_active=Boolean(on?.checked);p.promo_price=price?.value===''||price?.value==null?null:Number(price.value);p.promo_label=label?.value?.trim()||'Oferta'}
function syncInventoryUi(){
  const modal=$('#productModal');if(!modal||modal.hidden||!modal.classList.contains('visible'))return;
  const s=ensureInventory(),track=$('#hm114Track'),input=$('#hm114Track input'),old=$('#v5StockTracking');if(!track||!input||!old)return;
  const visual=s.initialized?s.tracking:false;input.checked=visual;old.checked=visual;
  old.dataset.hm115Initialized=s.initialized?'1':'0';track.classList.toggle('hm115-pending',!s.initialized);track.classList.toggle('hm115-off',s.initialized&&!s.tracking);
  const small=$('small',track);if(small){const text=!s.initialized?'Pendiente de configurar · ingresa una cantidad o activa el control.':s.tracking?'Activo · no permitirá crear pedidos por encima de lo disponible.':'Desactivado · este producto no limita pedidos por inventario.';if(small.textContent!==text)small.textContent=text}
  let badge=$('.hm115-inventory-state',track);if(!badge){badge=document.createElement('em');badge.className='hm115-inventory-state';$('span',track)?.append(badge)}
  if(badge){const next=!s.initialized?'POR REVISAR':s.tracking?'CONTROL ACTIVO':'SIN CONTROL';if(badge.textContent!==next)badge.textContent=next}
}
function decorateProductRows(){
  $$('#adminProductList .admin-product').forEach(row=>{const edit=$('[data-edit-product]',row),id=edit?.dataset.editProduct,p=products.get(String(id||''));if(!p)return;const copy=$('.admin-product__copy',row);let b=$('.hm115-review-badge',row);const pending=p.stock_initialized!==true&&p.stock_tracking!==true;if(pending&&!b){b=document.createElement('span');b.className='hm115-review-badge';b.textContent='Inventario por revisar';copy?.append(b)}else if(!pending)b?.remove();let availability=$('.hm115-availability',row);if(p.stock_tracking&&Number.isFinite(Number(p.reserved_quantity))&&document.documentElement.dataset.hmInventoryPolicy==='delivered'){if(!availability){availability=document.createElement('small');availability.className='hm115-availability';copy?.append(availability)}const text=`Físico: ${Number(p.stock_quantity||0)} · Reservado: ${Number(p.reserved_quantity||0)} · Disponible: ${Number(p.available_stock||0)}`;if(availability.textContent!==text)availability.textContent=text}else availability?.remove()})
}
function pendingOrders(){return orders.filter(o=>o.status==='new')}
function ensurePendingChip(){
  let chip=$('#hm115PendingChip');const count=pendingOrders().length;if(!count){chip?.remove();return}
  if(!chip){chip=document.createElement('button');chip.id='hm115PendingChip';chip.type='button';chip.innerHTML='<b></b><span>Pedidos pendientes</span>';chip.onclick=()=>document.querySelector('[data-nav="orders"]')?.click();document.body.append(chip)}
  const cb=$('b',chip),cs=$('span',chip),bt=String(count),st=`${count} pedido${count===1?' pendiente':'s pendientes'}`;if(cb&&cb.textContent!==bt)cb.textContent=bt;if(cs&&cs.textContent!==st)cs.textContent=st
}
function notifyPending(){const list=pendingOrders();if(window.__hakunaSyntheticPreview||!list.length||!('Notification'in window)||Notification.permission!=='granted')return;const now=Date.now();if(now-lastReminder<5*60*1000)return;lastReminder=now;try{const first=list[0],n=new Notification(`${list.length} pedido${list.length===1?' pendiente':'s pendientes'}`,{body:`${first.customer_business||first.customer_name||'Cliente'} · ${first.order_number}. Confirma o rechaza para cerrar el pedido.`,icon:C.brandLogoUrl||'/assets/brand-mark.svg',tag:'hakuna-pending-orders',renotify:true});n.onclick=()=>{n.close();window.focus();const target=new URL("/panel",location.origin);if(first.id)target.searchParams.set("order",String(first.id));location.assign(target.href)}}catch{}}
function shortageText(payload){const s=Array.isArray(payload?.shortages)?payload.shortages:[];if(!s.length)return payload?.message||'El stock cambió y el pedido no pudo confirmarse.';return s.map(x=>`${x.product_name}: necesita ${x.requested}, quedan ${x.available}`).join(' · ')}
async function changeOrder(order,status,btn){if(!order?.id)return;const original=btn?.textContent||'';if(btn){btn.disabled=true;btn.textContent=status==='confirmed'?'Confirmando…':'Rechazando…'}try{const r=await baseFetch(C.apiUrl,{method:'POST',headers:apiHeaders(),body:JSON.stringify({action:'update_order_status',slug:slug(),order_id:order.id,status})});const p=await r.json().catch(()=>({}));if(!r.ok){if(r.status===409||p.error==='insufficient_stock'||p.error==='stock_changed'){const msg=shortageText(p);const box=$('#hm115OrderStockError');if(box){box.hidden=false;box.textContent=msg}toast(`No se confirmó: ${msg}`,'error');return}throw new Error(p.error||'update_failed')}order.status=status;const idx=orders.findIndex(o=>String(o.id)===String(order.id));if(idx>=0)orders[idx]={...orders[idx],status};toast(status==='confirmed'?'Pedido confirmado · inventario ya reservado':'Pedido rechazado');ensurePendingChip();$('#refreshBtn')?.click();setTimeout(enhanceOrderModal,180)}catch{toast('No pudimos actualizar el pedido','error')}finally{if(btn){btn.disabled=false;btn.textContent=original}}}
function enhanceOrderModal(){ /* Las acciones del pedido están unificadas en panel.js. */ }
function scheduleUi(){if(uiRaf)return;uiRaf=requestAnimationFrame(()=>{uiRaf=0;syncInventoryUi();decorateProductRows();ensurePendingChip();enhanceOrderModal()})}
function currentStockState(){
  const s=ensureInventory(),old=$('#v5StockTracking'),q=$('#v5StockQuantity'),low=$('#v5LowThreshold'),base=$('#v5BaseUnit');
  if(!old||!q)return null;
  return {stock_tracking:s.initialized?s.tracking:false,stock_initialized:s.initialized,stock_quantity:Math.max(0,Math.trunc(Number(q.value||0))),low_stock_threshold:Math.max(0,Math.trunc(Number(low?.value||5))),base_unit:base?.value?.trim()||'unidad',allow_item_note:$('#v5AllowNote')?.checked!==false};
}
async function saveInventoryState(productId){
  const s=ensureInventory(),current=currentStockState();if(!productId||!current)return false;
  if(s.productId&&s.baseQuantity===null)throw new Error('stock_snapshot_missing');
  const body={action:'save_stock',slug:slug(),product_id:productId,...current};
  if(s.productId)body.expected_stock_quantity=s.baseQuantity;
  const r=await baseFetch(C.apiUrl,{method:'POST',headers:apiHeaders(),body:JSON.stringify(body)}),p=await r.json().catch(()=>({}));if(!r.ok){if(p.error==='stock_conflict')throw new Error('stock_conflict');return false}if(p.product){products.set(String(productId),{...(products.get(String(productId))||{}),...p.product});s.initialized=p.product.stock_initialized===true;s.tracking=p.product.stock_tracking===true;s.baseQuantity=Number(p.product.stock_quantity);s.dirty=false}return Boolean(p.product&&Boolean(p.product.stock_initialized)===Boolean(body.stock_initialized)&&Boolean(p.product.stock_tracking)===Boolean(body.stock_tracking)&&Number(p.product.stock_quantity)===body.stock_quantity)
}
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'',body=url===C.apiUrl?parse(init):null,isSave=body?.action==='save_product'&&$('#productModal')&&!$('#productModal').hidden;
  let nextInit=init;
  if(isSave&&body.product_operation_id){
    const initialStock=currentStockState(),snapshot=ensureInventory(),id=String(body.product?.id||'');
    if(!initialStock||(id&&(String(snapshot.productId)!==id||snapshot.baseQuantity===null)))return new Response(JSON.stringify({error:'inventory_not_ready'}),{status:409,headers:{'Content-Type':'application/json'}});
    nextInit={...init,body:JSON.stringify({...body,initial_stock:initialStock,...(id?{expected_stock_quantity:snapshot.baseQuantity}:{})})};
  }
  const res=await baseFetch(input,nextInit);
  if(url===C.apiUrl&&body&&res.ok&&['provider_bootstrap','master_bootstrap'].includes(String(body.action))){try{remember(await res.clone().json())}catch{}}
  if(isSave&&res.ok){try{const payload=await res.clone().json();if(payload.atomic===true)return res;const id=String(payload.id||body?.product?.id||activeProductId||'');if(id){const ok=await saveInventoryState(id);if(!ok){toast('El producto se guardó, pero no pudimos verificar el inventario.','error');return new Response(JSON.stringify({error:'inventory_verification_failed'}),{status:409,headers:{'Content-Type':'application/json'}})}}}catch(error){toast(error?.message==='stock_conflict'?'El producto se guardó, pero el inventario cambió. Cierra el editor, actualiza y revisa las cantidades.':'El producto se guardó, pero no pudimos verificar el inventario. Actualiza antes de reintentar.','error');return new Response(JSON.stringify({error:'inventory_verification_failed'}),{status:409,headers:{'Content-Type':'application/json'}})}}
  return res;
};
document.addEventListener('click',e=>{const edit=e.target.closest?.('[data-edit-product]');if(edit){setActive(edit.dataset.editProduct||'');return}if(e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]')){setActive('');return}if(e.target.closest?.('[data-open-order]'))setTimeout(enhanceOrderModal,80)},true);
document.addEventListener('change',e=>{const t=e.target;if(t?.matches?.('#hm114Track input')){const s=ensureInventory();s.initialized=true;s.tracking=t.checked;s.dirty=true;const old=$('#v5StockTracking');if(old){old.checked=s.tracking;old.dispatchEvent(new Event('change',{bubbles:true}))}scheduleUi()}if(t?.matches?.('[data-hm-promo]')){const row=t.closest('.v5-presentation-row');syncPromoLocal(row);setTimeout(()=>{syncPromoLocal(row);scheduleUi()},0)}},true);
document.addEventListener('input',e=>{const t=e.target;if(t?.matches?.('#hm111Packs,#hm111Loose,#v5StockQuantity')){const s=ensureInventory();s.initialized=true;s.tracking=true;s.dirty=true;const old=$('#v5StockTracking');if(old){old.checked=true;old.dispatchEvent(new Event('change',{bubbles:true}))}scheduleUi()}if(t?.matches?.('[data-hm-promo-price],[data-hm-promo-label]'))syncPromoLocal(t.closest('.v5-presentation-row'))},true);
window.addEventListener('hm111:presentations',()=>setTimeout(scheduleUi,0));
new MutationObserver(scheduleUi).observe(document.documentElement,{childList:true,subtree:true});
const start=()=>{scheduleUi();setInterval(()=>{ensurePendingChip();notifyPending()},60*1000);setTimeout(notifyPending,5*60*1000);document.documentElement.dataset.hmPanelInventory='10.15.0'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
