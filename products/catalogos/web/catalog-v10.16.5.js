/* Hakuna Catalog 10.16.5 — stable search overlay, seamless brand marquee and reciprocal filters. */
(()=>{
'use strict';
if(window.__hm1165Catalog)return;window.__hm1165Catalog=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const cacheKey=()=>`kiubo-v10-bootstrap:${slug()}`;
const readJSON=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const compact=v=>norm(v).replace(/[^a-z0-9]+/g,'');
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let renderToken=0,filterGuard=false,marqueeSeq=0,uiRaf=0;

function payload(){return readJSON(cacheKey(),{})||{}}
function visibleProducts(){return (payload().products||[]).filter(p=>p?.visible!==false&&!p?.archived_at)}
function categories(){return payload().categories||[]}
function categoryName(product){return categories().find(c=>String(c.id)===String(product?.category_id))?.name||'Otros'}
function presentationRows(productId){return (payload().presentations||[]).filter(p=>String(p.product_id)===String(productId)&&p.visible!==false).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0))}
function defaultPresentation(product){const rows=presentationRows(product.id);return rows.find(p=>p.is_default)||rows[0]||null}
function productImage(product){const p=defaultPresentation(product);return p?.image_url||product?.image_url||''}
function productPrice(product){const p=defaultPresentation(product);return Number(p?.price??product?.price??0)}
function presentationName(product){const p=defaultPresentation(product);return p?.name||product?.unit||'Unidad'}
function money(n){try{return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0)).replace('US$','$')}catch{return`$${Number(n||0).toFixed(2).replace('.',',')}`}}
function productMatches(p,q){const n=norm(q),c=compact(q);if(!n)return false;return [p.name,p.brand,p.sku,p.unit,categoryName(p)].some(v=>norm(v).includes(n)||compact(v).includes(c))}
function matchingProducts(q){const n=norm(q);return visibleProducts().filter(p=>productMatches(p,q)).sort((a,b)=>{
  const an=norm(a.name),bn=norm(b.name),ab=norm(a.brand),bb=norm(b.brand);
  return Number(!(an.startsWith(n)||ab.startsWith(n)))-Number(!(bn.startsWith(n)||bb.startsWith(n)))||an.localeCompare(bn,'es');
}).slice(0,40)}
function matchingBrands(q){const n=norm(q),c=compact(q),map=new Map();for(const p of visibleProducts()){const b=String(p.brand||'').trim();if(b)map.set(norm(b),b)}return [...map.values()].filter(b=>norm(b).includes(n)||compact(b).includes(c)).sort((a,b)=>Number(!norm(a).startsWith(n))-Number(!norm(b).startsWith(n))||a.localeCompare(b,'es')).slice(0,4)}
function brandAsset(name){const assets=window.KIUBO_BRAND_ASSETS||{},k=key(name),assetKey=k==='kinder'&&!assets[k]?'kinder-joy':k;return assets[assetKey]||''}

