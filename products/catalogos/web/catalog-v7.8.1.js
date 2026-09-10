(()=>{
'use strict';
if(window.__hakunaCatalog781)return;window.__hakunaCatalog781=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
function cleanCards(root=document){
  $$('.v7-product[data-product]',root).forEach(card=>{
    const p=$('.v7-product-title p',card);if(p&&/\s·\s*m[aá]s opciones\s*$/i.test(p.textContent||''))p.textContent=(p.textContent||'').replace(/\s·\s*m[aá]s opciones\s*$/i,'').trim();
    $$('.v77-options-pill',card).forEach(x=>x.setAttribute('aria-hidden','true'));
  });
}
function removeNoise(node){if(node?.nodeType!==1)return;const list=[node,...(node.querySelectorAll?.('.v77-toast,.v7-toast')||[])];for(const el of list){if(el.matches?.('.v77-toast,.v7-toast')&&/(selecci[oó]n agregada|selecciones agregadas|pedidos actualizados|agregado al carrito)/i.test(el.textContent||''))el.remove()}}
const obs=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)removeNoise(n);requestAnimationFrame(()=>cleanCards())});
function start(){cleanCards();obs.observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();