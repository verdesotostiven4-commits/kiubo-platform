(()=>{
'use strict';
if(window.__hakunaCatalog77)return;window.__hakunaCatalog77=true;
const C=window.KIUBO_CATALOG_CONFIG;if(!C?.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const money=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let data=null,dataPromise=null,batching=false,activeChooser=null;

async function bootstrap(force=false){
  if(data&&!force)return data;if(dataPromise&&!force)return dataPromise;
  dataPromise=fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version},body:JSON.stringify({action:'catalog_bootstrap',slug})}).then(async r=>{const p=await r.json();if(!r.ok)throw new Error(p?.error||'bootstrap_failed');data=p;return p}).finally(()=>dataPromise=null);
  return dataPromise;
}
function product(id){return data?.products?.find(p=>String(p.id)===String(id))||null}
function presentations(id){return (data?.presentations||[]).filter(p=>String(p.product_id)===String(id)&&p.visible!==false).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))}
function brandList(){return [...new Set((data?.products||[]).filter(p=>p.visible!==false&&!p.archived_at).map(p=>String(p.brand||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function icon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>'}
function showToast(msg,type=''){const e=document.createElement('div');e.className=`v77-toast ${type}`;e.textContent=msg;document.body.append(e);requestAnimationFrame(()=>e.classList.add('show'));setTimeout(()=>{e.classList.remove('show');setTimeout(()=>e.remove(),180)},1800)}

function decorateHome(){
  const home=$('#homeView .v7-home');if(!home)return;
  const hero=$('.v7-hero',home);if(hero&&!hero.dataset.v77){hero.dataset.v77='1';hero.classList.add('v77-hero');const art=$('.v7-hero-art',hero),copy=$('.v7-hero-copy',hero);if(art)art.innerHTML='<div class="v77-hero-visual"><span><b>1</b><small>Elige</small></span><i></i><span><b>2</b><small>Combina</small></span><i></i><span><b>3</b><small>Pide</small></span></div>';if(copy){const badge=$('span',copy),h=$('h1',copy),p=$('p',copy),b=$('button',copy);if(badge)badge.textContent='CATÁLOGO MAYORISTA';if(h)h.textContent='Tu pedido, a tu manera.';if(p)p.textContent='Compra por unidad, caja, pack o jaba y arma todo en un solo carrito.';if(b){b.innerHTML='Explorar productos <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>'}}}}
  const search=$('.v7-home-search',home);if(search&&!search.dataset.v77){search.dataset.v77='1';search.querySelector('span').textContent='Buscar productos, marcas o categorías'}
}

function brandTone(name){const n=norm(name);if(n.includes('coca-cola'))return'coke';if(n.includes('sprite'))return'sprite';if(n.includes('fanta'))return'fanta';if(n.includes('power'))return'power';if(n.includes('dasani'))return'dasani';if(n.includes('gatorade'))return'gatorade';if(n.includes('oreo'))return'oreo';if(n.includes('doritos'))return'doritos';return''}
function decorateCatalog(){
  const rail=$('#categoryRail');if(!rail||!data)return;
  const filter=$('#filterBtn');if(filter){const s=$('span',filter);if(s)s.textContent='Marcas';filter.setAttribute('aria-label','Filtrar por marca')}
  let brands=$('#v77BrandRail');if(!brands){brands=document.createElement('section');brands.id='v77BrandRail';brands.className='v77-brand-section';rail.insertAdjacentElement('afterend',brands)}
  const list=brandList();brands.innerHTML=list.length?`<div class="v77-brand-head"><span>Marcas</span><small>Desliza para explorar</small></div><div class="v77-brand-rail"><button class="v77-brand-chip all" data-v77-brand=""><b>Todas</b></button>${list.map(b=>`<button class="v77-brand-chip ${brandTone(b)}" data-v77-brand="${esc(b)}"><span>${esc(b.slice(0,1).toUpperCase())}</span><b>${esc(b)}</b></button>`).join('')}</div>`:'';
  $$('.v7-product[data-product]').forEach(card=>{const id=card.dataset.product,ps=presentations(id);card.classList.toggle('v77-multi',ps.length>1);let pill=$('.v77-options-pill',card);if(ps.length>1){if(!pill){pill=document.createElement('button');pill.type='button';pill.className='v77-options-pill';pill.dataset.v77Choose=id;const target=$('.v7-product-title p',card);target?.insertAdjacentElement('afterend',pill)}const short=ps.slice(0,2).map(p=>p.name).join(' + ');pill.textContent=short||`${ps.length} opciones`;const add=$('[data-add]',card);if(add){const sp=$('span',add);if(sp)sp.textContent='Elegir';add.setAttribute('aria-label',`Elegir presentación de ${product(id)?.name||'producto'}`)}}else pill?.remove()});
}

function decorateDetail(){
  const sheet=$('.v7-sheet');if(!sheet||!data)return;
  $('#noteToggle',sheet)?.closest('.v7-detail-body')?.classList.add('v77-detail-clean');
  const title=$('.v7-detail-body h2',sheet)?.textContent||'';const p=(data.products||[]).find(x=>norm(x.name)===norm(title));if(!p)return;const ps=presentations(p.id);$$('[data-presentation]',sheet).forEach(btn=>{const pr=ps.find(x=>String(x.id)===String(btn.dataset.presentation));if(!pr||$('.v77-presentation-thumb',btn))return;const thumb=document.createElement('span');thumb.className='v77-presentation-thumb';const src=pr.image_url||p.image_url||'';thumb.innerHTML=src?`<img src="${esc(src)}" alt="">`:`<b>${esc((pr.name||'?').slice(0,1))}</b>`;btn.prepend(thumb)});$('.v75-presentation-help',sheet)?.remove();$('#noteToggle',sheet)?.remove();$('#noteBox',sheet)?.remove();
}

function lock(){document.documentElement.classList.add('v77-modal-open');document.body.classList.add('v77-modal-open')}
function unlock(){document.documentElement.classList.remove('v77-modal-open');document.body.classList.remove('v77-modal-open')}
function closeChooser(){activeChooser?.remove();activeChooser=null;unlock()}
function showChooser(productId){
  const p=product(productId),ps=presentations(productId);if(!p||ps.length<2)return false;
  closeChooser();const overlay=document.createElement('div');overlay.className='v77-chooser';overlay.innerHTML=`<div class="v77-chooser-backdrop" data-v77-close></div><section><div class="v77-grab"></div><header><div><small>ELIGE CÓMO COMPRAR</small><h2>${esc(p.name)}</h2><p>Puedes combinar varias presentaciones en el mismo pedido.</p></div><button type="button" data-v77-close aria-label="Cerrar">×</button></header><div class="v77-choice-list">${ps.map(pr=>{const src=pr.image_url||p.image_url||'';return `<article data-v77-row="${esc(pr.id)}"><div class="v77-choice-photo">${src?`<img src="${esc(src)}" alt="${esc(pr.name)}">`:`<span>${esc((pr.name||'?').slice(0,1))}</span>`}</div><div class="v77-choice-copy"><b>${esc(pr.name)}</b><small>${Number(pr.units_per_presentation||1)} ${esc(p.base_unit||pr.unit_label||'unidad')}${Number(pr.units_per_presentation||1)===1?'':'es'}</small><strong>${money(pr.price)}</strong></div><div class="v77-choice-step"><button type="button" data-v77-dec="${esc(pr.id)}">−</button><b data-v77-qty="${esc(pr.id)}">0</b><button type="button" data-v77-inc="${esc(pr.id)}">+</button></div></article>`}).join('')}</div><footer><div><small>Total a agregar</small><strong id="v77ChoiceTotal">$0,00</strong></div><button type="button" id="v77ChoiceAdd" disabled>Agregar al carrito</button></footer></section>`;document.body.append(overlay);activeChooser=overlay;lock();requestAnimationFrame(()=>overlay.classList.add('show'));
  const qty=new Map(ps.map(x=>[String(x.id),0]));const refresh=()=>{let total=0,count=0;ps.forEach(pr=>{const q=qty.get(String(pr.id))||0;count+=q;total+=q*Number(pr.price||0);const el=$(`[data-v77-qty="${CSS.escape(String(pr.id))}"]`,overlay);if(el)el.textContent=q});$('#v77ChoiceTotal',overlay).textContent=money(total);const add=$('#v77ChoiceAdd',overlay);add.disabled=!count;add.textContent=count?`Agregar ${count} ${count===1?'selección':'selecciones'}`:'Agregar al carrito'};overlay.addEventListener('click',e=>{if(e.target.closest?.('[data-v77-close]')){closeChooser();return}const inc=e.target.closest?.('[data-v77-inc]'),dec=e.target.closest?.('[data-v77-dec]');if(inc){const id=inc.dataset.v77Inc;qty.set(id,(qty.get(id)||0)+1);refresh()}if(dec){const id=dec.dataset.v77Dec;qty.set(id,Math.max(0,(qty.get(id)||0)-1));refresh()}});$('#v77ChoiceAdd',overlay).onclick=async()=>{const selections=ps.map(pr=>({id:String(pr.id),qty:qty.get(String(pr.id))||0})).filter(x=>x.qty>0);if(!selections.length)return;const btn=$('#v77ChoiceAdd',overlay);btn.disabled=true;btn.textContent='Agregando…';closeChooser();await batchAddProduct(productId,selections)};refresh();return true;
}

async function waitSheet(timeout=1400){const start=Date.now();while(Date.now()-start<timeout){const s=$('.v7-sheet.show,.v7-sheet');if(s&&$('[data-presentation]',s))return s;await sleep(20)}return null}
async function baseAdd(productId,presentationId,qty){
  let card=$(`[data-product="${CSS.escape(String(productId))}"]`);if(!card)return false;const opener=$('[data-open]',card);if(!opener)return false;opener.click();const sheet=await waitSheet();if(!sheet)return false;const pbtn=$(`[data-presentation="${CSS.escape(String(presentationId))}"]`,sheet);if(pbtn)pbtn.click();const plus=$('#detailPlus',sheet),add=$('#detailAdd',sheet);for(let i=1;i<qty;i++)plus?.click();add?.click();await sleep(205);return true}
async function batchAddProduct(productId,selections){if(batching)return;batching=true;document.documentElement.classList.add('v77-batching');let ok=0;try{for(const s of selections){if(await baseAdd(productId,s.id,s.qty))ok+=s.qty}}finally{document.documentElement.classList.remove('v77-batching');batching=false}if(ok)showToast(`${ok} ${ok===1?'selección agregada':'selecciones agregadas'}`)}

async function chooseBrand(name){const filter=$('#filterBtn');if(!filter)return;filter.click();await sleep(45);const sheet=$('.v7-sheet');if(!sheet)return;const target=$$('[data-brand-option]',sheet).find(b=>norm(b.dataset.brandOption||'')===norm(name));target?.click()}

function historyKey(){return`kiubo-v7-orders:${slug}`}
function localHistory(){try{return JSON.parse(localStorage.getItem(historyKey())||'[]')}catch{return[]}}
function orderForCard(card){const num=$('h3',card)?.textContent?.trim();return localHistory().find(o=>String(o.order_number)===num)}
function decorateOrders(){
  $$('.v7-order').forEach(card=>{if(card.dataset.v77)return;card.dataset.v77='1';const o=orderForCard(card);if(!o)return;const actions=document.createElement('div');actions.className='v77-order-actions';actions.innerHTML=`<button type="button" data-v77-repeat="${esc(o.public_token)}">↻ Repetir</button>${['new','confirmed'].includes(String(o.status))?`<button type="button" class="danger" data-v77-cancel="${esc(o.public_token)}">Cancelar</button>`:''}`;card.append(actions)});
}
async function api(action,payload={}){const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version},body:JSON.stringify({action,slug,...payload})});const b=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(b.message||b.error||'request_failed');e.code=b.error;e.status=b.status;throw e}return b}
function cancelDialog(token){const overlay=document.createElement('div');overlay.className='v77-cancel';overlay.innerHTML=`<div class="v77-chooser-backdrop" data-v77-cancel-close></div><section><button class="v77-cancel-x" data-v77-cancel-close>×</button><span>¿CANCELAR PEDIDO?</span><h2>Cuéntanos por qué</h2><p>Podrás volver a pedir estos productos cuando quieras.</p><div class="v77-reasons"><button data-reason="Me equivoqué en el pedido">Me equivoqué</button><button data-reason="Quiero cambiar productos">Quiero cambiar productos</button><button data-reason="Ya no necesito el pedido">Ya no lo necesito</button><button data-reason="Otro motivo">Otro</button></div><button id="v77ConfirmCancel" disabled>Confirmar cancelación</button></section>`;document.body.append(overlay);lock();requestAnimationFrame(()=>overlay.classList.add('show'));let reason='';const close=()=>{overlay.remove();unlock()};overlay.addEventListener('click',e=>{if(e.target.closest?.('[data-v77-cancel-close]'))return close();const b=e.target.closest?.('[data-reason]');if(b){reason=b.dataset.reason;$$('[data-reason]',overlay).forEach(x=>x.classList.toggle('active',x===b));$('#v77ConfirmCancel',overlay).disabled=false}});$('#v77ConfirmCancel',overlay).onclick=async()=>{const b=$('#v77ConfirmCancel',overlay);b.disabled=true;b.textContent='Cancelando…';try{await api('customer_cancel_order',{public_token:token,reason});close();const h=localHistory().map(o=>String(o.public_token)===String(token)?{...o,status:'cancelled',cancellation_reason:reason,updated_at:new Date().toISOString()}:o);localStorage.setItem(historyKey(),JSON.stringify(h));$('#refreshOrders')?.click();showToast('Pedido cancelado')}catch(err){b.disabled=false;b.textContent='Confirmar cancelación';showToast(err.code==='cannot_cancel_status'?'Este pedido ya está en proceso y no puede cancelarse aquí.':'No pudimos cancelar el pedido','error')}}}

