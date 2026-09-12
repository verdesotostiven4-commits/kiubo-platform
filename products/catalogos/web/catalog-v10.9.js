/* Hakuna Matata 10.9.3 — fail-safe bootstrap + production homepage artwork. */
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

/* Final homepage carousel artwork. Keep the proven 10.3 carousel engine; replace visuals only. */
const HOME_SLIDES=[
  {
    selector:'.hm-slide-main',
    url:'https://blogger.googleusercontent.com/img/a/AVvXsEi0hDelNFtHhwoe6guvslOKkEqE0a4o3qVn_Mnut7m2IPdXwfoGDifE1S5QksIbMEDzm_LFESZjvksQ3JEKR_i5iFIYzTkCryXadiPRtu7R9w00ZOtqLTFnDZEUdStZX1IyEbuPqy4CR8QCVlqrVoMEl2Q7FqCzkreaLh26NUkdZJ-TCRQbrvooScWcthA',
    alt:'Más opciones para vender mejor',
    cta:'Ver catálogo',
    action:'catalog',
    ctaTone:'default',
    tone:'dark'
  },
  {
    selector:'.hm-slide-categories',
    url:'https://blogger.googleusercontent.com/img/a/AVvXsEi3HryNfbEOSl5KpAX1VsCus8Q_o3YRxcfb-_BSAsd-yPGyY_KRxIFyM-HnIaEWrEY7BImj7Dio2dze84LecAO2aBYxTXEUimky3GtqS3ln_dbsOtNAXtwAEMLKiut-zoN7P-7D_oov6-AFg42_Uwzg_dBKwd9IE7AhhTJZHTJoQHQxacyy6OWCchoiBog',
    alt:'Todo más fácil de encontrar',
    cta:'Explorar productos',
    action:'catalog',
    ctaTone:'categories',
    tone:'light'
  },
  {
    selector:'.hm-slide-brands',
    url:'https://blogger.googleusercontent.com/img/a/AVvXsEjwNc7uz385CAxTzuZEaQSMdo-TBctEwPRxDSRk-bcYjgiNqu_Sol5tiTHaWaa1-zh6GQ9KHR-D-VNEEKU9zkcONv_7K_68wWIDEkoJxCEtclhN1bBBo4fUX16ZE7o-yCLcxDBhs3cikH8Tbf_oVXwfdJcX1b3gtPbgeypeW85otTQ3dj6bqrAK1ETvzkQ',
    alt:'Las marcas que más buscan',
    cta:'Ver marcas',
    action:'brands',
    ctaTone:'brands',
    tone:'light'
  }
];
function installHomeStyles(){
  if(document.getElementById('hm109HomeStyles'))return;
  const style=document.createElement('style');style.id='hm109HomeStyles';style.textContent=`
    #homeView .v10-home-search{height:52px!important;margin:6px 0 10px!important;border-radius:16px!important;box-shadow:0 5px 18px rgba(18,39,25,.035)!important}
    #homeView .hm-brand-block{margin-top:6px!important}
    #homeView .hm-brand-block .v10-heading{margin-bottom:6px!important}
    #homeView .hm-brand-block .hm-brand-chip,#homeView .hm-brand-block .hm-brand-more{height:50px!important;border-radius:13px!important}
    #homeView .hm-brand-block .hm-brand-chip{min-width:94px!important}
    #homeView .hm-brand-block .hm-brand-more{min-width:59px!important}
    #homeView .hm-hero-carousel{margin-top:9px!important;border-radius:21px!important;box-shadow:0 12px 30px rgba(17,48,29,.095)!important;background:#fff!important}
    #homeView .hm-hero-track{align-items:stretch!important}
    #homeView .hm-hero-slide.hm109-image-slide{position:relative!important;display:block!important;min-height:0!important;height:auto!important;aspect-ratio:16/9!important;padding:0!important;overflow:hidden!important;background:#f8f6ef!important}
    #homeView .hm109-hero-image{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;object-position:center;border:0;user-select:none;-webkit-user-drag:none}
    #homeView .hm109-hero-cta{position:absolute;z-index:7;left:4.9%;bottom:10.2%;height:40px;min-width:104px;padding:0 15px;border:0;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:9px;font-weight:900;line-height:1;box-shadow:0 8px 20px rgba(11,31,19,.14);transition:transform .12s ease,box-shadow .12s ease,background .12s ease}
    #homeView .hm109-hero-cta:active{transform:scale(.97);box-shadow:0 4px 12px rgba(11,31,19,.12)}
    #homeView .hm109-hero-cta span{font-size:18px;line-height:1;margin-top:-1px}
    #homeView .hm109-cta-default{background:#fff;color:#153a29}
    #homeView .hm109-cta-categories{background:linear-gradient(135deg,#154e36,#1b6244);color:#fff;border:1px solid rgba(255,255,255,.32);box-shadow:0 8px 20px rgba(23,78,54,.22)}
    #homeView .hm109-cta-categories span{color:#d9f3df}
    #homeView .hm109-cta-brands{background:rgba(255,250,239,.96);color:#173c2b;border:1px solid rgba(230,131,39,.34);box-shadow:0 8px 20px rgba(94,54,13,.14)}
    #homeView .hm109-cta-brands span{color:#ef7b22}
    #homeView .hm-hero-dots{bottom:7px!important;gap:5px!important;padding:4px 7px!important;border-radius:999px!important;background:rgba(255,255,255,.78)!important;box-shadow:0 3px 12px rgba(24,45,31,.08)!important;backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
    #homeView .hm-hero-dots button{width:6px!important;height:6px!important;background:rgba(22,79,54,.25)!important;transition:transform .15s ease,background .15s ease!important}
    #homeView .hm-hero-dots button.active{background:#164f36!important;transform:scale(1.18)!important}
    @media(max-width:700px){
      #homeView .v10-home-search{height:50px!important;margin-top:4px!important;margin-bottom:8px!important;padding-inline:14px!important}
      #homeView .hm-brand-block{margin-top:5px!important}
      #homeView .hm-brand-block .hm-brand-chip,#homeView .hm-brand-block .hm-brand-more{height:48px!important}
      #homeView .hm-brand-block .hm-brand-chip{min-width:90px!important}
      #homeView .hm-hero-carousel{margin-top:8px!important;border-radius:19px!important}
      #homeView .hm-hero-slide.hm109-image-slide{aspect-ratio:16/9!important}
      #homeView .hm109-hero-cta{left:5.1%;bottom:9.2%;height:36px;min-width:96px;padding-inline:13px;border-radius:11px;font-size:8px;gap:6px}
      #homeView .hm109-hero-cta span{font-size:16px}
      #homeView .hm109-cta-categories{bottom:8.7%}
      #homeView .hm109-cta-brands{bottom:8.7%}
    }
    @media(max-width:390px){
      #homeView .hm109-hero-cta{height:34px;min-width:91px;padding-inline:11px;font-size:7.5px}
      #homeView .hm-hero-dots{bottom:5px!important}
    }
  `;document.head.append(style);
}
function slideButton(cfg){
  const klass=`hm109-hero-cta hm109-cta-${cfg.ctaTone||'default'}`;
  return cfg.action==='brands'
    ? `<button type="button" class="${klass}" data-hm-open-brands="1" aria-label="${cfg.cta}">${cfg.cta}<span aria-hidden="true">›</span></button>`
    : `<button type="button" class="${klass}" data-view="catalog" aria-label="${cfg.cta}">${cfg.cta}<span aria-hidden="true">›</span></button>`;
}
function mountSlide(slide,cfg,index){
  if(!slide||slide.dataset.hm109Banner===cfg.url)return;
  if(slide.dataset.hm109Loading===cfg.url)return;
  slide.dataset.hm109Loading=cfg.url;
  const probe=new Image();
  probe.decoding='async';
  probe.onload=()=>{
    if(!slide.isConnected)return;
    slide.dataset.hm109Banner=cfg.url;delete slide.dataset.hm109Loading;
    slide.classList.add('hm109-image-slide',cfg.tone==='dark'?'hm109-tone-dark':'hm109-tone-light');
    slide.innerHTML=`<img class="hm109-hero-image" src="${cfg.url}" alt="${cfg.alt}" ${index===0?'fetchpriority="high"':'loading="lazy"'} decoding="async">${slideButton(cfg)}`;
  };
  probe.onerror=()=>{delete slide.dataset.hm109Loading;slide.dataset.hm109BannerError='1'};
  probe.src=cfg.url;
}
function decorateHome(){
  installHomeStyles();
  const hero=document.querySelector('#homeView .hm-hero-carousel');if(!hero)return false;
  HOME_SLIDES.forEach((cfg,i)=>mountSlide(hero.querySelector(cfg.selector),cfg,i));
  hero.dataset.hm109Artwork='final-v2';return true;
}
let homeRaf=0;
function scheduleHome(){if(homeRaf)return;homeRaf=requestAnimationFrame(()=>{homeRaf=0;decorateHome()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleHome,{once:true});else scheduleHome();
window.addEventListener('pageshow',scheduleHome);window.addEventListener('kiubo:brands-ready',scheduleHome);
const homeObserver=new MutationObserver(scheduleHome);homeObserver.observe(document.documentElement,{childList:true,subtree:true});
setTimeout(scheduleHome,200);setTimeout(scheduleHome,650);setTimeout(scheduleHome,1400);

root.dataset.hmCatalog='10.9.3';
})();