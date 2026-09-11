/* Hakuna Matata 10.7 — background Web Push for customers and provider. */
(()=>{'use strict';
if(window.__hakunaPush107)return;window.__hakunaPush107=true;
const C=window.KIUBO_CATALOG_CONFIG||{};
if(!C.supabaseUrl||!C.apiUrl||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))return;
const notifyUrl=C.notifyUrl||`${C.supabaseUrl}/functions/v1/catalog-notify`;
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const isPanel=/^\/panel(?:\/|$)/.test(location.pathname);
const isMaster=/^\/master(?:\/|$)/.test(location.pathname)||new URLSearchParams(location.search).get('mode')==='master';
if(isMaster)return;
const audience=isPanel?'provider':'customer';
const STORE=`kiubo-push-v1:${slug}:${audience}`;
const providerKey=`kiubo-provider-session:${slug}`;
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
const write=v=>{try{v?localStorage.setItem(STORE,JSON.stringify(v)):localStorage.removeItem(STORE)}catch{}};
const headers=()=>({'content-type':'application/json',...(isPanel&&sessionStorage.getItem(providerKey)?{'x-provider-session':sessionStorage.getItem(providerKey)}:{})});
const post=async(body)=>{const r=await fetch(notifyUrl,{method:'POST',headers:headers(),body:JSON.stringify({slug,...body})});const p=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(p.error||`push_${r.status}`),{status:r.status,code:p.error});return p};
function b64url(value=''){const pad='='.repeat((4-value.length%4)%4),raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/')),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function registration(){let reg=await navigator.serviceWorker.getRegistration('/');if(!reg)reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});return navigator.serviceWorker.ready}
async function subscribeNow({ask=false}={}){
 if(Notification.permission==='denied')return null;
 if(Notification.permission!=='granted'){if(!ask)return null;const p=await Notification.requestPermission();if(p!=='granted')return null}
 if(isPanel&&!sessionStorage.getItem(providerKey))return null;
 const reg=await registration();let sub=await reg.pushManager.getSubscription();
 if(!sub){const key=await post({action:'public_key'});if(!key.public_key)return null;sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64url(key.public_key)})}
 const json=sub.toJSON();const saved=await post({action:'subscribe',audience,subscription:json});write({id:saved.subscription_id,endpoint:json.endpoint,at:Date.now()});return saved;
}
async function bindOrder(token){const saved=read();if(!saved?.id||!token)return;try{await post({action:'bind_order',subscription_id:saved.id,order_public_token:token})}catch{}}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-hm1051-notify],[data-hm1051-panel-notify]'))setTimeout(()=>subscribeNow({ask:false}).catch(()=>{}),700)},true);
window.addEventListener('pageshow',()=>{if(Notification.permission==='granted')subscribeNow({ask:false}).catch(()=>{})});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Notification.permission==='granted')subscribeNow({ask:false}).catch(()=>{})});
if(!isPanel){const upstream=window.fetch.bind(window);window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input?.url||'';let body=null;if(url===C.apiUrl&&typeof init?.body==='string'){try{body=JSON.parse(init.body)}catch{}}const res=await upstream(input,init);if(res.ok&&body?.action==='create_order')res.clone().json().then(p=>bindOrder(p?.order?.public_token)).catch(()=>{});return res}}
function refreshCopy(){
 const c=document.querySelector('.hm1051-notify-card small');
 if(c&&Notification.permission==='granted')c.textContent='Te avisaremos de cambios del pedido incluso si cierras Hakuna.';
 const p=document.querySelector('.hm1051-panel-notify small');
 if(p&&Notification.permission==='granted')p.textContent='Mayra recibirá avisos de pedidos nuevos incluso con el panel cerrado.';
}
new MutationObserver(refreshCopy).observe(document.documentElement,{childList:true,subtree:true});
refreshCopy();
window.HakunaPush={subscribe:()=>subscribeNow({ask:true})};
})();