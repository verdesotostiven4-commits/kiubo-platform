(()=>{
  'use strict';
  const config=window.KIUBO_CATALOG_CONFIG;if(!config?.apiUrl)return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const slug=(()=>{const q=new URLSearchParams(location.search).get('slug');return(q||config.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'')})();
  let activeProductId='';
  let activeProductName='';
  let decorating=false;
  let decorateQueued=false;
  const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(msg,type=''){const el=document.createElement('div');el.className=`v7-panel-toast ${type}`;el.textContent=msg;document.body.append(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),180)},2400)}
  async function call(action,payload={}){const res=await fetch(config.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':config.version,'X-Provider-Session':token()},body:JSON.stringify({action,slug,...payload})});const body=await res.json().catch(()=>({error:'invalid_response'}));if(!res.ok){const e=new Error(body.message||body.error||'request_failed');e.code=body.error;throw e}return body}
  function closeProductModal(){const modal=$('#productModal');if(!modal)return;const close=$('[data-close-modal]',modal)||$('.modal-close',modal)||$('.admin-modal__close',modal);if(close)close.click();else{modal.classList.remove('visible');modal.hidden=true}}
  function confirmDelete(id,name){
    document.querySelector('.v7-admin-confirm')?.remove();
    const overlay=document.createElement('div');overlay.className='v7-admin-confirm';overlay.innerHTML=`<div class="v7-admin-confirm__backdrop"></div><section><span>ELIMINAR PRODUCTO</span><h3>¿Eliminar “${esc(name||'este producto')}”?</h3><p>Desaparecerá del catálogo, favoritos, búsquedas y panel activo. Los pedidos anteriores conservarán su historial.</p><div><button type="button" data-cancel>Cancelar</button><button type="button" data-confirm>Eliminar producto</button></div></section>`;document.body.append(overlay);requestAnimationFrame(()=>overlay.classList.add('show'));const close=()=>{overlay.classList.remove('show');setTimeout(()=>overlay.remove(),150)};overlay.querySelector('[data-cancel]').onclick=close;overlay.querySelector('.v7-admin-confirm__backdrop').onclick=close;overlay.querySelector('[data-confirm]').onclick=async e=>{const btn=e.currentTarget;btn.disabled=true;btn.textContent='Eliminando…';try{await call('delete_product',{product_id:id});close();closeProductModal();$$(`[data-edit-product="${CSS.escape(String(id))}"]`).forEach(b=>b.closest('.admin-product')?.remove());toast('Producto eliminado');setTimeout(()=>$('#refreshBtn')?.click(),220)}catch(err){btn.disabled=false;btn.textContent='Eliminar producto';toast(err.code==='product_not_found'?'El producto ya no existe':'No pudimos eliminar el producto','error')}};
  }
  function injectDangerZone(){
    const modal=$('#productModal');const form=$('#productForm');if(!modal||modal.hidden||!form)return;
    let zone=$('#v7DeleteProductZone',form);
    if(!zone){zone=document.createElement('section');zone.id='v7DeleteProductZone';zone.className='v7-delete-zone';zone.innerHTML=`<div><b>Eliminar del catálogo</b><small>Úsalo para productos de prueba, duplicados o que ya no vas a manejar.</small></div><button type="button" id="v7DeleteProductBtn">Eliminar producto</button>`;form.append(zone);$('#v7DeleteProductBtn',zone).onclick=()=>{if(activeProductId)confirmDelete(activeProductId,activeProductName)}}
    zone.hidden=!activeProductId;
  }
  function decorateProductRows(){
    if(decorating)return;decorating=true;
    requestAnimationFrame(()=>{decorating=false;$$('#adminProductList .admin-product').forEach(row=>{if(row.dataset.v7Done)return;const edit=$('[data-edit-product]',row);if(!edit)return;row.dataset.v7Done='1';const id=edit.dataset.editProduct||'';const name=$('.admin-product__copy h3',row)?.textContent?.trim()||'Producto';const actions=edit.parentElement;if(!actions)return;const del=document.createElement('button');del.type='button';del.className='v7-inline-delete';del.dataset.deleteProduct=id;del.setAttribute('aria-label',`Eliminar ${name}`);del.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M8 10v8M12 10v8M16 10v8M6 7l1 14h10l1-14"/></svg>';actions.append(del)})})
  }
  function polishFeaturedSwitch(){
    const input=$('#productFeatured');const row=input?.closest('.switch-row');if(!row)return;
    row.classList.add('v71-featured-switch');const title=$('b',row),copy=$('small',row);
    if(title)title.textContent='Mostrar en Productos destacados';
    if(copy)copy.textContent='Aparece en el carrusel infinito de la pantalla Inicio. Puedes activar o quitar cualquier producto cuando quieras.';
  }
  function nativeSurface(){
    const meta=document.querySelector('meta[name="viewport"]');if(meta)meta.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    document.documentElement.classList.add('v71-native-surface');
    document.addEventListener('contextmenu',e=>{if(!e.target.closest?.('input,textarea,select'))e.preventDefault()});
    document.addEventListener('dragstart',e=>{if(e.target.closest?.('img,.admin-product,.side-nav,.panel-card'))e.preventDefault()});
  }
  function polishStatic(){
    document.documentElement.classList.add('kiubo-panel-v7');
    const search=$('#productSearch');if(search&&search.placeholder!=='Buscar producto, marca o código')search.placeholder='Buscar producto, marca o código';
    const title=$('#viewTitle');if(title&&$('[data-nav="products"]')?.classList.contains('active')&&title.textContent!=='Productos')title.textContent='Productos';
    polishFeaturedSwitch();
  }
  function queueDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;polishStatic();decorateProductRows()})}
  function observeProducts(){const list=$('#adminProductList');if(!list||list.dataset.v7Observed)return;list.dataset.v7Observed='1';new MutationObserver(queueDecorate).observe(list,{childList:true})}
  document.addEventListener('click',e=>{
    const nav=e.target.closest?.('[data-nav="products"]');if(nav)setTimeout(()=>{polishStatic();observeProducts();decorateProductRows()},0);
    const edit=e.target.closest?.('[data-edit-product]');if(edit){activeProductId=edit.dataset.editProduct||'';activeProductName=edit.closest('.admin-product')?.querySelector('.admin-product__copy h3')?.textContent?.trim()||'';setTimeout(()=>{injectDangerZone();polishFeaturedSwitch()},30)}
    const fresh=e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]');if(fresh){activeProductId='';activeProductName='';setTimeout(()=>{injectDangerZone();polishFeaturedSwitch()},30)}
    const del=e.target.closest?.('[data-delete-product]');if(del){e.preventDefault();e.stopPropagation();const row=del.closest('.admin-product');confirmDelete(del.dataset.deleteProduct,row?.querySelector('.admin-product__copy h3')?.textContent?.trim()||'Producto')}
  },true);
  const start=()=>{nativeSurface();polishStatic();observeProducts();decorateProductRows()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();