/* Hakuna Matata Catalog 10.4 — DOM polish only. Business logic remains in Catalog 10.2. */
(()=>{
'use strict';
if(window.__hakunaCatalog104)return;window.__hakunaCatalog104=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const assets=window.KIUBO_BRAND_ASSETS||{};
const themes={
 'coca-cola':['#e5202b','#fff'],'toni':['#3157a2','#fff'],'bubbaloo':['#ff4d9c','#173f86'],'chiclets':['#ffd728','#111'],'cheese-tris':['#ff7a18','#114e9c'],'club-social':['#0d4c8e','#fff'],'chiki':['#ef2937','#ffe21c']
};
function brandVisual(name){const k=key(name),url=assets[k],t=themes[k]||['#f4f6f2','#294a37'];return url?`<span class="hm-brand-visual has-image"><img src="${esc(url)}" alt="${esc(name)}"></span>`:`<span class="hm-brand-visual" style="--hm-brand-bg:${t[0]};--hm-brand-fg:${t[1]}"><b>${esc(name)}</b></span>`}
function decorateHeader(){
 const tag=$('#brandTagline');if(tag&&['catalogo mayorista','catálogo mayorista'].includes(norm(tag.textContent)))tag.textContent='Mayorista · pedidos simples, rápidos y claros';
}
function decorateHomeHeadings(){
 const home=$('#homeView .v10-home');if(!home)return;
 const blocks=$$('.v10-block',home);
 const categories=blocks.find(b=>$('.v10-categories',b));
 if(categories){const small=$('.v10-heading small',categories);if(small)small.textContent='EXPLORA POR CATEGORÍA'}
 const featured=blocks.find(b=>$('#featuredStrip',b));
 if(featured){const small=$('.v10-heading small',featured);if(small)small.textContent='PRODUCTOS DESTACADOS'}
}
function homeBrandNames(){
 const names=[];const seen=new Set();
 $$('#homeView .hm-brand-block [data-brand-chip]').forEach(btn=>{const name=(btn.dataset.brandChip||'').trim();const n=norm(name);if(!n||seen.has(n))return;seen.add(n);names.push(name)});
 return names.slice(0,5);
}
function selectedBrand(){const txt=$('#activeFilterHost .v10-active-filter b')?.textContent||'';return norm(txt)}
function ensureCatalogBrands(){
 const shell=$('#catalogView .v10-catalog-head .v10-shell');if(!shell)return;
 const categories=$('.v10-category-rail',shell);if(!categories)return;
 let rail=$('.hm-v104-catalog-brands',shell);
 const names=homeBrandNames();if(!names.length)return;
 const signature=names.map(norm).join('|');
 if(!rail){rail=document.createElement('div');rail.className='hm-v104-catalog-brands';rail.setAttribute('aria-label','Marcas destacadas');categories.insertAdjacentElement('afterend',rail)}
 if(rail.dataset.signature!==signature){
   rail.dataset.signature=signature;
   rail.innerHTML=names.map(name=>`<button type="button" data-brand-chip="${esc(name)}" aria-label="Ver ${esc(name)}">${brandVisual(name)}</button>`).join('')+`<button type="button" class="hm-v104-more" data-hm-open-brands="1"><span>•••</span>Ver todas</button>`;
 }
 const active=selectedBrand();$$('[data-brand-chip]',rail).forEach(btn=>btn.classList.toggle('active',!!active&&norm(btn.dataset.brandChip)===active));
}
function hardenImages(){
 $$('img').forEach(img=>{if(img.dataset.hm104Img)return;img.dataset.hm104Img='1';img.draggable=false;img.addEventListener('error',()=>img.closest('.hm-brand-visual')?.classList.add('image-failed'),{once:true})});
}
function enhance(){decorateHeader();decorateHomeHeadings();ensureCatalogBrands();hardenImages();document.documentElement.dataset.hmCatalog='10.4'}
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',schedule,true);window.addEventListener('popstate',schedule);window.addEventListener('pageshow',schedule);
})();
