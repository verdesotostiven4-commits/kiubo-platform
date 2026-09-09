(()=>{
  'use strict';
  if(window.__hakunaCatalog75)return;window.__hakunaCatalog75=true;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  let localQuery='';
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  function filterCatalog(){
    const input=$('#catalogSearch');if(!input)return;
    const q=normalize(localQuery||input.value);const grid=$('.v7-product-grid');if(!grid)return;
    let shown=0;
    $$('.v7-product',grid).forEach(card=>{const match=!q||normalize(card.textContent).includes(q);card.hidden=!match;if(match)shown++});
    const count=$('.v7-catalog-title>span');if(count)count.textContent=String(shown);
    const clear=$('#clearSearch');if(clear)clear.hidden=!q;
    let empty=$('.v75-search-empty',grid.parentElement);
    if(q&&!shown){if(!empty){empty=document.createElement('div');empty.className='v75-search-empty';grid.insertAdjacentElement('afterend',empty)}empty.innerHTML='<div><b>No encontramos coincidencias</b><span>Prueba otro nombre, marca o categoría.</span></div>';}
    else empty?.remove();
  }

  function categoryIcon(name=''){
    const n=normalize(name);
    if(n.includes('bebid'))return '<svg viewBox="0 0 24 24"><path d="M8 3h8l-1 4v13H9V7L8 3Z"/><path d="M9 9h6"/></svg>';
    if(n.includes('snack'))return '<svg viewBox="0 0 24 24"><path d="M7 3h10l2 4-2 14H7L5 7l2-4Z"/><path d="M7 7h10M9 11c2 2 4 2 6 0"/></svg>';
    if(n.includes('gallet'))return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="11" r="1"/><circle cx="11" cy="15" r="1"/></svg>';
    if(n.includes('golos')||n.includes('dulce'))return '<svg viewBox="0 0 24 24"><path d="m8 8 8 8M7 7l-4 1 3 3-3 3 4 1M17 9l4-1-3 3 3 3-4 1"/><rect x="8" y="8" width="8" height="8" rx="2" transform="rotate(45 12 12)"/></svg>';
    if(n.includes('lact'))return '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 4 2 3v11H6V10l2-3 1-4Z"/><path d="M8 7h8M9 12h6"/></svg>';
    return '<svg viewBox="0 0 24 24"><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>';
  }
  function decorateHomeCategories(){
    $$('.v7-categories button').forEach(btn=>{const span=$('span',btn);const label=$('b',btn)?.textContent||'';if(!span||span.dataset.v75)return;span.dataset.v75='1';span.classList.add('v75-cat-icon');span.innerHTML=categoryIcon(label)});
  }
  function decorateSheet(){
    const sheet=$('.v7-sheet');if(!sheet)return;
    const media=$('.v7-detail-media',sheet);if(media)media.classList.add('v75-full-media');
    const note=$('#noteToggle',sheet);if(note&&!note.dataset.v75){note.dataset.v75='1';note.textContent='Elegir sabores, colores o surtido (opcional)'}
    const textarea=$('#itemNote',sheet);if(textarea)textarea.placeholder='Ej.: 3 Coca-Cola, 3 Sprite y 3 Fiora · o color/modelo que prefieres';
    const list=$('.v7-presentation-list',sheet);if(list&&$$('[data-presentation]',list).length>1&&!$('.v75-presentation-help',sheet)){
      const p=document.createElement('p');p.className='v75-presentation-help';p.textContent='Puedes combinar presentaciones en el mismo pedido. Ej.: 2 jabas y después 5 unidades del mismo producto.';list.insertAdjacentElement('afterend',p);
    }
  }
  function removeCartToast(node){
    if(node?.nodeType!==1)return;const el=node.matches?.('.v7-toast')?node:node.querySelector?.('.v7-toast');if(el&&/agregado al carrito/i.test(el.textContent||''))el.remove();
  }
  function syncAfterRender(){
    decorateHomeCategories();decorateSheet();
    const input=$('#catalogSearch');if(input){if(localQuery&&input.value!==localQuery)input.value=localQuery;filterCatalog()}
  }

  document.addEventListener('input',e=>{
    if(e.target?.id!=='catalogSearch')return;
    e.stopImmediatePropagation();
    localQuery=e.target.value;
    filterCatalog();
  },true);
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#clearSearch')){e.preventDefault();e.stopImmediatePropagation();localQuery='';const i=$('#catalogSearch');if(i){i.value='';i.focus()}filterCatalog();return}
    if(e.target.closest?.('[data-category]')){localQuery='';setTimeout(syncAfterRender,0)}
    const view=e.target.closest?.('[data-view]')?.dataset.view;if(view&&view!=='catalog')localQuery='';
  },true);

  const obs=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)removeCartToast(n);requestAnimationFrame(syncAfterRender)});
  const start=()=>{obs.observe(document.body,{childList:true,subtree:true});syncAfterRender()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
