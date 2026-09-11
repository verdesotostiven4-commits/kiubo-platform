/* Hakuna Matata Catalog 10.4 — home/header polish only. Catalog brands are owned by 10.4.3. */
(()=>{
'use strict';
if(window.__hakunaCatalog104)return;window.__hakunaCatalog104=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function decorateHeader(){const tag=$('#brandTagline');if(tag&&['catalogo mayorista','catálogo mayorista'].includes(norm(tag.textContent)))tag.textContent='Mayorista · pedidos simples, rápidos y claros'}
function decorateHomeHeadings(){const home=$('#homeView .v10-home');if(!home)return;const blocks=$$('.v10-block',home),categories=blocks.find(b=>$('.v10-categories',b)),featured=blocks.find(b=>$('#featuredStrip',b));if(categories){const small=$('.v10-heading small',categories);if(small)small.textContent='EXPLORA POR CATEGORÍA'}if(featured){const small=$('.v10-heading small',featured);if(small)small.textContent='PRODUCTOS DESTACADOS'}}
function hardenImages(){$$('img').forEach(img=>{if(img.dataset.hm104Img)return;img.dataset.hm104Img='1';img.draggable=false;img.addEventListener('error',()=>img.closest('.hm-brand-visual')?.classList.add('image-failed'),{once:true})})}
function enhance(){decorateHeader();decorateHomeHeadings();hardenImages();document.documentElement.dataset.hmCatalogBase='10.4'}
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',schedule,true);window.addEventListener('popstate',schedule);window.addEventListener('pageshow',schedule);
})();
