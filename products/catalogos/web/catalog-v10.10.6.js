/* Hakuna Matata 10.10.6 — isolated search-result routing + final hero reveal. */
(()=>{
'use strict';
if(window.__hakunaCatalog10106)return;window.__hakunaCatalog10106=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const cssEscape=v=>window.CSS?.escape?CSS.escape(String(v)):String(v).replace(/["\\]/g,'\\$&');

function clearSearchSurface(){
  const input=$('#catalogSearch'),box=$('#searchSuggestions'),view=$('#catalogView');
  if(input){
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
  }
  if(box){
    box.hidden=true;
    box.innerHTML='';
    box.classList.remove('hm105-results');
    box.style.removeProperty('--hm-search-top');
    box.style.removeProperty('--hm-search-max');
  }
  view?.classList.remove('hm105-search-mode','hm1072-searching');
}

function resetCatalogFilters(next){
  const clearBrand=$('#clearBrand');
  const finish=()=>{
    const all=$('.v10-category-rail [data-category="all"]');
    if(all&&!all.classList.contains('active'))all.click();
    setTimeout(next,45);
  };
  if(clearBrand){clearBrand.click();setTimeout(finish,35)}else finish();
}

function openRealProduct(id){
  id=String(id||'').trim();if(!id)return;
  clearSearchSurface();
  resetCatalogFilters(()=>{
    let tries=0;
    const run=()=>{
      const safe=cssEscape(id),card=$(`#catalogResults [data-product="${safe}"]`),target=card?.querySelector(`[data-open="${safe}"]`)||card?.querySelector('[data-open]');
      if(target){target.click();return}
      if(tries++<24)setTimeout(run,35);
    };
    run();
  });
}

function selectRealBrand(name){
  name=String(name||'').trim();if(!name)return;
  const wanted=norm(name);
  clearSearchSurface();
  let tries=0;
  const run=()=>{
    const chip=$$('.hm-v104-catalog-brands [data-brand-chip]').find(b=>norm(b.dataset.brandChip||'')===wanted);
    if(chip){chip.click();return}
    if(tries++===0)$('#filterBtn')?.click();
    const option=$$('#sheetHost [data-brand-option]').find(b=>norm(b.dataset.brandOption||'')===wanted);
    if(option){option.click();return}
    if(tries<24)setTimeout(run,35);
  };
  requestAnimationFrame(run);
}

function stopEvent(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}

/* Window capture runs before all document-level legacy handlers. Scope is ONLY search results. */
window.addEventListener('click',e=>{
  if(!e.target.closest?.('#searchSuggestions'))return;
  const brand=e.target.closest?.('.hm1072-search-brands [data-brand-chip],.hm105-search-brands [data-brand-chip],[data-hm-search-brand]');
  if(brand){
    const name=brand.dataset.hmSearchBrand||brand.dataset.brandChip||'';
    if(name){stopEvent(e);selectRealBrand(name)}
    return;
  }
  const product=e.target.closest?.('[data-search-product],[data-open]');
  if(product){
    const id=product.dataset.searchProduct||product.dataset.open||'';
    if(id){stopEvent(e);openRealProduct(id)}
  }
},true);

window.addEventListener('keydown',e=>{
  if(e.target?.id!=='catalogSearch'||e.key!=='Enter')return;
  const box=$('#searchSuggestions');if(!box||box.hidden)return;
  const product=box.querySelector('[data-search-product],[data-open]');
  const brand=box.querySelector('.hm1072-search-brands [data-brand-chip],.hm105-search-brands [data-brand-chip],[data-hm-search-brand]');
  const target=product||brand;if(!target)return;
  stopEvent(e);
  if(product)openRealProduct(product.dataset.searchProduct||product.dataset.open||'');
  else selectRealBrand(brand.dataset.hmSearchBrand||brand.dataset.brandChip||'');
},true);

/* Mobile brand picker: keep filtered results visible above the virtual keyboard. */
let brandRevealTimer=0;
function ensureBrandKeyboardStyle(){
  if($('#hm10106-brand-keyboard-style'))return;
  const style=document.createElement('style');
  style.id='hm10106-brand-keyboard-style';
  style.textContent=`
    .hm1071-brand-sheet.hm1071-keyboard{left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(640px,100%)!important}
    .hm1071-brand-sheet.hm1071-keyboard.show{transform:translateX(-50%)!important}
    .hm1071-brand-sheet.hm1071-keyboard .hm-brand-sheet>div:first-child{display:none!important}
    .hm1071-brand-sheet.hm1071-keyboard .v10-brand-search{margin-top:0!important;margin-bottom:8px!important;position:sticky!important;top:0!important;z-index:8!important;background:#fff!important}
    .hm1071-brand-sheet.hm1071-keyboard .v10-brand-options{padding-top:4px!important}
    .hm1071-brand-sheet.hm1071-keyboard .v10-brand-options>[data-brand-option]:not([hidden]){scroll-margin-top:68px!important}
  `;
  document.head.appendChild(style);
}
function brandPickerParts(){
  const input=$('#brandSearch');
  if(!input)return null;
  const sheet=input.closest('.v10-sheet');
  if(!sheet)return null;
  return {input,sheet,scroller:$('.v10-sheet-scroll',sheet),search:input.closest('.v10-brand-search'),options:$('.v10-brand-options',sheet)};
}
function firstVisibleBrand(options){
  if(!options)return null;
  return $$('[data-brand-option]',options).find(el=>{
    if(el.hidden||!el.dataset.brandOption)return false;
    const cs=getComputedStyle(el);
    return cs.display!=='none'&&cs.visibility!=='hidden';
  })||null;
}
function fitBrandPickerToViewport(parts){
  if(!parts||document.activeElement!==parts.input)return false;
  const vv=window.visualViewport;
  if(!vv)return false;
  const keyboardOpen=(window.innerHeight-vv.height)>90||vv.height<window.innerHeight*.88;
  if(!keyboardOpen)return false;
  const top=Math.max(6,Math.round(vv.offsetTop+6));
  const height=Math.max(250,Math.round(vv.height-12));
  parts.sheet.classList.add('hm1071-keyboard');
  parts.sheet.style.setProperty('--hm1071-top',`${top}px`);
  parts.sheet.style.setProperty('--hm1071-height',`${height}px`);
  parts.sheet.style.setProperty('left','50%','important');
  parts.sheet.style.setProperty('right','auto','important');
  parts.sheet.style.setProperty('transform','translateX(-50%)','important');
  parts.sheet.style.setProperty('width','min(640px,100%)','important');
  return true;
}
function revealFilteredBrand(){
  const parts=brandPickerParts();
  if(!parts||!parts.scroller||!parts.search||!parts.options)return;
  if(!fitBrandPickerToViewport(parts))return;
  const q=parts.input.value.trim();
  if(!q)return;
  const first=firstVisibleBrand(parts.options);
  if(!first)return;
  requestAnimationFrame(()=>{
    const scRect=parts.scroller.getBoundingClientRect();
    const searchRect=parts.search.getBoundingClientRect();
    const firstRect=first.getBoundingClientRect();
    const desiredTop=Math.max(scRect.top+6,searchRect.bottom+8);
    const delta=firstRect.top-desiredTop;
    if(Math.abs(delta)>2)parts.scroller.scrollTop+=delta;
  });
}
function scheduleFilteredBrandReveal(){
  clearTimeout(brandRevealTimer);
  requestAnimationFrame(revealFilteredBrand);
  brandRevealTimer=setTimeout(revealFilteredBrand,80);
  setTimeout(revealFilteredBrand,180);
  setTimeout(revealFilteredBrand,320);
}
function clearBrandKeyboardOverrides(){
  const parts=brandPickerParts();
  if(!parts||document.activeElement===parts.input)return;
  setTimeout(()=>{
    const latest=brandPickerParts();
    if(!latest||document.activeElement===latest.input)return;
    latest.sheet.style.removeProperty('left');
    latest.sheet.style.removeProperty('right');
    latest.sheet.style.removeProperty('transform');
    latest.sheet.style.removeProperty('width');
  },180);
}
window.addEventListener('input',e=>{if(e.target?.id==='brandSearch')scheduleFilteredBrandReveal()},true);
window.addEventListener('focusin',e=>{if(e.target?.id==='brandSearch')scheduleFilteredBrandReveal()},true);
window.addEventListener('focusout',e=>{if(e.target?.id==='brandSearch')clearBrandKeyboardOverrides()},true);
window.visualViewport?.addEventListener('resize',scheduleFilteredBrandReveal,{passive:true});
window.visualViewport?.addEventListener('scroll',scheduleFilteredBrandReveal,{passive:true});

/* Reveal homepage only after 10.9 has mounted the final artwork. */
let heroFallback=0;
function revealHero(){
  const img=$('#homeView .hm-slide-main.hm109-image-slide .hm109-hero-image');
  if(!img)return false;
  const done=()=>{root.classList.add('hm10106-hero-ready');root.classList.remove('hm10106-hero-fallback');if(heroFallback){clearTimeout(heroFallback);heroFallback=0}};
  if(img.complete&&img.naturalWidth){done();return true}
  if(!img.dataset.hm10106Bound){img.dataset.hm10106Bound='1';img.addEventListener('load',done,{once:true});img.addEventListener('error',()=>root.classList.add('hm10106-hero-fallback'),{once:true})}
  return true;
}
function sync(){ensureBrandKeyboardStyle();revealHero();root.dataset.hmSearchFix='10.10.6'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
new MutationObserver(sync).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('pageshow',sync);
heroFallback=setTimeout(()=>{if(!root.classList.contains('hm10106-hero-ready'))root.classList.add('hm10106-hero-fallback')},3500);
})();
