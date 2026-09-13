/* Hakuna Matata 10.10.2 — fail-safe searched-brand router. */
(()=>{
'use strict';
if(window.__hakunaCatalog10102)return;window.__hakunaCatalog10102=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let routing=false;
const next2=fn=>requestAnimationFrame(()=>requestAnimationFrame(fn));
function quietSearchUi(){
  const view=$('#catalogView'),box=$('#searchSuggestions');
  view?.classList.remove('hm105-search-mode','hm1072-searching');
  if(box){box.hidden=true;box.classList.remove('hm105-results');box.style.removeProperty('--hm-search-top');box.style.removeProperty('--hm-search-max');box.dataset.hm1072Q=''}
}
function clearSearchState(done){
  const clear=$('#clearSearch');
  if(clear&&!clear.hidden){clear.click();next2(()=>{quietSearchUi();done()});return}
  const input=$('#catalogSearch');
  if(input?.value){input.value='';input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));setTimeout(()=>{quietSearchUi();done()},110);return}
  quietSearchUi();done();
}
function clearCategory(done){
  const all=$('#catalogView [data-category="all"]');
  if(all&&!all.classList.contains('active')){all.click();next2(done);return}
  done();
}
function chooseBrand(name){
  const wanted=norm(name);if(!wanted){routing=false;return}
  const filter=$('#filterBtn');if(!filter){routing=false;return}
  filter.click();
  let tries=0;
  const choose=()=>{
    const sheet=$('#sheetHost .v10-sheet');
    const option=sheet?$$('[data-brand-option]',sheet).find(b=>norm(b.dataset.brandOption||'')===wanted):null;
    if(option){option.click();next2(()=>{quietSearchUi();routing=false;$('.v10-catalog-body')?.scrollIntoView({block:'start',behavior:'smooth'})});return}
    if(tries++<20){requestAnimationFrame(choose);return}
    $('#sheetHost .v10-sheet-close')?.click();routing=false;
  };
  requestAnimationFrame(choose);
}
function route(name){
  if(routing)return;routing=true;
  clearSearchState(()=>clearCategory(()=>chooseBrand(name)));
}
window.addEventListener('click',e=>{
  const result=e.target.closest?.('#searchSuggestions [data-hm-search-brand],#searchSuggestions [data-brand-chip]');
  if(!result)return;
  const name=String(result.dataset.hmSearchBrand??result.dataset.brandChip??'').trim();
  if(!name)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();route(name);
},true);
window.addEventListener('pageshow',quietSearchUi);
document.documentElement.dataset.hmSearchRouter='10.10.2';
})();
