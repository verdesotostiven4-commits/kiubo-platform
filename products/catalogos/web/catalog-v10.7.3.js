/* Hakuna Matata 10.7.3 — keyboard-safe brand picker, no visible rail reset, and richer brand visuals. */
(()=>{
'use strict';
if(window.__hakunaCatalog1073)return;window.__hakunaCatalog1073=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const railKey=`hm1073-brand-left:${slug}`;
let railLeft=Number(sessionStorage.getItem(railKey)||0)||0;
const brandThumbs=new Map();

/* Verified addition. Other brands keep their existing verified asset, otherwise we use a real catalog product photo instead of a dead grey tile. */
try{const current=window.KIUBO_BRAND_ASSETS||{};window.KIUBO_BRAND_ASSETS=Object.freeze({...current,'halls':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Halls_Logo.svg'})}catch{}

function cached(){try{return JSON.parse(localStorage.getItem(`kiubo-v10-bootstrap:${slug}`)||'{}')||{}}catch{return{}}}
function indexBrandThumbs(payload={}){const products=Array.isArray(payload.products)?payload.products:[],presentations=Array.isArray(payload.presentations)?payload.presentations:[],byProduct=new Map();for(const pr of presentations){if(pr?.visible===false||!pr?.image_url)continue;const id=String(pr.product_id||'');if(id&&!byProduct.has(id))byProduct.set(id,pr.image_url)}for(const p of products){if(p?.visible===false||p?.archived_at)continue;const b=String(p?.brand||'').trim();if(!b)continue;const url=p.image_url||byProduct.get(String(p.id||''));if(url&&!brandThumbs.has(key(b)))brandThumbs.set(key(b),url)}}
function patchBrandAssets(){indexBrandThumbs(cached());const assets=window.KIUBO_BRAND_ASSETS||{};$$('[data-brand-chip],[data-brand-option]').forEach(btn=>{const name=String(btn.dataset.brandChip??btn.dataset.brandOption??'').trim();if(!name)return;const k=key(name);if(assets[k]||assets[k==='kinder'?'kinder-joy':k])return;const url=brandThumbs.get(k);const visual=$('.hm-brand-visual',btn);if(!visual||!url)return;visual.classList.remove('hm1072-fallback');visual.classList.add('has-image','hm1073-product-brand');visual.innerHTML=`<img src="${esc(url)}" alt="${esc(name)}" loading="lazy" decoding="async">`})}

function rail(){return $('.hm-v104-catalog-brands')}
function rememberRail(){const r=rail();if(!r)return;railLeft=r.scrollLeft;try{sessionStorage.setItem(railKey,String(railLeft))}catch{}}
function restoreRail(){const r=rail();if(!r)return;const max=Math.max(0,r.scrollWidth-r.clientWidth);r.scrollLeft=Math.max(0,Math.min(railLeft,max))}
function settleRail(){restoreRail();queueMicrotask(restoreRail);requestAnimationFrame(()=>{restoreRail();requestAnimationFrame(restoreRail)});setTimeout(restoreRail,24);setTimeout(restoreRail,90)}

function brandSheet(){return $('#brandSearch')?.closest('.v10-sheet')||null}
function fitBrandSheet(){const input=$('#brandSearch'),sheet=brandSheet(),vv=window.visualViewport;if(!input||!sheet||!vv)return;const focused=document.activeElement===input;const keyboard=focused&&(window.innerHeight-vv.height>110||vv.height<window.innerHeight*.84);sheet.classList.toggle('hm1073-keyboard',keyboard);if(!keyboard){sheet.style.removeProperty('--hm1073-top');sheet.style.removeProperty('--hm1073-height');return}const top=Math.max(6,Math.round(vv.offsetTop+6)),height=Math.max(260,Math.round(vv.height-12));sheet.style.setProperty('--hm1073-top',`${top}px`);sheet.style.setProperty('--hm1073-height',`${height}px`);const scroller=$('.v10-sheet-scroll',sheet);if(scroller)scroller.scrollTop=0}
function bindBrandSearch(){const input=$('#brandSearch');if(!input||input.dataset.hm1073==='1')return;input.dataset.hm1073='1';input.setAttribute('enterkeyhint','search');const refresh=()=>{fitBrandSheet();patchBrandAssets();const sheet=brandSheet();if(!sheet)return;const q=norm(input.value);const options=$$('.hm-brand-option,[data-brand-option]',sheet).filter(b=>b.dataset.brandOption!==undefined);let visible=0;for(const b of options){if(!b.dataset.brandOption){b.hidden=!!q;continue}const show=!q||norm(b.textContent).includes(q);b.hidden=!show;if(show)visible++}let empty=$('.hm1073-brand-empty',sheet);if(!empty){empty=document.createElement('div');empty.className='hm1073-brand-empty';empty.innerHTML='<b>No encontramos esa marca</b><span>Prueba con otra palabra.</span>';$('.v10-brand-options',sheet)?.append(empty)}empty.hidden=visible>0||!q};input.addEventListener('focus',()=>setTimeout(()=>{fitBrandSheet();refresh()},40));input.addEventListener('input',refresh,true);input.addEventListener('search',refresh,true);refresh()}

function enhance(){bindBrandSearch();fitBrandSheet();patchBrandAssets();settleRail();document.documentElement.dataset.hmCatalog='10.7.3'}

/* Save before the legacy catalog handler rebuilds, then restore in the same microtask checkpoint so the user never sees a jump to the first brands. */
window.addEventListener('pointerdown',e=>{if(e.target.closest?.('.hm-v104-catalog-brands [data-brand-chip]'))rememberRail()},true);
window.addEventListener('click',e=>{if(e.target.closest?.('.hm-v104-catalog-brands [data-brand-chip]')){rememberRail();queueMicrotask(settleRail)}},true);
const observer=new MutationObserver(()=>{restoreRail();bindBrandSearch();fitBrandSheet();patchBrandAssets()});
observer.observe(document.documentElement,{childList:true,subtree:true});
window.visualViewport?.addEventListener('resize',fitBrandSheet,{passive:true});window.visualViewport?.addEventListener('scroll',fitBrandSheet,{passive:true});
window.addEventListener('kiubo:brands-ready',()=>{patchBrandAssets();settleRail()});window.addEventListener('pageshow',enhance);
async function refreshThumbs(){indexBrandThumbs(cached());if(!C.apiUrl)return;try{const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':'10.7.3'},body:JSON.stringify({action:'catalog_bootstrap',slug})});if(r.ok){indexBrandThumbs(await r.json());patchBrandAssets()}}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{enhance();refreshThumbs()},{once:true});else{enhance();refreshThumbs()}
})();
