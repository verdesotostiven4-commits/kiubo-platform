/* Hakuna Matata 10.7.2 — stable brand search + responsive brand explorer. */
(()=>{
'use strict';
if(window.__hakunaCatalog1072)return;window.__hakunaCatalog1072=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const compact=v=>norm(v).replace(/[^a-z0-9]+/g,'');
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preferred=['Coca-Cola','Toni','Bubbaloo','Chiclets','Cheese Tris','Cheetos','Chips Ahoy!','Dasani','Fanta','Sprite','Gatorade','Oreo','Doritos','Ruffles','Tostitos','Trident','Ritz','Inacake','Mías','Rellenitas','Natura','Power','Yogu Yogu','Galak','Gansitos','Lechera','Vivant','Chiki','Club Social','De Todito','Fiora','Güitig','Halls','Kataboom','Plop','Pony Malta','Salticas','Apetitas','Barrilete','Ducales','Inca','Kinder','Manicho','Pulp','Rocklets','Sabiloe','Tru','Tumix'];
const themes={'coca-cola':['#fff','#e5202b'],'toni':['#3157a2','#fff'],'bubbaloo':['#fff','#173f86'],'chiclets':['#fff8ce','#26231c'],'cheese-tris':['#fff4e9','#c95e12'],'nestle':['#fff','#d5272c'],'chips-ahoy':['#f4fbff','#0b54a0'],'club-social':['#edf5ff','#0d4c8e'],'chiki':['#fff4d6','#d91f2b']};
let fullBrands=[];
let savedRailLeft=Number(sessionStorage.getItem(`hm1072-brand-left:${slug}`)||0)||0;
let suggestionCache={q:'',html:''};
let busy=false,raf=0;

function visual(name){
  const k=key(name),assetKey=k==='kinder'&&!(window.KIUBO_BRAND_ASSETS||{})[k]?'kinder-joy':k,url=(window.KIUBO_BRAND_ASSETS||{})[assetKey],t=themes[k]||['#f7f8f5','#244937'];
  return url
    ?`<span class="hm-brand-visual has-image" data-brand-key="${esc(assetKey)}"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy" decoding="async"></span>`
    :`<span class="hm-brand-visual hm1072-fallback" data-brand-key="${esc(assetKey)}" style="--hm-brand-bg:${t[0]};--hm-brand-fg:${t[1]}"><b>${esc(name)}</b></span>`;
}
function orderedFromProducts(products){const counts=new Map(),canonical=new Map();for(const p of Array.isArray(products)?products:[]){if(p?.visible===false||p?.archived_at)continue;const n=String(p?.brand||'').trim();if(!n)continue;const k=norm(n);canonical.set(k,canonical.get(k)||n);counts.set(k,(counts.get(k)||0)+1)}const first=preferred.map(x=>canonical.get(norm(x))).filter(Boolean),used=new Set(first.map(norm)),rest=[...canonical.values()].filter(x=>!used.has(norm(x))).sort((a,b)=>(counts.get(norm(b))||0)-(counts.get(norm(a))||0)||a.localeCompare(b,'es'));return[...first,...rest]}
function cachedProducts(){try{return JSON.parse(localStorage.getItem(`kiubo-v10-bootstrap:${slug}`)||'{}')?.products||[]}catch{return[]}}
function activeBrand(){return $('#activeFilterHost .v10-active-filter b')?.textContent?.trim()||$('.hm-v104-catalog-brands [data-brand-chip].active')?.dataset.brandChip||''}
function bindRail(rail){if(!rail||rail.dataset.hm1072Bound==='1')return;rail.dataset.hm1072Bound='1';rail.addEventListener('scroll',()=>{savedRailLeft=rail.scrollLeft;try{sessionStorage.setItem(`hm1072-brand-left:${slug}`,String(savedRailLeft))}catch{}},{passive:true})}
function restoreRail(rail){if(!rail)return;const max=Math.max(0,rail.scrollWidth-rail.clientWidth),left=Math.max(0,Math.min(savedRailLeft,max));rail.scrollLeft=left;queueMicrotask(()=>{if(rail.isConnected)rail.scrollLeft=Math.max(0,Math.min(savedRailLeft,Math.max(0,rail.scrollWidth-rail.clientWidth)))});requestAnimationFrame(()=>{if(rail.isConnected)rail.scrollLeft=Math.max(0,Math.min(savedRailLeft,Math.max(0,rail.scrollWidth-rail.clientWidth)))})}
function rebuildRail(){const rail=$('.hm-v104-catalog-brands');if(!rail||!fullBrands.length)return;bindRail(rail);const expected=fullBrands.length+1,active=norm(activeBrand()),buttons=$$('[data-brand-chip]',rail);const same=buttons.length===expected&&rail.dataset.hm1072==='1';if(!same){busy=true;rail.innerHTML=`<button type="button" class="hm1043-all ${!active?'active':''}" data-brand-chip="" aria-label="Ver todos los productos"><span>Todos</span></button>`+fullBrands.map(name=>`<button type="button" data-brand-chip="${esc(name)}" class="${active&&norm(name)===active?'active':''}" aria-label="Ver ${esc(name)}">${visual(name)}</button>`).join('');rail.dataset.hm1072='1';rail.dataset.hm1072Count=String(fullBrands.length);restoreRail(rail);busy=false}else{$$('[data-brand-chip]',rail).forEach(b=>b.classList.toggle('active',active?norm(b.dataset.brandChip)===active:!b.dataset.brandChip));restoreRail(rail)}}
async function loadBrands(){const registry=Array.isArray(window.KIUBO_BRAND_ORDERED)?window.KIUBO_BRAND_ORDERED.filter(Boolean):[],cached=orderedFromProducts(cachedProducts());fullBrands=cached.length>=registry.length?cached:registry;if(fullBrands.length){window.KIUBO_BRAND_ORDERED=fullBrands.slice();rebuildRail()}if(!C.apiUrl)return;try{const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':'10.7.2'},body:JSON.stringify({action:'catalog_bootstrap',slug})});if(!r.ok)return;const p=await r.json(),live=orderedFromProducts(p?.products);if(live.length){fullBrands=live;window.KIUBO_BRAND_ORDERED=live.slice();window.dispatchEvent(new CustomEvent('kiubo:brands-ready',{detail:{brands:live.slice()}}));rebuildRail()}}catch{}}
function matchingBrands(q){const n=norm(q);if(!n)return[];return fullBrands.filter(b=>norm(b).includes(n)||compact(b).includes(compact(q))).sort((a,b)=>Number(!norm(a).startsWith(n))-Number(!norm(b).startsWith(n))||a.localeCompare(b,'es')).slice(0,4)}
function updateViewportVar(){const vv=window.visualViewport;document.documentElement.style.setProperty('--hm1072-vvh',`${Math.round(vv?.height||window.innerHeight)}px`)}

function installUxStyles(){
  if($('#hm1072BrandUx'))return;
  const style=document.createElement('style');style.id='hm1072BrandUx';style.textContent=`
  /* Search brand results are neutral cards. Brand artwork never paints the entire row. */
  .hm1072-search-brands{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
  .hm1072-search-brands>small{grid-column:1/-1!important}
  .hm1072-search-brands>button[data-hm-search-brand]{display:grid!important;grid-template-columns:66px minmax(0,1fr) 22px!important;align-items:center!important;gap:10px!important;min-height:78px!important;padding:8px 10px!important;border:1px solid #e3e9e4!important;border-radius:18px!important;background:#fff!important;color:#173d2b!important;text-align:left!important;box-shadow:none!important;overflow:hidden!important}
  .hm1072-search-brands>button[data-hm-search-brand]:hover{border-color:#bfd2c6!important;background:#f8fbf8!important}
  .hm1072-search-brand-logo{display:grid!important;place-items:center!important;width:64px!important;height:54px!important;border-radius:13px!important;overflow:hidden!important;background:#fff!important}
  .hm1072-search-brand-logo .hm-brand-visual{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;padding:2px!important;background:#fff!important;border-radius:12px!important;overflow:hidden!important}
  .hm1072-search-brand-logo .hm-brand-visual img{display:block!important;width:94%!important;height:88%!important;max-width:none!important;object-fit:contain!important;margin:auto!important;opacity:1!important;transform:none!important}
  .hm1072-search-brand-logo .hm1072-fallback{background:var(--hm-brand-bg,#f7f8f5)!important;color:var(--hm-brand-fg,#244937)!important}
  .hm1072-search-brands>button[data-hm-search-brand]>div{display:grid!important;gap:3px!important;min-width:0!important}
  .hm1072-search-brands>button[data-hm-search-brand] strong{font-size:13px!important;line-height:1.15!important;color:#173d2b!important;white-space:normal!important}
  .hm1072-search-brands>button[data-hm-search-brand] em{font-style:normal!important;font-size:9px!important;color:#7c8980!important}
  .hm1072-search-brands>button[data-hm-search-brand]>i{font-style:normal!important;font-size:22px!important;color:#ef7048!important;text-align:center!important}

  /* Brand explorer: visual grid instead of one very long row per brand. */
  .hm1071-brand-sheet{width:min(920px,calc(100vw - 24px))!important;max-height:min(88dvh,780px)!important}
  .hm1071-brand-sheet .v10-sheet-scroll{padding-bottom:28px!important}
  .hm1071-brand-sheet .v10-filter-sheet{display:grid!important;gap:14px!important}
  .hm1071-brand-sheet .v10-brand-search{position:sticky!important;top:0!important;z-index:6!important;background:#fff!important;margin:0!important;box-shadow:0 12px 18px -18px rgba(14,50,31,.45)!important}
  .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;align-items:stretch!important}
  .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid>[data-brand-option]{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-width:0!important;min-height:108px!important;padding:10px 8px!important;border:1px solid #e2e8e3!important;border-radius:18px!important;background:#fff!important;color:#173d2b!important;text-align:center!important;box-shadow:0 3px 12px rgba(22,52,34,.025)!important;overflow:hidden!important}
  .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid>[data-brand-option]:hover{border-color:#bfd1c5!important;background:#f8fbf8!important}
  .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid>[data-brand-option].active{border-color:#5c9678!important;box-shadow:inset 0 0 0 1px #5c9678!important;background:#f2f8f4!important}
  .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid>[data-brand-option][hidden]{display:none!important}
  .hm1072-brand-tile-logo{display:grid!important;place-items:center!important;width:100%!important;height:58px!important;min-width:0!important;border-radius:12px!important;overflow:hidden!important;background:#fff!important}
  .hm1072-brand-tile-logo .hm-brand-visual{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;padding:2px!important;border-radius:12px!important;overflow:hidden!important;background:#fff!important}
  .hm1072-brand-tile-logo .hm-brand-visual img{width:92%!important;height:88%!important;max-width:none!important;object-fit:contain!important;display:block!important;margin:auto!important;opacity:1!important;transform:none!important}
  .hm1072-brand-tile-logo .hm1072-fallback{background:var(--hm-brand-bg,#f7f8f5)!important;color:var(--hm-brand-fg,#244937)!important}
  .hm1072-brand-tile-name{display:block!important;max-width:100%!important;font-size:11px!important;font-weight:850!important;line-height:1.15!important;white-space:normal!important;overflow-wrap:anywhere!important;color:#173d2b!important}
  .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid>.hm1072-all-brands{grid-column:1/-1!important;min-height:66px!important;display:grid!important;grid-template-columns:48px minmax(0,1fr) 24px!important;grid-template-rows:auto auto!important;align-items:center!important;justify-items:start!important;column-gap:10px!important;text-align:left!important;padding:8px 14px!important}
  .hm1072-all-icon{grid-row:1/3!important;display:grid!important;place-items:center!important;width:46px!important;height:46px!important;border-radius:13px!important;background:#e9f4ed!important;color:#17603e!important;font-size:22px!important}
  .hm1072-all-brands strong{font-size:12px!important;color:#173d2b!important}
  .hm1072-all-brands small{font-size:9px!important;color:#7e8b82!important}
  .hm1072-all-brands i{grid-column:3!important;grid-row:1/3!important;justify-self:end!important;font-style:normal!important;font-size:22px!important;color:#17603e!important}

  @media(min-width:1100px){
    .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
  }
  @media(max-width:720px){
    .hm1072-search-brands{grid-template-columns:1fr!important}
    .hm1071-brand-sheet{width:100%!important;max-height:88dvh!important}
    .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
    .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid>[data-brand-option]{min-height:98px!important;padding:8px 6px!important;border-radius:16px!important}
    .hm1072-brand-tile-logo{height:52px!important}
    .hm1072-brand-tile-name{font-size:10px!important}
    .hm1071-brand-sheet .v10-brand-options.hm1072-brand-grid>.hm1072-all-brands{min-height:62px!important}
  }
  @media(max-width:380px){
    .hm1072-search-brands>button[data-hm-search-brand]{grid-template-columns:58px minmax(0,1fr) 18px!important}
    .hm1072-search-brand-logo{width:56px!important;height:50px!important}
  }
  `;document.head.append(style);
}

function clearSearchUi({clearInput=false}={}){
  const view=$('#catalogView'),input=$('#catalogSearch'),box=$('#searchSuggestions');
  view?.classList.remove('hm1072-searching');
  if(clearInput&&input){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}))}
  if(box){box.hidden=true;box.dataset.hm1072Q='';if(box.querySelector('.hm1072-search-panel'))box.innerHTML=''}
}
function selectBrandFromSearch(name){
  const wanted=norm(name);if(!wanted)return;
  clearSearchUi({clearInput:true});
  const chip=$$('.hm-v104-catalog-brands [data-brand-chip]').find(b=>norm(b.dataset.brandChip||'')===wanted);
  if(chip){chip.click();setTimeout(()=>$('.v10-catalog-body')?.scrollIntoView({block:'start',behavior:'smooth'}),110);return}
  const filter=$('#filterBtn');if(filter){filter.click();setTimeout(()=>{const option=$$('[data-brand-option]').find(b=>norm(b.dataset.brandOption||'')===wanted);option?.click()},80)}
}
function decorateSearch(){
  const view=$('#catalogView'),input=$('#catalogSearch'),box=$('#searchSuggestions');if(!view||!input||!box)return;
  const q=input.value.trim(),n=norm(q);view.classList.toggle('hm1072-searching',!!n);updateViewportVar();
  if(!n){box.dataset.hm1072Q='';box.hidden=true;if(box.querySelector('.hm1072-search-panel'))box.innerHTML='';suggestionCache={q:'',html:''};return}
  const raw=$$(':scope > [data-search-product]',box);if(raw.length){suggestionCache={q:n,html:raw.map(b=>b.outerHTML).join('')}}
  if(box.querySelector('.hm1072-search-panel')?.dataset.q===n){box.hidden=false;return}
  let productHtml=raw.length?raw.map(b=>b.outerHTML).join(''):(suggestionCache.q===n?suggestionCache.html:'');
  const brands=matchingBrands(q),temp=document.createElement('div');temp.innerHTML=productHtml;$$('[data-search-product]',temp).forEach(b=>{b.dataset.open=b.dataset.searchProduct;delete b.dataset.searchProduct});
  const products=temp.innerHTML;
  const brandBlock=brands.length?`<section class="hm1072-search-section hm1072-search-brands"><small>MARCAS</small>${brands.map(b=>`<button type="button" data-hm-search-brand="${esc(b)}"><span class="hm1072-search-brand-logo">${visual(b)}</span><div><strong>${esc(b)}</strong><em>Ver toda la marca</em></div><i>›</i></button>`).join('')}</section>`:'';
  const productBlock=products?`<section class="hm1072-search-section hm1072-search-products"><small>PRODUCTOS</small>${products}</section>`:'';
  const empty=!brandBlock&&!productBlock?'<div class="hm1072-search-empty"><b>No encontramos coincidencias</b><span>Prueba con otra palabra, marca o categoría.</span></div>':'';
  busy=true;box.innerHTML=`<div class="hm1072-search-panel" data-q="${esc(n)}">${brandBlock}${productBlock}${empty}</div>`;box.hidden=false;busy=false;
}
function setBrandSheetKeyboard(sheet,input){const vv=window.visualViewport;if(!vv||!sheet||!input)return;const focused=document.activeElement===input,keyboard=focused&&(window.innerHeight-vv.height>120||vv.height<window.innerHeight*.82);sheet.classList.toggle('hm1071-keyboard',keyboard);if(keyboard){sheet.style.setProperty('--hm1071-top',`${Math.max(8,Math.round(vv.offsetTop+8))}px`);sheet.style.setProperty('--hm1071-height',`${Math.max(280,Math.round(vv.height-16))}px`);const scroller=$('.v10-sheet-scroll',sheet),search=$('.v10-brand-search',sheet);if(scroller&&search){const target=Math.max(0,search.offsetTop-18);if(Math.abs(scroller.scrollTop-target)>8)scroller.scrollTop=target}}else{sheet.style.removeProperty('--hm1071-top');sheet.style.removeProperty('--hm1071-height')}}
function decorateBrandOptions(options){
  if(!options)return;options.classList.add('hm1072-brand-grid');
  $$('[data-brand-option]',options).forEach((b,i)=>{
    if(b.dataset.hm1072Tile==='1')return;b.dataset.hm1072Tile='1';
    const name=String(b.dataset.brandOption||'').trim();
    if(i===0||!name){b.classList.add('hm1072-all-brands');b.innerHTML='<span class="hm1072-all-icon">▦</span><strong>Todas las marcas</strong><small>Ver todo el catálogo</small><i>›</i>';return}
    b.innerHTML=`<span class="hm1072-brand-tile-logo">${visual(name)}</span><span class="hm1072-brand-tile-name">${esc(name)}</span>`;
    b.setAttribute('aria-label',`Ver productos de ${name}`);
  });
}
function enhanceBrandSheet(){
  const input=$('#brandSearch');if(!input)return;const sheet=input.closest('.v10-sheet');if(!sheet)return;
  sheet.classList.add('hm1071-brand-sheet');const options=$('.v10-brand-options',sheet);decorateBrandOptions(options);
  const refresh=()=>{const q=norm(input.value);let first=null;$$('[data-brand-option]',options||sheet).forEach((b,i)=>{if(i===0){b.hidden=!!q;return}const show=!q||norm(b.dataset.brandOption||b.textContent).includes(q);b.hidden=!show;if(show&&!first)first=b});requestAnimationFrame(()=>{setBrandSheetKeyboard(sheet,input);if(q&&first)first.scrollIntoView({block:'nearest',behavior:'instant'})})};
  if(input.dataset.hm1072!=='1'){
    input.dataset.hm1072='1';input.addEventListener('focus',()=>setTimeout(()=>setBrandSheetKeyboard(sheet,input),60));input.addEventListener('input',refresh,true);input.addEventListener('search',refresh,true);
  }
  refresh();
}
function enhance(){if(busy)return;installUxStyles();rebuildRail();decorateSearch();enhanceBrandSheet();document.documentElement.dataset.hmCatalog='10.7.2'}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})}

