/* Hakuna: explicit Web Push opt-in, multiple orders and provider sessions. */
(()=>{'use strict';
if(window.__hakunaPush107)return;window.__hakunaPush107=true;
const C=window.KIUBO_CATALOG_CONFIG||{},isPreview=window.__hakunaSyntheticPreview===true,isPanel=/^\/panel(?:\/|$)/.test(location.pathname),isMaster=/^\/master(?:\/|$)/.test(location.pathname)||new URLSearchParams(location.search).get('mode')==='master';
if(isMaster||!C.supabaseUrl)return;
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''),audience=isPanel?'provider':'customer';
const STORE=`kiubo-push-v1:${slug}:${audience}`,providerKey=`kiubo-provider-session:${slug}`,dismissKey=`hakuna-push-dismiss:${slug}:${audience}`;
const notifyUrl=C.notifyUrl||`${C.supabaseUrl}/functions/v1/catalog-notify`;
const supported=()=>('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window);
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'null')}catch{return null}};
const write=v=>{try{v?localStorage.setItem(STORE,JSON.stringify(v)):localStorage.removeItem(STORE)}catch{}};
const current=()=>supported()&&Notification.permission==='granted'?read():null;
let inFlight=null,shown=false,registeredProviderToken='';
const post=async body=>{const token=isPanel?sessionStorage.getItem(providerKey):null;const r=await fetch(notifyUrl,{method:'POST',headers:{'content-type':'application/json',...(token?{'x-provider-session':token}:{})},body:JSON.stringify({slug,...body})});const p=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(p.error||`push_${r.status}`),{code:p.error});return p};
function b64url(value=''){const pad='='.repeat((4-value.length%4)%4),raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/')),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function registration(){let reg=await navigator.serviceWorker.getRegistration('/');if(!reg)reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});return navigator.serviceWorker.ready}
async function bindOrder(token){const saved=current();if(!saved?.id||!saved.endpoint||!token)return false;await post({action:'bind_order',subscription_id:saved.id,endpoint:saved.endpoint,order_public_token:token});return true}
async function bindRecent(){if(isPanel)return;let history=[];try{history=JSON.parse(localStorage.getItem(`kiubo-v10-orders:${slug}`)||'[]')}catch{}const ref=new URLSearchParams(location.search).get('ref'),tokens=[...new Set([ref,...(Array.isArray(history)?history.map(x=>x.public_token):[])].filter(Boolean))].slice(0,40);for(const token of tokens){try{await bindOrder(token)}catch{/* Each order can be retried independently on the next visit. */}}}
async function subscribeNow({ask=false}={}){
 if(!supported())throw Error('unsupported');
 if(isPanel&&!sessionStorage.getItem(providerKey))throw Error('session_expired');
 if(Notification.permission==='denied')throw Error('blocked');
 // This is the first asynchronous operation so the browser sees a user gesture.
 if(Notification.permission!=='granted'){if(!ask)return null;const granted=await Notification.requestPermission();if(granted!=='granted')throw Error(granted==='denied'?'blocked':'declined')}
 if(inFlight)return inFlight;
 const recent=current();if(!ask&&recent?.at&&Date.now()-Number(recent.at)<300000&&(!isPanel||registeredProviderToken===sessionStorage.getItem(providerKey))){if(!isPanel)await bindRecent();return recent}
 inFlight=(async()=>{const reg=await registration();let sub=await reg.pushManager.getSubscription();if(!sub){const key=await post({action:'public_key'});if(!key.public_key)throw Error('not_configured');sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64url(key.public_key)})}const json=sub.toJSON();const saved=await post({action:'subscribe',audience,subscription:json});if(!saved.subscription_id)throw Error('not_registered');write({id:saved.subscription_id,endpoint:json.endpoint,at:Date.now()});if(isPanel)registeredProviderToken=sessionStorage.getItem(providerKey)||'';await bindRecent();return saved})().catch(err=>{write(null);throw err}).finally(()=>{inFlight=null});return inFlight;
}
function copy(text){const p=document.querySelector('#hakunaPushPrompt [data-push-copy]');if(p)p.textContent=text}
function showPrompt(force=false){
 if(!document.body||shown&&!force)return;
 if(isPanel&&!sessionStorage.getItem(providerKey))return;
 if(!force){try{if(sessionStorage.getItem(dismissKey))return}catch{}}
 if(!isPreview&&current())return;
 shown=true;let el=document.querySelector('#hakunaPushPrompt');if(!el){el=document.createElement('aside');el.id='hakunaPushPrompt';el.setAttribute('role','region');el.setAttribute('aria-label','Avisos de Hakuna');el.innerHTML='<img src="/assets/hakuna-logo-192.png" alt=""><div><b></b><p data-push-copy></p><div class="hm-push-buttons"><button type="button" data-push-activate>Activar avisos</button><button type="button" data-push-dismiss>Ahora no</button></div></div>';document.body.append(el)}
 el.querySelector('b').textContent=isPanel?'Recibe avisos de pedidos':'Sigue tu pedido con avisos';
 copy(isPreview?'Esta es una demostración con datos ficticios. Aquí no se activan ni se envían avisos reales.':!supported()?'Si usas iPhone, instala Hakuna en la pantalla de inicio y vuelve a abrirla para activar avisos. En otros dispositivos revisa que el navegador los admita.':Notification.permission==='denied'?'Los avisos están bloqueados. Puedes habilitarlos en los permisos del navegador.':isPanel?'Activa los avisos para enterarte cuando llegue un pedido nuevo.':'Te avisamos cuando cambie el estado de tu pedido. También puedes seguirlo sin activar avisos.');
 el.querySelector('[data-push-activate]').hidden=isPreview||!supported()||Notification.permission==='denied';
 el.querySelector('[data-push-dismiss]').textContent=isPreview?'Entendido':'Ahora no';
}
function hidePrompt(){document.querySelector('#hakunaPushPrompt')?.remove();try{sessionStorage.setItem(dismissKey,'1')}catch{}}
function reportError(err){showPrompt(true);copy(err?.message==='blocked'?'Los avisos están bloqueados. Cambia los permisos del navegador para activarlos.':err?.message==='declined'?'Puedes activarlos después. El seguimiento sigue disponible.':err?.message==='session_expired'?'Abre tu sesión del panel para activar avisos.':'No pudimos activar los avisos. Revisa tu conexión e intenta de nuevo.');}
async function activate(){if(isPreview){showPrompt(true);return false}try{const result=await subscribeNow({ask:true});if(result){hidePrompt();return true}return false}catch(err){reportError(err);return false}}
document.addEventListener('click',event=>{const t=event.target;if(t.closest?.('[data-push-dismiss]')){hidePrompt();return}if(t.closest?.('[data-push-activate],[data-hm1051-notify],[data-hm1051-panel-notify]')){event.preventDefault();activate()}},true);
function start(){if(isPanel&&!sessionStorage.getItem(providerKey))return;if(isPreview){showPrompt();return}if(supported()&&Notification.permission==='granted'){subscribeNow().then(()=>{if(current())document.querySelector('#hakunaPushPrompt')?.remove()}).catch(reportError)}else showPrompt()}
window.addEventListener('hakuna:provider-ready',start);
window.addEventListener('pageshow',start);
document.addEventListener('visibilitychange',()=>{if(!isPreview&&!document.hidden&&supported()&&Notification.permission==='granted')subscribeNow().catch(()=>{})});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,1200),{once:true});else setTimeout(start,1200);
if(!isPanel){const upstream=window.fetch.bind(window);window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:input?.url||'';let body=null;if(url===C.apiUrl&&typeof init?.body==='string'){try{body=JSON.parse(init.body)}catch{}}const res=await upstream(input,init);if(res.ok&&body?.action==='create_order')res.clone().json().then(p=>bindOrder(p?.order?.public_token).catch(()=>{})).catch(()=>{});return res}}
window.HakunaPush={subscribe:activate,current,bindOrder};
})();
