(()=>{
'use strict';
if(window.__hakunaPanel751)return;window.__hakunaPanel751=true;
const $=(s,r=document)=>r.querySelector(s);
function restoreItemNoteOption(){
  const input=$('#v5AllowNote');
  if(!input)return;
  const row=input.closest('label');
  if(row){row.hidden=false;row.style.removeProperty('display')}
}
function sync(){restoreItemNoteOption()}
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-edit-product],#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]'))setTimeout(sync,45);
},true);
const start=()=>{sync();const modal=$('#productModal');if(modal)new MutationObserver(sync).observe(modal,{childList:true,subtree:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