document.addEventListener('pointerdown',e=>{const chip=e.target.closest?.('.hm-v104-catalog-brands [data-brand-chip]');if(chip){const rail=chip.closest('.hm-v104-catalog-brands');savedRailLeft=rail?.scrollLeft||0;try{sessionStorage.setItem(`hm1072-brand-left:${slug}`,String(savedRailLeft))}catch{}}},true);
document.addEventListener('click',e=>{const result=e.target.closest?.('[data-hm-search-brand]');if(!result)return;e.preventDefault();e.stopImmediatePropagation();selectBrandFromSearch(result.dataset.hmSearchBrand)},true);
document.addEventListener('input',e=>{if(e.target?.id==='catalogSearch')setTimeout(schedule,0)},true);
document.addEventListener('click',()=>setTimeout(schedule,0),true);
window.visualViewport?.addEventListener('resize',()=>{updateViewportVar();schedule()},{passive:true});window.visualViewport?.addEventListener('scroll',updateViewportVar,{passive:true});
window.addEventListener('kiubo:brands-ready',()=>{const r=window.KIUBO_BRAND_ORDERED||[];if(r.length>fullBrands.length)fullBrands=r.slice();schedule()});window.addEventListener('pageshow',schedule);
new MutationObserver(()=>{if(!busy)schedule()}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installUxStyles();loadBrands();updateViewportVar();schedule()},{once:true});else{installUxStyles();loadBrands();updateViewportVar();schedule()}
})();
