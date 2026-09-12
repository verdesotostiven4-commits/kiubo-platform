/* Hakuna Panel 10.8.1 — lightweight provider helpers. Legacy body scroll-lock removed. */
(()=>{
'use strict';
if(window.__hakunaPanel1061)return;window.__hakunaPanel1061=true;
if(!/^\/panel(?:\/|$)/.test(location.pathname))return;
const $=(s,r=document)=>r.querySelector(s);
function clearLegacyModalLock(){document.documentElement.classList.remove('hm106-modal-lock');document.body?.classList.remove('hm106-modal-lock')}
function ensureCategoryShortcut(){const toolbar=$('[data-view="products"] .view-toolbar');if(!toolbar||$('#hm106CategoriesBtn',toolbar))return;const newBtn=$('#newProductBtn',toolbar);if(!newBtn)return;const btn=document.createElement('button');btn.type='button';btn.id='hm106CategoriesBtn';btn.className='button button--secondary hm106-categories-btn';btn.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg><span>Categorías</span>';newBtn.before(btn);btn.onclick=()=>{const business=$('[data-nav="business"]');business?.click();setTimeout(()=>{const categories=$('[data-settings="categories"]');categories?.click();setTimeout(()=>$('#categoryAdminList')?.scrollIntoView({block:'start'}),30)},30)}}
function polishExistingReset(){const card=$('.v72-reset-card');if(!card)return;const p=$('header p',card),small=$('.v72-reset-body small',card);if(p)p.textContent='Limpia pedidos de prueba y empieza el historial desde cero. Productos, fotos, categorías y configuración se conservan; si un pedido ya había descontado stock, el inventario se repone automáticamente.';if(small)small.textContent='Mantén presionado 5 segundos. Después todavía tendrás que confirmar.'}
function polishExistingDelete(){const zone=$('#v7DeleteProductZone');if(!zone)return;const small=$('small',zone);if(small)small.textContent='Para duplicados o productos que ya no manejarás. Se oculta del catálogo, pero los pedidos anteriores conservan su historial.'}
function ensureOrderStockNote(){const modal=$('#orderModal'),content=$('#orderModalContent');if(!modal||modal.hidden||!content||$('.hm106-order-stock',content))return;const note=document.createElement('div');note.className='hm106-order-stock';note.innerHTML='<span>✓</span><p><b>Stock automático</b><small>Se descuenta al confirmar el pedido. Si se cancela, vuelve al inventario automáticamente.</small></p>';const guide=$('.hm105-order-guide',content);if(guide)guide.insertAdjacentElement('afterend',note);else content.prepend(note)}
function enhance(){clearLegacyModalLock();ensureCategoryShortcut();polishExistingReset();polishExistingDelete();ensureOrderStockNote();document.documentElement.dataset.hmPanelHelper='10.8.1'}
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};
const start=()=>{enhance();const root=$('#adminApp')||document.body;new MutationObserver(schedule).observe(root,{childList:true,subtree:true});document.addEventListener('click',schedule,true);window.addEventListener('pageshow',schedule);window.addEventListener('popstate',schedule)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
