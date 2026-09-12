/* Hakuna Panel 10.10 — stabilize product editor without touching business data. */
(()=>{
'use strict';
if(window.__hakunaPanel1010)return;window.__hakunaPanel1010=true;
if(!/^\/panel(?:\/|$)/.test(location.pathname))return;
const $=(s,r=document)=>r.querySelector(s);
let raf=0;
function normalizeProductEditor(reset=false){
  const modal=$('#productModal'),body=document.body,html=document.documentElement;if(!modal||!body)return;
  const open=!modal.hidden&&modal.classList.contains('visible');
  if(open){
    html.classList.remove('hm106-modal-lock');body.classList.remove('hm106-modal-lock','v76-order-locked');
    body.style.removeProperty('top');modal.classList.add('hm1010-product-open');
    const form=$('.modal-form',modal);if(form){form.style.removeProperty('overflow');form.style.removeProperty('overflow-y');form.style.removeProperty('height');form.style.removeProperty('max-height');form.style.removeProperty('touch-action')}
    if(reset)requestAnimationFrame(()=>{try{modal.scrollTo({top:0,left:0,behavior:'auto'})}catch{modal.scrollTop=0}});
  }else modal.classList.remove('hm1010-product-open');
}
function schedule(reset=false){if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{raf=0;normalizeProductEditor(reset)})}
function bind(){
  const modal=$('#productModal');if(!modal||modal.dataset.hm1010Observed==='1')return;
  modal.dataset.hm1010Observed='1';
  new MutationObserver(()=>schedule(false)).observe(modal,{attributes:true,attributeFilter:['hidden','class']});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-edit-product],#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]'))setTimeout(()=>schedule(true),30);
    if(e.target.closest?.('#productModal [data-close-modal],#productModal .v72-modal-x'))setTimeout(()=>schedule(false),30);
  },true);
  window.addEventListener('pageshow',()=>schedule(false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(false)});
  schedule(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
