/* Hakuna Panel 10.17 — clear daily workflow and push readiness. */
(()=>{'use strict';
if(window.__hm117Panel)return;window.__hm117Panel=true;
if(!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s);
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
document.documentElement.classList.toggle('hm117-provider',/^\/panel(?:\/|$)/.test(location.pathname));
let snapshot={orders:[],products:[]},raf=0;
const apiFetch=window.fetch.bind(window);
function parse(init){try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}}
function toast(title,copy=''){const old=$('.hm117-toast');old?.remove();const e=document.createElement('div');e.className='hm117-toast';e.innerHTML=`<b>${title}</b>${copy?`<span>${copy}</span>`:''}`;document.body.append(e);requestAnimationFrame(()=>e.classList.add('show'));setTimeout(()=>{e.classList.remove('show');setTimeout(()=>e.remove(),180)},3200)}
function remember(p){if(Array.isArray(p?.orders))snapshot.orders=p.orders;if(Array.isArray(p?.products))snapshot.products=p.products;schedule()}
window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input?.url||'',body=url===C.apiUrl?parse(init):null,res=await apiFetch(input,init);if(res.ok&&body&&['provider_bootstrap','master_bootstrap'].includes(body.action))res.clone().json().then(remember).catch(()=>{});return res};
function counts(){const orders=snapshot.orders||[],products=snapshot.products||[];return{newOrders:orders.filter(o=>o.status==='new').length,inProcess:orders.filter(o=>['confirmed','preparing','dispatched'].includes(o.status)).length,stock:products.filter(p=>!p.archived_at&&(p.status==='out'||p.status==='low'||(p.stock_tracking&&Number(p.stock_quantity||0)<=Number(p.low_stock_threshold||0)))).length}}
function pushState(){const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),standalone=window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true,supported='Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window;let subscribed=false;try{subscribed=Boolean(JSON.parse(localStorage.getItem(`kiubo-push-v1:${slug()}:provider`)||'null')?.id)}catch{}if(ios&&!standalone&&!supported)return{kind:'install',label:'Instala el panel para recibir avisos',copy:'En iPhone: Safari → Compartir → Añadir a pantalla de inicio.'};if(!supported)return{kind:'unsupported',label:'Avisos no disponibles',copy:'Este navegador no admite notificaciones push.'};if(Notification.permission==='denied')return{kind:'blocked',label:'Avisos bloqueados',copy:'Actívalos desde los permisos del navegador.'};if(Notification.permission==='granted'&&subscribed)return{kind:'ready',label:'Avisos activados',copy:'Los pedidos nuevos pueden llegar aunque cierres el panel.'};if(Notification.permission==='granted')return{kind:'action',label:'Termina de activar los avisos',copy:'Registra este dispositivo para recibir pedidos nuevos.'};return{kind:'action',label:'Activa avisos de pedidos',copy:'Recibe una alerta cuando entre un pedido nuevo.'}}
async function enablePush(){const st=pushState();if(st.kind==='install'||st.kind==='unsupported'||st.kind==='blocked')return toast(st.label,st.copy);try{const saved=await window.HakunaPush?.subscribe?.();if(saved||Notification.permission==='granted')toast('Avisos activados','Este dispositivo quedó listo para recibir pedidos.');else toast('No se activaron los avisos','Inténtalo otra vez desde el panel.')}catch{toast('No pudimos activar los avisos','Revisa los permisos del navegador.')}schedule()}
function go(action){if(action==='orders')return $('[data-nav="orders"]')?.click();if(action==='products')return $('[data-nav="products"]')?.click();if(action==='stock')return $('[data-quick="stock"]')?.click()}
function render(){
 const home=$('.admin-view[data-view="home"]');if(!home)return;const c=counts(),welcome=$('#welcomeTitle'),copy=$('#welcomeCopy');
 if(welcome)welcome.textContent=c.newOrders?`${c.newOrders} pedido${c.newOrders===1?' necesita':'s necesitan'} tu revisión.`:'Todo está al día.';
 if(copy)copy.textContent=c.newOrders?'El stock ya está reservado. Abre el pedido, revisa los datos y confirma o cancela.':'Aquí verás primero lo que realmente necesita tu atención.';
 let box=$('#hm117Now');if(!box){box=document.createElement('section');box.id='hm117Now';box.className='hm117-now';$('.welcome-card',home)?.insertAdjacentElement('afterend',box)}
 if(!box)return;const st=pushState();
 box.innerHTML=`<div class="hm117-head"><div><small>AHORA MISMO</small><h2>¿Qué necesitas hacer?</h2></div><span class="hm117-live"><i></i>Actualizado</span></div><div class="hm117-actions"><button data-hm117="orders" class="${c.newOrders?'urgent':'ok'}"><span class="hm117-num">${c.newOrders}</span><span><b>Pedidos por revisar</b><small>${c.newOrders?'Abre, confirma o cancela':'No hay pedidos nuevos'}</small></span><em>›</em></button><button data-hm117="orders"><span class="hm117-num">${c.inProcess}</span><span><b>Pedidos en proceso</b><small>${c.inProcess?'Preparando o despachando':'Nada pendiente aquí'}</small></span><em>›</em></button><button data-hm117="stock" class="${c.stock?'warn':'ok'}"><span class="hm117-num">${c.stock}</span><span><b>Inventario por revisar</b><small>${c.stock?'Agotados o con pocas unidades':'Stock sin alertas'}</small></span><em>›</em></button></div><div class="hm117-notify ${st.kind}"><span>🔔</span><div><b>${st.label}</b><small>${st.copy}</small></div>${st.kind==='action'?'<button type="button" id="hm117EnablePush">Activar</button>':''}</div>`;
 box.querySelectorAll('[data-hm117]').forEach(b=>b.onclick=()=>go(b.dataset.hm117));$('#hm117EnablePush',box)?.addEventListener('click',enablePush);
}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;render()})}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest?.('[data-nav="home"]'))setTimeout(schedule,0)},true);
window.addEventListener('pageshow',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();