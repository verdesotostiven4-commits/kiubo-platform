/* Hakuna Matata Catalog 10.5.1 — checkout clarity, contextual alerts and draggable sheets. */
(()=>{
'use strict';
if(window.__hakunaCatalog1051)return;window.__hakunaCatalog1051=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const historyKey=`kiubo-v10-orders:${slug}`;
const notifySupported=()=>('Notification'in window);
const pushSupported=()=>notifySupported()&&('serviceWorker'in navigator)&&('PushManager'in window);
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent);
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true;
const notifyGranted=()=>notifySupported()&&Notification.permission==='granted';
function orderHistory(){try{return JSON.parse(localStorage.getItem(historyKey)||'[]')}catch{return[]}}
function showNotification(title,body,tag='hakuna-order'){if(!notifyGranted())return;try{new Notification(title,{body,tag,icon:C.brandLogoUrl||undefined,badge:C.brandLogoUrl||undefined})}catch{}}
async function askNotifications(){if(!notifySupported())return'unsupported';try{return await Notification.requestPermission()}catch{return'denied'}}
function notificationCopy(){if(isIOS()&&!isStandalone()&&!pushSupported())return['Recibe avisos en tu iPhone','En Safari: Compartir → Añadir a pantalla de inicio. Abre Hakuna desde el icono y activa los avisos.'];if(!pushSupported())return['Avisos no disponibles','Este navegador no admite notificaciones push.'];if(Notification.permission==='granted')return['Avisos activados','Te avisaremos cuando cambie tu pedido, incluso si cierras Hakuna.'];if(Notification.permission==='denied')return['Avisos bloqueados','Puedes habilitarlos desde los permisos del navegador.'];return['Recibe avisos de tu pedido','Activa los avisos para saber cuando lo confirmen, preparen, despachen o entreguen.']}
function ensureCheckoutNotificationCoach(){const form=$('#checkoutForm');if(!form||$('.hm1051-notify-card',form))return;const review=$('#reviewOrder',form);if(!review)return;const [title,copy]=notificationCopy(),card=document.createElement('section');card.className='hm1051-notify-card';card.innerHTML=`<span>🔔</span><div><b>${title}</b><small>${copy}</small></div>${pushSupported()&&Notification.permission==='default'?'<button type="button" data-hm1051-notify>Activar avisos</button>':''}`;review.insertAdjacentElement('beforebegin',card)}
function refreshCoach(){const card=$('.hm1051-notify-card');if(!card)return;card.remove();ensureCheckoutNotificationCoach()}
document.addEventListener('click',async e=>{if(e.target.closest?.('[data-hm1051-notify]')){e.preventDefault();const p=await askNotifications();refreshCoach();if(p==='granted'){try{await window.HakunaPush?.subscribe?.()}catch{}showNotification('Hakuna Matata','Avisos activados. Te notificaremos cambios del pedido.','hakuna-enabled')}}},true);

const upstream=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'',isApi=url===C.apiUrl;let body=null;
  if(isApi&&typeof init?.body==='string'){try{body=JSON.parse(init.body)}catch{}}
  const before=body?.action==='order_status'?orderHistory():null;
  const res=await upstream(input,init);
  if(res.ok&&body?.action==='order_status')res.clone().json().then(payload=>{
    const o=payload?.order;if(!o)return;const old=(before||[]).find(x=>String(x.public_token)===String(body.public_token));
    if(old?.status&&o.status&&old.status!==o.status){const labels={new:'recibido',confirmed:'confirmado',preparing:'en preparación',dispatched:'despachado',delivered:'entregado',cancelled:'cancelado'};showNotification(`Pedido ${o.order_number||''}`,`Tu pedido está ${labels[o.status]||'actualizado'}.`,`hakuna-${o.public_token||o.id||'order'}`)}
  }).catch(()=>{});
  return res;
};

function bindSheetDrag(sheet){if(!sheet||sheet.dataset.hm1051Drag)return;const grab=$('.v10-grab',sheet);if(!grab)return;sheet.dataset.hm1051Drag='1';let drag=null;grab.setAttribute('role','button');grab.setAttribute('aria-label','Desliza hacia abajo para cerrar');
 const move=e=>{if(!drag||e.pointerId!==drag.id)return;const dy=Math.max(0,e.clientY-drag.y);sheet.style.transition='none';sheet.style.transform=`translateY(${Math.min(dy,240)}px)`;const back=$('#sheetHost .v10-backdrop');if(back)back.style.opacity=String(Math.max(.18,1-dy/320))};
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;const dy=Math.max(0,e.clientY-drag.y),dt=Math.max(1,performance.now()-drag.startT),v=dy/dt;drag=null;grab.releasePointerCapture?.(e.pointerId);sheet.style.transition='';const back=$('#sheetHost .v10-backdrop');if(back)back.style.opacity='';if(dy>105||v>.62){$('.v10-sheet-close',sheet)?.click()}else sheet.style.transform=''};
 grab.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;drag={id:e.pointerId,y:e.clientY,startT:performance.now()};grab.setPointerCapture?.(e.pointerId)},{passive:true});grab.addEventListener('pointermove',move,{passive:true});grab.addEventListener('pointerup',end,{passive:true});grab.addEventListener('pointercancel',end,{passive:true})}
function decorateSheet(){bindSheetDrag($('#sheetHost .v10-sheet'))}
function decorateSuccess(){const success=$('#cartView .v10-success');if(!success||success.dataset.hm1051)return;success.dataset.hm1051='1';showNotification('Pedido registrado','Tu pedido quedó guardado correctamente.','hakuna-created')}
function enhance(){ensureCheckoutNotificationCoach();decorateSheet();decorateSuccess();document.documentElement.dataset.hmCatalog='10.5.1'}
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',schedule,true);window.addEventListener('pageshow',schedule);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
