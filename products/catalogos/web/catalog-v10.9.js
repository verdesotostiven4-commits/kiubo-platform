/* Hakuna Matata 10.9 — fail-safe client bootstrap. Forward-only from 10.8.2. */
(()=>{
'use strict';
if(window.__hakunaCatalog109)return;window.__hakunaCatalog109=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const root=document.documentElement;
const fallback=()=>document.getElementById('hm109BootFallback');
let ready=false,failed=false;
function reveal(){
  root.classList.remove('hm105-boot');
  root.classList.add('hm105-ready','hm109-ready');
  const app=document.querySelector('.v10-app');
  if(app){app.style.opacity='1';app.style.visibility='visible';ready=true;fallback()?.remove()}
  return Boolean(app);
}
function fail(message='No pudimos abrir el catálogo.'){
  if(ready)return;
  failed=true;root.classList.remove('hm105-boot');
  const box=fallback();if(!box)return;
  box.classList.add('hm109-boot-error');
  const status=box.querySelector('[data-hm109-status]');if(status)status.textContent=message;
  const btn=box.querySelector('[data-hm109-retry]');if(btn)btn.hidden=false;
}
function check(){if(reveal())return;requestAnimationFrame(reveal)}
root.classList.remove('hm105-boot');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
window.addEventListener('pageshow',check);
window.addEventListener('kiubo:brands-ready',check);
window.addEventListener('error',()=>{if(!document.querySelector('.v10-app'))setTimeout(()=>fail(),0)},true);
window.addEventListener('unhandledrejection',()=>{if(!document.querySelector('.v10-app'))setTimeout(()=>fail(),0)});
setTimeout(check,250);setTimeout(check,700);setTimeout(check,1400);
setTimeout(()=>{if(!ready)fail(navigator.onLine?'El catálogo tardó demasiado en cargar.':'Sin conexión. Revisa internet y vuelve a intentar.')},3200);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-hm109-retry]'))location.reload()},true);
const observer=new MutationObserver(()=>{if(!ready&&document.querySelector('.v10-app')){reveal();observer.disconnect()}});
observer.observe(document.documentElement,{childList:true,subtree:true});
root.dataset.hmCatalog='10.9.0';
})();