async function ensureCatalogAll(){const nav=$('[data-view="catalog"]');nav?.click();await sleep(80);$('#clearSearch')?.click();await sleep(20);$('#clearBrand')?.click();await sleep(50);const all=$('[data-category="all"]');if(all&&!all.classList.contains('active')){all.click();await sleep(70)}}
async function repeatOrder(token){
  const cover=document.createElement('div');cover.className='v77-working';cover.innerHTML='<div><i></i><b>Preparando tu carrito…</b><span>Estamos recuperando los productos del pedido.</span></div>';document.body.append(cover);lock();try{const {order}=await api('order_status',{public_token:token});if(!order?.items?.length)throw new Error('empty');await bootstrap(true);await ensureCatalogAll();document.documentElement.classList.add('v77-batching');let added=0,missing=0;for(const item of order.items){const p=(data.products||[]).find(x=>norm(x.name)===norm(item.product_name));if(!p){missing++;continue}let ps=presentations(p.id),pr=ps.find(x=>norm(x.name)===norm(item.presentation_name))||ps.find(x=>Number(x.units_per_presentation||1)===Number(item.units_per_presentation||1))||ps[0];if(!pr){missing++;continue}const card=$(`[data-product="${CSS.escape(String(p.id))}"]`);if(!card){missing++;continue}if(await baseAdd(p.id,pr.id,Math.max(1,Number(item.quantity||1))))added+=Number(item.quantity||1);else missing++}document.documentElement.classList.remove('v77-batching');cover.remove();unlock();$('[data-view="cart"]')?.click();if(missing)showToast(`Pedido recuperado · ${missing} producto${missing===1?'':'s'} no disponible${missing===1?'':'s'}`,'warn');else showToast('Pedido agregado al carrito')}catch{document.documentElement.classList.remove('v77-batching');cover.remove();unlock();showToast('No pudimos repetir este pedido','error')}}

