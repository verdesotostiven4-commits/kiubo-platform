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
function remember(payload){if(Array.isArray(payload?.products))payload.products.forEach(p=>products.set(String(p.id),p));if(Array.isArray(payload?.orders))orders=payload.orders;if(activeProductId&&inventory&&!inventory.dirty)inventory=inventoryFor(activeProductId);scheduleUi()}
function inventoryFor(id){const p=products.get(String(id));const initialized=p?.stock_initialized===true||p?.stock_tracking===true;return{productId:id||'',initialized,tracking:initialized?p?.stock_tracking===true:false,dirty:false}}
function setActive(id){activeProductId=id||'';inventory=inventoryFor(activeProductId);[40,100,220].forEach(ms=>setTimeout(scheduleUi,ms))}
function ensureInventory(){if(!inventory)inventory=inventoryFor(activeProductId);return inventory}
function syncPromoLocal(row){if(!row)return;const p=(window.__hm111Presentations||[]).find(x=>String(x.id)===String(row.dataset.id));const on=$('[data-hm-promo]',row),price=$('[data-hm-promo-price]',row),label=$('[data-hm-promo-label]',row),fields=$('.hm111-promo-fields',row);if(fields)fields.hidden=!on?.checked;if(!p)return;p.promo_active=Boolean(on?.checked);p.promo_price=price?.value===''||price?.value==null?null:Number(price.value);p.promo_label=label?.value?.trim()||'Oferta'}
function syncInventoryUi(){
  const modal=$('#productModal');if(!modal||modal.hidden||!modal.classList.contains('visible'))return;
  const s=ensureInventory(),track=$('#hm114Track'),input=$('#hm114Track input'),old=$('#v5StockTracking');if(!track||!input||!old)return;
  const visual=s.initialized?s.tracking:true;input.checked=visual;old.checked=s.initialized?s.tracking:false;
  old.dataset.hm115Initialized=s.initialized?'1':'0';track.classList.toggle('hm115-pending',!s.initialized);track.classList.toggle('hm115-off',s.initialized&&!s.tracking);
  const small=$('small',track);if(small){const text=!s.initialized?'Pendiente de conteo · al registrar la primera cantidad quedará protegido por stock.':s.tracking?'Activo · no permitirá crear pedidos por encima de lo disponible.':'Desactivado · este producto no limita pedidos por inventario.';if(small.textContent!==text)small.textContent=text}
  let badge=$('.hm115-inventory-state',track);if(!badge){badge=document.createElement('em');badge.className='hm115-inventory-state';$('span',track)?.append(badge)}
  if(badge){const next=!s.initialized?'POR REVISAR':s.tracking?'CONTROL ACTIVO':'SIN CONTROL';if(badge.textContent!==next)badge.textContent=next}
}
function decorateProductRows(){
  $$('#adminProductList .admin-product').forEach(row=>{const edit=$('[data-edit-product]',row),id=edit?.dataset.editProduct,p=products.get(String(id||''));if(!p)return;let b=$('.hm115-review-badge',row);const pending=p.stock_initialized!==true&&p.stock_tracking!==true;if(pending&&!b){b=document.createElement('span');b.className='hm115-review-badge';b.textContent='Inventario por revisar';$('.admin-product__copy',row)?.append(b)}else if(!pending)b?.remove()})
}
function pendingOrders(){return orders.filter(o=>o.status==='new')}
function ensurePendingChip(){if(document.documentElement.dataset.hmSimpleOrders==='1'){ $('#hm115PendingChip')?.remove();return }
  let chip=$('#hm115PendingChip');const count=pendingOrders().length;if(!count){chip?.remove();return}
  if(!chip){chip=document.createElement('button');chip.id='hm115PendingChip';chip.type='button';chip.innerHTML='<b></b><span>Pedidos pendientes</span>';chip.onclick=()=>document.querySelector('[data-nav="orders"]')?.click();document.body.append(chip)}
  const cb=$('b',chip),cs=$('span',chip),bt=String(count),st=`${count} pedido${count===1?' pendiente':'s pendientes'}`;if(cb&&cb.textContent!==bt)cb.textContent=bt;if(cs&&cs.textContent!==st)cs.textContent=st
}
function notifyPending(){if(document.documentElement.dataset.hmSimpleOrders==='1')return;const list=pendingOrders();if(!list.length||!('Notification'in window)||Notification.permission!=='granted')return;const now=Date.now();if(now-lastReminder<5*60*1000)return;lastReminder=now;try{const first=list[0],n=new Notification(`${list.length} pedido${list.length===1?' pendiente':'s pendientes'}`,{body:`${first.customer_business||first.customer_name||'Cliente'} · ${first.order_number}. Confirma o rechaza para cerrar el pedido.`,icon:C.brandLogoUrl||'/assets/brand-mark.svg',tag:'hakuna-pending-orders',renotify:true});n.onclick=()=>{window.focus();document.querySelector('[data-nav="orders"]')?.click()}}catch{}}
function shortageText(payload){const s=Array.isArray(payload?.shortages)?payload.shortages:[];if(!s.length)return payload?.message||'El stock cambió y el pedido no pudo confirmarse.';return s.map(x=>`${x.product_name}: necesita ${x.requested}, quedan ${x.available}`).join(' · ')}
async function changeOrder(order,status,btn){if(!order?.id)return;const original=btn?.textContent||'';if(btn){btn.disabled=true;btn.textContent=status==='confirmed'?'Confirmando…':'Rechazando…'}try{const r=await baseFetch(C.apiUrl,{method:'POST',headers:apiHeaders(),body:JSON.stringify({action:'update_order_status',slug:slug(),order_id:order.id,status})});const p=await r.json().catch(()=>({}));if(!r.ok){if(r.status===409||p.error==='insufficient_stock'||p.error==='stock_changed'){const msg=shortageText(p);const box=$('#hm115OrderStockError');if(box){box.hidden=false;box.textContent=msg}toast(`No se confirmó: ${msg}`,'error');return}throw new Error(p.error||'update_failed')}order.status=status;const idx=orders.findIndex(o=>String(o.id)===String(order.id));if(idx>=0)orders[idx]={...orders[idx],status};toast(status==='confirmed'?'Pedido confirmado · inventario ya reservado':'Pedido rechazado');ensurePendingChip();$('#refreshBtn')?.click();setTimeout(enhanceOrderModal,180)}catch{toast('No pudimos actualizar el pedido','error')}finally{if(btn){btn.disabled=false;btn.textContent=original}}}
function enhanceOrderModal(){if(document.documentElement.dataset.hmSimpleOrders==='1')return;
  const content=$('#orderModalContent'),title=$('#orderModalTitle')?.textContent?.trim();if(!content||!title)return;const order=orders.find(o=>String(o.order_number)===title);if(!order)return;
  let card=$('#hm115OrderGuard',content);if(!card){card=document.createElement('section');card.id='hm115OrderGuard';card.className='hm115-order-guard';card.innerHTML='<div class="hm115-order-copy"><small>CONTROL DE PEDIDO</small><b></b><p></p></div><div id="hm115OrderStockError" class="hm115-order-error" hidden></div><div class="hm115-order-actions"></div>';content.prepend(card)}
  const b=$('.hm115-order-copy b',card),p=$('.hm115-order-copy p',card),actions=$('.hm115-order-actions',card),err=$('#hm115OrderStockError',card);if(card.dataset.status===String(order.status))return;card.dataset.status=String(order.status);if(err)err.hidden=true;
  if(order.status==='new'){b.textContent='Pedido nuevo · stock reservado';p.textContent='El inventario ya quedó reservado al crear el pedido. Confirma para seguir o rechaza para devolver ese stock automáticamente.';actions.innerHTML='<button type="button" class="hm115-confirm">Confirmar pedido</button><button type="button" class="hm115-reject">Rechazar</button>';$('.hm115-confirm',actions).onclick=e=>changeOrder(order,'confirmed',e.currentTarget);$('.hm115-reject',actions).onclick=e=>changeOrder(order,'cancelled',e.currentTarget)}
  else if(['confirmed','preparing','dispatched','delivered'].includes(order.status)){b.textContent=order.status==='confirmed'?'Pedido confirmado':'Pedido en proceso';p.textContent='El inventario se reservó desde que llegó el pedido. Confirmarlo no vuelve a descontar; si se cancela, el stock se devuelve automáticamente.';actions.innerHTML='<span class="hm115-committed">Inventario reservado</span>'}
  else{b.textContent='Pedido cancelado';p.textContent='Este pedido no mantiene inventario comprometido.';actions.innerHTML=''}
}
function scheduleUi(){if(uiRaf)return;uiRaf=requestAnimationFrame(()=>{uiRaf=0;syncInventoryUi();decorateProductRows();ensurePendingChip();enhanceOrderModal()})}
async function saveInventoryState(productId){
  const s=ensureInventory(),old=$('#v5StockTracking'),q=$('#v5StockQuantity'),low=$('#v5LowThreshold'),base=$('#v5BaseUnit');if(!productId||!old||!q)return true;
  const body={action:'save_stock',slug:slug(),product_id:productId,stock_tracking:s.initialized?s.tracking:false,stock_initialized:s.initialized,stock_quantity:Math.max(0,Math.trunc(Number(q.value||0))),low_stock_threshold:Math.max(0,Math.trunc(Number(low?.value||5))),base_unit:base?.value?.trim()||'unidad',allow_item_note:$('#v5AllowNote')?.checked!==false};
  const r=await baseFetch(C.apiUrl,{method:'POST',headers:apiHeaders(),body:JSON.stringify(body)}),p=await r.json().catch(()=>({}));if(!r.ok)return false;if(p.product){products.set(String(productId),{...(products.get(String(productId))||{}),...p.product});s.initialized=p.product.stock_initialized===true;s.tracking=p.product.stock_tracking===true;s.dirty=false}return Boolean(p.product&&Boolean(p.product.stock_initialized)===Boolean(body.stock_initialized)&&Boolean(p.product.stock_tracking)===Boolean(body.stock_tracking))
}
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'',body=url===C.apiUrl?parse(init):null,isSave=body?.action==='save_product'&&$('#productModal')&&!$('#productModal').hidden;
  const res=await baseFetch(input,init);
  if(url===C.apiUrl&&body&&res.ok&&['provider_bootstrap','master_bootstrap'].includes(String(body.action))){try{remember(await res.clone().json())}catch{}}
  if(isSave&&res.ok){try{const payload=await res.clone().json(),id=String(payload.id||body?.product?.id||activeProductId||'');if(id){const ok=await saveInventoryState(id);if(!ok){toast('El producto se guardó, pero no pudimos verificar el inventario.','error');return new Response(JSON.stringify({error:'inventory_verification_failed'}),{status:409,headers:{'Content-Type':'application/json'}})}}}catch{return new Response(JSON.stringify({error:'inventory_verification_failed'}),{status:409,headers:{'Content-Type':'application/json'}})}}
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