function ensureSearchPanel(){let panel=$('#hm1165Search');if(panel)return panel;panel=document.createElement('div');panel.id='hm1165Search';panel.hidden=true;document.body.append(panel);panel.addEventListener('scroll',e=>e.stopPropagation(),{passive:true});return panel}
function placeSearchPanel(){const panel=$('#hm1165Search'),input=$('#catalogSearch');if(!panel||!input||panel.hidden)return;const vv=window.visualViewport,vr={top:vv?.offsetTop||0,height:vv?.height||innerHeight};const rect=input.getBoundingClientRect(),wrap=input.closest('.v102-search-wrap')?.getBoundingClientRect(),nav=$('.v10-nav')?.getBoundingClientRect();const top=Math.max(vr.top+6,rect.bottom+9),visualBottom=vr.top+vr.height-7,navTop=nav?.top||visualBottom,bottom=Math.min(visualBottom,navTop-7),height=Math.max(150,bottom-top);panel.style.top=`${Math.round(top)}px`;panel.style.left=`${Math.round(Math.max(12,wrap?.left??12))}px`;panel.style.right=`${Math.round(Math.max(12,innerWidth-(wrap?.right??(innerWidth-12))))}px`;panel.style.height=`${Math.round(height)}px`}
function imgTag(src,alt=''){return src?`<span class="hm1165-imgbox"><img src="${esc(src)}" alt="${esc(alt)}" loading="eager" decoding="async" fetchpriority="high"></span>`:`<span class="hm1165-imgbox hm1165-empty"></span>`}
function brandMarkup(name){const src=brandAsset(name);return `<button type="button" class="hm1165-search-brand" data-hm1165-brand="${esc(name)}">${imgTag(src,name)}<span class="hm1165-search-copy"><strong>${esc(name)}</strong><small>Ver toda la marca</small></span><i>›</i></button>`}
function productMarkup(p){return `<button type="button" class="hm1165-search-product" data-hm1165-product="${esc(p.id)}">${imgTag(productImage(p),p.name)}<span class="hm1165-search-copy"><strong>${esc(p.name)}</strong><small>${esc(p.brand||categoryName(p))} · ${esc(presentationName(p))}</small></span><em>${money(productPrice(p))}</em></button>`}
function armImages(panel,token){$$('img',panel).forEach(img=>{const ready=()=>{if(token!==renderToken)return;img.classList.add('hm1165-img-ready')};if(img.complete&&img.naturalWidth){if(typeof img.decode==='function')img.decode().catch(()=>{}).finally(ready);else ready()}else{img.addEventListener('load',ready,{once:true});img.addEventListener('error',()=>img.closest('.hm1165-imgbox')?.classList.add('hm1165-img-failed'),{once:true})}})}
function renderSearch(q){const panel=ensureSearchPanel(),query=String(q||'').trim();renderToken++;const token=renderToken;if(!query){panel.hidden=true;panel.innerHTML='';root.classList.remove('hm1165-search-active');return}const brands=matchingBrands(query),products=matchingProducts(query);let html='';if(brands.length)html+=`<section><small>MARCAS</small>${brands.map(brandMarkup).join('')}</section>`;if(products.length)html+=`<section><small>PRODUCTOS</small>${products.map(productMarkup).join('')}</section>`;if(!html)html='<div class="hm1165-empty-search"><b>No encontramos coincidencias</b><span>Prueba con otra palabra, marca o categoría.</span></div>';panel.innerHTML=html;panel.hidden=false;root.classList.add('hm1165-search-active');armImages(panel,token);placeSearchPanel();panel.scrollTop=0}
function syncSearchFromInput(){const input=$('#catalogSearch');if(!input||!$('.v10-nav [data-view="catalog"].active')){const p=$('#hm1165Search');if(p)p.hidden=true;root.classList.remove('hm1165-search-active');return}renderSearch(input.value)}

function clearQuery(){const input=$('#catalogSearch');if(!input)return;input.value='';input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));input.blur();const p=$('#hm1165Search');if(p){p.hidden=true;p.innerHTML=''}root.classList.remove('hm1165-search-active')}
function clickCategoryAll({preserveBrand=false}={}){const all=$('#catalogView .v10-category-rail [data-category="all"]');if(!all||all.classList.contains('active'))return;filterGuard=preserveBrand;all.click();filterGuard=false}
function scrollToProduct(id){let tries=0;const find=()=>{const card=$(`#catalogResults [data-product="${CSS.escape(String(id))}"]`);if(!card&&tries++<20){setTimeout(find,45);return}if(!card)return;card.scrollIntoView({behavior:'smooth',block:'center'});card.classList.remove('hm1165-search-target');void card.offsetWidth;card.classList.add('hm1165-search-target');setTimeout(()=>card.classList.remove('hm1165-search-target'),2000)};setTimeout(find,90)}
function chooseProduct(id){const clear=$('#clearBrand');if(clear)clear.click();clickCategoryAll();clearQuery();scrollToProduct(id)}
function chooseBrand(name){clearQuery();clickCategoryAll({preserveBrand:true});const rail=$('.hm-v104-catalog-brands');const chip=rail?[...rail.querySelectorAll('[data-brand-chip]')].find(b=>norm(b.dataset.brandChip||'')===norm(name)):null;if(chip){chip.click();return}$('#filterBtn')?.click();setTimeout(()=>{const option=[...$$('[data-brand-option]','#sheetHost')].find(b=>norm(b.dataset.brandOption||'')===norm(name));option?.click()},40)}

