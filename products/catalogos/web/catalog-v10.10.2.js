/* Hakuna Matata 10.10.5 — deterministic search routing + first-paint guard. */
(()=>{
'use strict';
if(window.__hakunaCatalog10105)return;window.__hakunaCatalog10105=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const safeId=v=>window.CSS?.escape?CSS.escape(String(v)):String(v).replace(/["\\]/g,'\\$&');
let heroFallbackTimer=0;
function installStyle(){
  if($('#hm10105InteractionFix'))return;
  const style=document.createElement('style');style.id='hm10105InteractionFix';style.textContent=`
    #sheetHost .v10-backdrop{z-index:5000!important}
    #sheetHost .v10-sheet{z-index:5001!important}
    html.hm10105-sheet-open #searchSuggestions{visibility:hidden!important;pointer-events:none!important}
    html.hm10105-sheet-open #catalogView.hm105-search-mode .v10-catalog-body{visibility:visible!important}
    #homeView .hm-hero-carousel{transition:opacity .14s ease!important}
    html:not(.hm10105-hero-ready):not(.hm10105-hero-fallback) #homeView .hm-hero-carousel{opacity:0!important;visibility:hidden!important}
  `;document.head.append(style);
  if(!document.querySelector('link[data-hm10105-hero-preload]')){
    const preload=document.createElement('link');preload.rel='preload';preload.as='image';preload.dataset.hm10105HeroPreload='1';preload.href='https://blogger.googleusercontent.com/img/a/AVvXsEi0hDelNFtHhwoe6guvslOKkEqE0a4o3qVn_Mnut7m2IPdXwfoGDifE1S5QksIbMEDzm_LFESZjvksQ3JEKR_i5iFIYzTkCryXadiPRtu7R9w00ZOtqLTFnDZEUdStZX1IyEbuPqy4CR8QCVlqrVoMEl2Q7FqCzkreaLh26NUkdZJ-TCRQbrvooScWcthA';document.head.append(preload)
  }
}
function hideSearchSurface(){
  const view=$('#catalogView'),box=$('#searchSuggestions');
  view?.classList.remove('hm105-search-mode','hm1072-searching');
  if(box){box.hidden=true;box.classList.remove('hm105-results');box.style.removeProperty('--hm-search-top');box.style.removeProperty('--hm-search-max')}
}
function routeProduct(id){
  id=String(id||'').trim();if(!id)return;
  hideSearchSurface();let tries=0;
  const run=()=>{
    const eid=safeId(id),card=$(`#catalogResults [data-product="${eid}"]`),target=card?.querySelector(`[data-open="${eid}"]`)||card?.querySelector('[data-open]');
    if(target){target.click();return}
    if(tries++<12)setTimeout(run,35);
  };
  requestAnimationFrame(run);
}
function routeBrand(name){
  const wanted=norm(name);if(!wanted)return;
  hideSearchSurface();
  const chip=$$('.hm-v104-catalog-brands [data-brand-chip]').find(b=>norm(b.dataset.brandChip||'')===wanted);
  if(chip){chip.click();return}
  const filter=$('#filterBtn');if(!filter)return;filter.click();let tries=0;
  const pick=()=>{const option=$$('#sheetHost [data-brand-option]').find(b=>norm(b.dataset.brandOption||'')===wanted);if(option){option.click();return}if(tries++<12)requestAnimationFrame(pick)};requestAnimationFrame(pick);
}
function interceptSearchClick(e){
  if(!e.target.closest?.('#searchSuggestions'))return;
  const product=e.target.closest?.('[data-search-product],[data-open]');
  if(product){const id=product.dataset.searchProduct??product.dataset.open;if(id){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();routeProduct(id)}return}
  const brand=e.target.closest?.('[data-hm-search-brand],[data-brand-chip]');
  if(brand){const name=brand.dataset.hmSearchBrand??brand.dataset.brandChip;if(name){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();routeBrand(name)}}
}
document.addEventListener('click',interceptSearchClick,true);
document.addEventListener('keydown',e=>{
  if(e.target?.id!=='catalogSearch'||e.key!=='Enter')return;
  const first=$('#searchSuggestions [data-search-product],#searchSuggestions [data-open]');if(!first)return;
  const id=first.dataset.searchProduct??first.dataset.open;if(!id)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();routeProduct(id);
},true);
function syncSheetState(){
  installStyle();root.classList.remove('hm108-brand-routing');
  const open=!!$('#sheetHost .v10-sheet');root.classList.toggle('hm10105-sheet-open',open);if(open)hideSearchSurface();
}
function syncHeroState(){
  const hero=$('#homeView .hm-hero-carousel');if(!hero)return;
  const final=$('#homeView .hm-slide-main.hm109-image-slide .hm109-hero-image');
  if(final){root.classList.add('hm10105-hero-ready');root.classList.remove('hm10105-hero-fallback');clearTimeout(heroFallbackTimer);heroFallbackTimer=0;return}
  if(!heroFallbackTimer)heroFallbackTimer=setTimeout(()=>{if($('#homeView .hm-hero-carousel')&&!$('#homeView .hm-slide-main.hm109-image-slide .hm109-hero-image'))root.classList.add('hm10105-hero-fallback')},3200);
}
function sync(){syncSheetState();syncHeroState()}
installStyle();root.classList.remove('hm108-brand-routing');
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('pageshow',sync);
document.documentElement.dataset.hmInteractionFix='10.10.5';
})();
