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

const momentSeenKey=`kiubo-v10-order-moments:${slug}`;
const momentCopy={confirmed:{title:'¡Pedido confirmado!',body:'Hakuna Matata confirmó tu pedido. Gracias por comprar con nosotros.',tone:'ok'},cancelled:{title:'Pedido cancelado',body:'Este pedido fue cancelado. Puedes volver al catálogo cuando quieras.',tone:'cancel'}};
function seenMoments(){try{return JSON.parse(localStorage.getItem(momentSeenKey)||'{}')}catch{return{}}}
function markMoment(key){const seen=seenMoments();seen[key]=Date.now();try{localStorage.setItem(momentSeenKey,JSON.stringify(Object.fromEntries(Object.entries(seen).sort((a,b)=>Number(b[1])-Number(a[1])).slice(0,30))))}catch{}}
function playMomentFeedback(kind){try{navigator.vibrate?.(kind==='ok'?[35,35,70]:[45,30,45])}catch{}}
function showOrderMoment(order,force=false){const copy=momentCopy[order?.status];if(!copy)return false;const key=`${order.public_token||order.id||order.order_number}:${order.status}`;if(!force&&seenMoments()[key])return false;markMoment(key);document.querySelector('.hm1051-order-moment')?.remove();const el=document.createElement('section');el.className=`hm1051-order-moment ${order.status==='cancelled'?'is-cancelled':'is-confirmed'}`;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.innerHTML=`<div class="hm1051-order-moment__card"><button type="button" aria-label="Cerrar">×</button><span class="hm1051-order-moment__icon">${order.status==='cancelled'?'<svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>':'<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>'}</span><small>${String(order.order_number||'PEDIDO')}</small><h2>${copy.title}</h2><p>${copy.body}</p><em>Este aviso se cerrará automáticamente</em></div>`;document.body.append(el);const close=()=>{el.classList.remove('show');setTimeout(()=>el.remove(),220)};el.querySelector('button').onclick=close;requestAnimationFrame(()=>el.classList.add('show'));playMomentFeedback(copy.tone);setTimeout(close,4800);return true}
function persistFreshOrder(fresh){const list=orderHistory(),idx=list.findIndex(x=>String(x.public_token)===String(fresh.public_token));if(idx>=0)list[idx]={...list[idx],...fresh};else list.unshift(fresh);try{localStorage.setItem(historyKey,JSON.stringify(list.slice(0,40)))}catch{}}
async function syncOrderMoments(){const params=new URLSearchParams(location.search),deep=params.get('order')||'',stored=orderHistory();const tokens=[deep,...stored.slice(0,8).map(x=>x.public_token)].filter((v,i,a)=>/^[0-9a-f-]{36}$/i.test(String(v||''))&&a.indexOf(v)===i).slice(0,6);let shown=false;for(const token of tokens){try{const before=orderHistory().find(x=>String(x.public_token)===String(token));const r=await upstream(C.apiUrl,{method:'POST',headers:{'content-type':'application/json','X-Client-Version':C.version||''},body:JSON.stringify({action:'order_status',slug,public_token:token})});const p=await r.json().catch(()=>({}));if(!r.ok||!p?.order)continue;const changed=Boolean(before?.status&&p.order.status&&before.status!==p.order.status);persistFreshOrder(p.order);if(!shown&&momentCopy[p.order.status]&&(changed||String(token)===String(deep))){shown=showOrderMoment(p.order,String(token)===String(deep));}}catch{}}if(deep){params.delete('order');params.delete('status');const q=params.toString();history.replaceState(history.state,'',`${location.pathname}${q?`?${q}`:''}${location.hash||''}`)}}
const upstream=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'',isApi=url===C.apiUrl;let body=null;
  if(isApi&&typeof init?.body==='string'){try{body=JSON.parse(init.body)}catch{}}
  const before=body?.action==='order_status'?orderHistory():null;
  const res=await upstream(input,init);
  if(res.ok&&body?.action==='order_status')res.clone().json().then(payload=>{
    const o=payload?.order;if(!o)return;const old=(before||[]).find(x=>String(x.public_token)===String(body.public_token));
    if(old?.status&&o.status&&old.status!==o.status){const labels={new:'recibido',confirmed:'confirmado',preparing:'en preparación',dispatched:'despachado',delivered:'entregado',cancelled:'cancelado'};showNotification(`Pedido ${o.order_number||''}`,`Tu pedido está ${labels[o.status]||'actualizado'}.`,`hakuna-${o.public_token||o.id||'order'}`);showOrderMoment(o)}persistFreshOrder(o)
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
let raf=0,statusSyncTimer=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};const scheduleStatusSync=()=>{clearTimeout(statusSyncTimer);statusSyncTimer=setTimeout(()=>syncOrderMoments().catch(()=>{}),700)};new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',schedule,true);window.addEventListener('pageshow',()=>{schedule();scheduleStatusSync()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleStatusSync()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{schedule();scheduleStatusSync()},{once:true});else{schedule();scheduleStatusSync()};
})();