function removeLegacyArrows(){$$('.hm116-brand-next,.hm1162-brand-next,.hm1164-brand-next').forEach(x=>x.remove())}
function setupBrandMarquee(){const rail=$('.hm-v104-catalog-brands');if(!rail)return;removeLegacyArrows();const signature=[...rail.querySelectorAll(':scope > [data-brand-chip]')].map(b=>b.dataset.brandChip||'').join('|');if(rail.dataset.hm1165Signature===signature&&rail.querySelector('.hm1165-brand-clone'))return;rail.dataset.hm1165Signature=signature;$$(':scope > .hm1165-brand-clone',rail).forEach(x=>x.remove());const originals=[...rail.querySelectorAll(':scope > [data-brand-chip]')].filter(b=>String(b.dataset.brandChip||'').trim());if(originals.length<2)return;const frag=document.createDocumentFragment();for(const b of originals){const clone=b.cloneNode(true);const name=b.dataset.brandChip||'';clone.removeAttribute('data-brand-chip');clone.dataset.hm1165BrandClone=name;clone.classList.add('hm1165-brand-clone');clone.classList.remove('active');frag.append(clone)}rail.append(frag);const first=originals[0],cloneFirst=rail.querySelector(':scope > .hm1165-brand-clone');const seq=++marqueeSeq;let dragging=false,pauseUntil=performance.now()+900,last=performance.now();const loopWidth=()=>cloneFirst&&first?cloneFirst.offsetLeft-first.offsetLeft:0;rail.addEventListener('pointerdown',()=>{dragging=true},{passive:true});const end=()=>{dragging=false;pauseUntil=performance.now()+2200};rail.addEventListener('pointerup',end,{passive:true});rail.addEventListener('pointercancel',end,{passive:true});rail.addEventListener('touchend',end,{passive:true});const tick=now=>{if(seq!==marqueeSeq||!rail.isConnected)return;const dt=Math.min(40,Math.max(0,now-last));last=now;const w=loopWidth();if(w&&rail.scrollLeft>=w)rail.scrollLeft-=w;if(document.visibilityState==='visible'&&!dragging&&now>pauseUntil)rail.scrollLeft+=dt*.028;requestAnimationFrame(tick)};requestAnimationFrame(tick)}

/* Category wins over brand, and brand wins over category. */
document.addEventListener('click',e=>{const cat=e.target.closest?.('#catalogView .v10-category-rail [data-category]');if(cat&&!filterGuard){queueMicrotask(()=>{const clear=$('#clearBrand');if(clear)clear.click()})}const option=e.target.closest?.('#sheetHost [data-brand-option]');if(option&&String(option.dataset.brandOption||'').trim())setTimeout(()=>clickCategoryAll({preserveBrand:true}),80)},true);
document.addEventListener('pointerup',e=>{if(e.target.closest?.('.hm-v104-catalog-brands [data-brand-chip]'))setTimeout(()=>clickCategoryAll({preserveBrand:true}),90)},true);

document.addEventListener('click',e=>{const product=e.target.closest?.('[data-hm1165-product]');if(product){e.preventDefault();e.stopPropagation();chooseProduct(product.dataset.hm1165Product);return}const brand=e.target.closest?.('[data-hm1165-brand]');if(brand){e.preventDefault();e.stopPropagation();chooseBrand(brand.dataset.hm1165Brand);return}const clone=e.target.closest?.('[data-hm1165-brand-clone]');if(clone){e.preventDefault();e.stopPropagation();const name=clone.dataset.hm1165BrandClone,real=[...$$('.hm-v104-catalog-brands [data-brand-chip]')].find(b=>norm(b.dataset.brandChip||'')===norm(name));real?.click()}},true);
document.addEventListener('input',e=>{if(e.target?.id==='catalogSearch'){queueMicrotask(syncSearchFromInput);setTimeout(syncSearchFromInput,25)}},true);
document.addEventListener('focusin',e=>{if(e.target?.id==='catalogSearch')setTimeout(syncSearchFromInput,0)},true);
document.addEventListener('focusout',e=>{if(e.target?.id==='catalogSearch')setTimeout(()=>{if(!e.target.value.trim()){const p=$('#hm1165Search');if(p)p.hidden=true;root.classList.remove('hm1165-search-active')}},120)},true);
window.visualViewport?.addEventListener('resize',()=>{if(root.classList.contains('hm1165-search-active'))placeSearchPanel()},{passive:true});
window.addEventListener('resize',()=>{if(root.classList.contains('hm1165-search-active'))placeSearchPanel()},{passive:true});
window.addEventListener('pageshow',()=>{scheduleUi();syncSearchFromInput()});
window.addEventListener('storage',e=>{if(e.key===cacheKey())scheduleUi()});

function syncUi(){uiRaf=0;removeLegacyArrows();setupBrandMarquee();const old=$('#searchSuggestions');if(old)old.setAttribute('aria-hidden','true');document.documentElement.dataset.hmCatalogClient='10.16.5'}
function scheduleUi(){if(uiRaf)return;uiRaf=requestAnimationFrame(syncUi)}
new MutationObserver(scheduleUi).observe(document.documentElement,{childList:true,subtree:true});
const start=()=>{ensureSearchPanel();scheduleUi();syncSearchFromInput()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
