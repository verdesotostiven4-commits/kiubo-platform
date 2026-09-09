(()=>{
'use strict';
if(window.__hakunaPanel751)return;window.__hakunaPanel751=true;
const $=(s,r=document)=>r.querySelector(s);
function removeVarietyOption(){
  const input=$('#v5AllowNote');
  if(!input)return;
  input.checked=false;
  const row=input.closest('label');
  if(row){row.hidden=true;row.style.display='none'}
}
function sync(){removeVarietyOption()}
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-edit-product],#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]'))setTimeout(sync,45);
},true);
const start=()=>{sync();const modal=$('#productModal');if(modal)new MutationObserver(sync).observe(modal,{childList:true,subtree:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();