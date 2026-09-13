/* Hakuna Matata 10.10.4 — sheet/search collision guard. */
(()=>{
'use strict';
if(window.__hakunaCatalog10104)return;window.__hakunaCatalog10104=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;
const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
root.classList.remove('hm108-brand-routing');
function installStyle(){
  if($('#hm10104InteractionFix'))return;
  const style=document.createElement('style');
  style.id='hm10104InteractionFix';
  style.textContent=`
    #sheetHost .v10-backdrop{z-index:5000!important}
    #sheetHost .v10-sheet{z-index:5001!important}
    html.hm10104-sheet-open #searchSuggestions{visibility:hidden!important;pointer-events:none!important}
    html.hm10104-sheet-open #catalogView.hm105-search-mode .v10-catalog-body{visibility:visible!important}
  `;
  document.head.append(style);
}
function hideSearchSurface(){
  const view=$('#catalogView'),box=$('#searchSuggestions');
  view?.classList.remove('hm105-search-mode','hm1072-searching');
  if(box){
    box.hidden=true;
    box.classList.remove('hm105-results');
    box.style.removeProperty('--hm-search-top');
    box.style.removeProperty('--hm-search-max');
  }
}
function syncSheetState(){
  installStyle();
  root.classList.remove('hm108-brand-routing');
  const open=!!$('#sheetHost .v10-sheet');
  root.classList.toggle('hm10104-sheet-open',open);
  if(open)hideSearchSurface();
}
let hostObserver=null;
function bindHost(){
  const host=$('#sheetHost');
  if(!host||host.dataset.hm10104Bound==='1')return false;
  host.dataset.hm10104Bound='1';
  hostObserver?.disconnect();
  hostObserver=new MutationObserver(syncSheetState);
  hostObserver.observe(host,{childList:true,subtree:true});
  syncSheetState();
  return true;
}
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bindHost();syncSheetState()},{once:true});
else{bindHost();syncSheetState()}
const shellObserver=new MutationObserver(()=>{if(bindHost())syncSheetState()});
shellObserver.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('pageshow',()=>{root.classList.remove('hm108-brand-routing');syncSheetState()});
document.addEventListener('click',()=>queueMicrotask(syncSheetState),true);
document.documentElement.dataset.hmInteractionFix='10.10.4';
})();