function suppressNoise(node){if(node?.nodeType!==1)return;const candidates=[node,...(node.querySelectorAll?.('.v7-toast')||[])];for(const el of candidates){if(el.matches?.('.v7-toast')&&/pedidos actualizados|agregado al carrito/i.test(el.textContent||''))el.remove()}}
function sync(){decorateHome();decorateCatalog();decorateDetail();decorateOrders()}

document.addEventListener('click',e=>{
  const add=e.target.closest?.('[data-add]');if(add&&!batching&&data&&presentations(add.dataset.add).length>1){e.preventDefault();e.stopImmediatePropagation();showChooser(add.dataset.add);return}
  const choose=e.target.closest?.('[data-v77-choose]');if(choose){e.preventDefault();e.stopPropagation();showChooser(choose.dataset.v77Choose);return}
  const brand=e.target.closest?.('[data-v77-brand]');if(brand){e.preventDefault();chooseBrand(brand.dataset.v77Brand||'');return}
  const repeat=e.target.closest?.('[data-v77-repeat]');if(repeat){e.preventDefault();repeatOrder(repeat.dataset.v77Repeat);return}
  const cancel=e.target.closest?.('[data-v77-cancel]');if(cancel){e.preventDefault();cancelDialog(cancel.dataset.v77Cancel);return}
},true);

const toastObs=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)suppressNoise(n)});
function start(){bootstrap().then(()=>sync()).catch(()=>{});toastObs.observe(document.body,{childList:true,subtree:false});['#homeView','#catalogView','#ordersView','#sheetHost'].forEach(sel=>{const el=$(sel);if(el)new MutationObserver(()=>requestAnimationFrame(sync)).observe(el,{childList:true,subtree:true})});sync()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
