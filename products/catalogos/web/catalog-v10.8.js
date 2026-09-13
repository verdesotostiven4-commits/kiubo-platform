/* Hakuna Matata 10.8.1 — rail memory + keyboard-safe sheets. Native catalog owns brand clicks. */
(()=>{
'use strict';
if(window.__hakunaCatalog1081)return;window.__hakunaCatalog1081=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const $=(s,r=document)=>r.querySelector(s);
const C=window.KIUBO_CATALOG_CONFIG||{},slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const key=`hm108-brand-left:${slug}`;let left=Number(sessionStorage.getItem(key)||0)||0;
function rail(){return $('.hm-v104-catalog-brands')}
function remember(){const r=rail();if(!r)return;left=r.scrollLeft;try{sessionStorage.setItem(key,String(left))}catch{}}
function restore(){const r=rail();if(!r)return;r.scrollLeft=Math.max(0,Math.min(left,Math.max(0,r.scrollWidth-r.clientWidth)))}
function settle(){restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});setTimeout(restore,80)}
window.addEventListener('pointerdown',e=>{if(e.target.closest?.('.hm-v104-catalog-brands [data-brand-chip]'))remember()},true);
function fitKeyboardSheet(){
 const input=$('#brandSearch'),sheet=input?.closest('.v10-sheet'),vv=window.visualViewport;if(!input||!sheet||!vv)return;
 const open=document.activeElement===input&&(window.innerHeight-vv.height>100||vv.height<window.innerHeight*.86);
 sheet.classList.toggle('hm108-keyboard',open);
 if(open){sheet.style.setProperty('--hm108-vv-top',`${Math.max(6,Math.round(vv.offsetTop+6))}px`);sheet.style.setProperty('--hm108-vv-height',`${Math.max(260,Math.round(vv.height-12))}px`)}
 else{sheet.style.removeProperty('--hm108-vv-top');sheet.style.removeProperty('--hm108-vv-height')}
}
document.addEventListener('focusin',e=>{if(e.target?.id==='brandSearch')setTimeout(fitKeyboardSheet,40)},true);
document.addEventListener('input',e=>{if(e.target?.id==='brandSearch')fitKeyboardSheet()},true);
window.visualViewport?.addEventListener('resize',fitKeyboardSheet,{passive:true});
window.visualViewport?.addEventListener('scroll',fitKeyboardSheet,{passive:true});
window.addEventListener('pageshow',()=>{document.documentElement.classList.remove('hm108-brand-routing');settle()});
document.documentElement.classList.remove('hm108-brand-routing');
document.documentElement.dataset.hmCatalog='10.8.1';
})();
