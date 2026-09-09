(()=>{
'use strict';
if(window.__hakunaPanel76)return;window.__hakunaPanel76=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let orderLocked=false,lockedY=0;

function removeTransientBadges(){
  $$('.v5-stock-badge,.v5-presentation-badge').forEach(x=>x.remove());
}

function moveCategoriesToProducts(){
  const productView=$('[data-view="products"]');
  const categoryPanel=$('[data-settings-panel="categories"]');
  if(!productView||!categoryPanel)return;
  $('[data-settings="categories"]')?.remove();

  let tools=$('#v76CategoryTools');
  if(!tools){
    tools=document.createElement('div');tools.id='v76CategoryTools';tools.className='v76-category-tools';
    tools.innerHTML='<button type="button" id="v76ManageCategories" aria-expanded="false">Administrar categorías</button>';
    const rail=$('#v75CategoryFilters')||$('.filter-row',productView);
    if(rail)rail.insertAdjacentElement('afterend',tools);else productView.insertBefore(tools,$('#adminProductList',productView));
  }

  let host=$('#v76CategoryManager');
  if(!host){
    host=document.createElement('div');host.id='v76CategoryManager';host.hidden=true;
    tools.insertAdjacentElement('afterend',host);
  }
  if(categoryPanel.parentElement!==host)host.append(categoryPanel);
  categoryPanel.classList.add('active','v76-category-panel');
  categoryPanel.hidden=false;

  const btn=$('#v76ManageCategories');
  if(btn&&!btn.dataset.bound){
    btn.dataset.bound='1';
    btn.addEventListener('click',()=>{
      const next=host.hidden;
      host.hidden=!next;
      btn.classList.toggle('active',next);
      btn.setAttribute('aria-expanded',String(next));
      btn.textContent=next?'Cerrar categorías':'Administrar categorías';
      if(next)setTimeout(()=>host.scrollIntoView({block:'nearest',behavior:'smooth'}),20);
    });
  }
}

function lockOrderBackground(){
  if(orderLocked)return;
  orderLocked=true;lockedY=window.scrollY||window.pageYOffset||0;
  document.body.classList.add('v76-order-locked');
  document.body.style.top=`-${lockedY}px`;
}
function unlockOrderBackground(){
  if(!orderLocked)return;
  orderLocked=false;
  document.body.classList.remove('v76-order-locked');
  document.body.style.removeProperty('top');
  requestAnimationFrame(()=>window.scrollTo(0,lockedY));
}
function syncOrderState(){
  const modal=$('#orderModal');
  const open=Boolean(modal&&!modal.hidden&&modal.classList.contains('visible'));
  if(open)lockOrderBackground();else unlockOrderBackground();
}
function watchOrderModal(){
  const modal=$('#orderModal');if(!modal||modal.dataset.v76Observed)return;
  modal.dataset.v76Observed='1';
  new MutationObserver(syncOrderState).observe(modal,{attributes:true,attributeFilter:['hidden','class']});
  syncOrderState();
}

function stabilizeProductView(){
  const status=$('.filter-row');if(status)status.scrollLeft=0;
  const cats=$('#v75CategoryFilters');if(cats)cats.scrollLeft=0;
  const stats=$('.stats-grid');if(stats)stats.scrollLeft=0;
  removeTransientBadges();
  moveCategoriesToProducts();
}

function fixOrdersView(){
  const board=$('#adminOrderList');if(board)board.scrollLeft=0;
  const segmented=$('.order-toolbar .segmented');if(segmented)segmented.scrollLeft=0;
}

function sync(){
  stabilizeProductView();fixOrdersView();watchOrderModal();syncOrderState();
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-nav="products"]'))setTimeout(stabilizeProductView,30);
  if(e.target.closest?.('[data-nav="orders"]'))setTimeout(fixOrdersView,30);
  if(e.target.closest?.('[data-open-order]'))setTimeout(syncOrderState,40);
  if(e.target.closest?.('#orderModal [data-close-modal],#orderModal .v75-order-x'))setTimeout(syncOrderState,40);
},true);

const start=()=>{
  sync();
  const list=$('#adminProductList');if(list)new MutationObserver(()=>{removeTransientBadges();setTimeout(stabilizeProductView,0)}).observe(list,{childList:true,subtree:true});
  const app=$('#adminApp');if(app)new MutationObserver(()=>setTimeout(sync,0)).observe(app,{childList:true,subtree:true});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();