/* Hakuna Matata 10.10.3 — deterministic search-result router using native catalog actions. */
(()=>{
'use strict';
if(window.__hakunaCatalog10103)return;window.__hakunaCatalog10103=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let routing=false;
const afterPaint=fn=>requestAnimationFrame(()=>requestAnimationFrame(fn));
function resetVisualSearch(){
  const view=$('#catalogView'),box=$('#searchSuggestions');
  view?.classList.remove('hm105-search-mode','hm1072-searching');
  if(box){box.hidden=true;box.classList.remove('hm105-results');box.style.removeProperty('--hm-search-top');box.style.removeProperty('--hm-search-max');box.dataset.hm1072Q=''}
}
function clearSearch(done){
  const clear=$('#clearSearch');
  if(clear&&!clear.hidden){
    clear.click();
    afterPaint(()=>{resetVisualSearch();done()});
    return;
  }
  const input=$('#catalogSearch');
  if(input?.value){
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
    setTimeout(()=>{resetVisualSearch();done()},130);
    return;
  }
  resetVisualSearch();done();
}
function finishSoon(){setTimeout(()=>{routing=false},180)}
function routeProduct(id){
  if(!id||routing)return;routing=true;
  clearSearch(()=>{
    const card=$(`[data-product="${CSS.escape(String(id))}"]`,$('#catalogResults'));
    const open=card?.querySelector(`[data-open="${CSS.escape(String(id))}"]`);
    if(open){open.click();finishSoon();return}
    routing=false;
  });
}
function routeBrand(name){
  const wanted=norm(name);if(!wanted||routing)return;routing=true;
  clearSearch(()=>{
    const chip=$$('[data-brand-chip]').find(el=>!el.closest('#searchSuggestions')&&norm(el.dataset.brandChip||'')===wanted);
    if(chip){chip.click();afterPaint(()=>{$('.v10-catalog-body')?.scrollIntoView({block:'start',behavior:'smooth'});finishSoon()});return}
    const filter=$('#filterBtn');
    if(!filter){routing=false;return}
    filter.click();
    let tries=0;
    const pick=()=>{
      const option=$$('#sheetHost [data-brand-option]').find(el=>norm(el.dataset.brandOption||'')===wanted);
      if(option){option.click();afterPaint(finishSoon);return}
      if(tries++<15){requestAnimationFrame(pick);return}
      $('#sheetHost .v10-sheet-close')?.click();routing=false;
    };
    requestAnimationFrame(pick);
  });
}
window.addEventListener('click',e=>{
  if(!e.target.closest?.('#searchSuggestions'))return;
  const brand=e.target.closest?.('[data-hm-search-brand],[data-brand-chip]');
  if(brand){
    const name=String(brand.dataset.hmSearchBrand??brand.dataset.brandChip??'').trim();
    if(!name)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    routeBrand(name);return;
  }
  const product=e.target.closest?.('[data-search-product],[data-open]');
  if(product){
    const id=String(product.dataset.searchProduct??product.dataset.open??'').trim();
    if(!id)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    routeProduct(id);
  }
},true);
window.addEventListener('pageshow',()=>{routing=false;resetVisualSearch()});
document.documentElement.dataset.hmSearchRouter='10.10.3';
})();
