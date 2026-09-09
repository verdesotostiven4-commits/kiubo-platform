(()=>{
  'use strict';
  if(window.__hakunaPanel75)return;window.__hakunaPanel75=true;
  const config=window.KIUBO_CATALOG_CONFIG;if(!config?.apiUrl)return;
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const slug=(new URLSearchParams(location.search).get('slug')||config.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
  const logo=config.brandLogoUrl||'';
  const baseFetch=window.fetch.bind(window);
  const CORE=`${config.supabaseUrl}/functions/v1/catalog-api`;
  const V6=`${config.supabaseUrl}/functions/v1/catalog-v6`;
  const ROUTER=`${config.supabaseUrl}/functions/v1/catalog-router`;
  const productCache=new Map();
  let categories=[],activeProductId='',activeCategory='all',queue=[],running=0,refreshTimer=0,applyingFilters=false,polishQueued=false;
  const providerToken=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
  const headers=()=>({'Content-Type':'application/json','X-Client-Version':config.version,'X-Provider-Session':providerToken()});
  const parse=init=>{try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function cacheBootstrap(payload){
    if(!payload||!Array.isArray(payload.products))return;
    productCache.clear();payload.products.forEach(p=>productCache.set(String(p.id),p));
    categories=Array.isArray(payload.categories)?payload.categories:categories;
    requestAnimationFrame(()=>{renderCategoryFilters();updateFilterCounts();applyCombinedFilters()});
  }
  window.fetch=async(input,init={})=>{
    const res=await baseFetch(input,init);
    const body=(typeof input==='string'&&input===config.apiUrl)?parse(init):null;
    if(res.ok&&body&&['provider_bootstrap','master_bootstrap'].includes(body.action))res.clone().json().then(cacheBootstrap).catch(()=>{});
    return res;
  };

  function applyStaticLogo(){
    if(!logo)return;
    ['#gateLogo img','.loading-logo img','#sideLogo img','#mobileLogo img','#logoPreview img'].forEach(sel=>{const img=$(sel);if(img&&img.src!==logo)img.src=logo});
    const icon=document.querySelector('link[rel="icon"]');if(icon)icon.href=logo;
    let apple=document.querySelector('link[rel="apple-touch-icon"]');if(!apple){apple=document.createElement('link');apple.rel='apple-touch-icon';document.head.append(apple)}apple.href=logo;
  }
  function removeInstall(){const b=$('#v5InstallBtn');if(b)b.remove();const tools=$('.v5-tools');if(tools&&!tools.children.length)tools.remove()}

  function setLabel(label,text){if(!label)return;const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(node)node.nodeValue=text;else label.prepend(document.createTextNode(text))}
  function polishEditor(){
    const editor=$('#v5ProductEditor');if(!editor)return;
    $('#saveNextProductBtn')?.remove();const archive=$('#archiveProductBtn');if(archive)archive.hidden=true;
    const head=$('.v5-editor-head',editor);if(head){const b=$('b',head),small=$('small',head);if(b)b.textContent='Venta por presentaciones';if(small)small.textContent='Configura una sola vez cómo se vende: unidad, pack, caja, jaba o cualquier otra forma.'}
    const note=$('#v5AllowNote')?.closest('label');if(note){const b=$('b',note),small=$('small',note);if(b)b.textContent='Permitir surtido o variedades';if(small)small.textContent='Actívalo si el cliente puede pedir sabores, colores, modelos o una mezcla. Ej.: 3 Coca-Cola + 3 Sprite + 3 Fiora.'}
    const ph=$('.v5-presentations-head h4',editor);if(ph)ph.textContent='Formas de venta';const add=$('#v5AddPresentation');if(add)add.textContent='+ Añadir forma de venta';
    const pres=$('.v5-presentations',editor);if(pres&&!$('.v75-presentation-intro',pres)){const intro=document.createElement('div');intro.className='v75-presentation-intro';intro.innerHTML='<b>Ejemplo rápido</b>Si la unidad base es “botella”, crea <strong>Unidad = 1 botella</strong> y <strong>Jaba x 9 = 9 botellas</strong>. El cliente puede pedir 2 jabas y además 5 unidades; todo descuenta del mismo stock base.';pres.insertBefore(intro,$('#v5PresentationRows',pres)||pres.firstChild)}
    $$('.v5-presentation-row',editor).forEach(row=>{const labels=$$(':scope>label',row);setLabel(labels[0],'Cómo se vende');setLabel(labels[1],'Unidades que contiene');setLabel(labels[2],'Precio de venta');setLabel(labels[3],'Nombre de la unidad');const def=$('.v5-default span',row);if(def)def.textContent='Predeterminada';const cost=$('.v6-cost-block label',row);setLabel(cost,'Costo de esta presentación')});
    const help=$('.v5-presentation-note',editor);if(help)help.textContent='El stock siempre se controla en la unidad base. Puedes crear todas las presentaciones que necesites sin duplicar el producto.';
  }

  function closeModalNow(){
    const modal=$('#productModal');if(!modal)return;
    modal.classList.remove('visible');modal.hidden=true;
    const backdrop=$('#modalBackdrop');if(backdrop){backdrop.classList.remove('visible');backdrop.hidden=true}
    document.body.classList.remove('modal-open');
  }
  function savingPill(error=''){
    let el=$('.v75-saving-pill');
    if(error){if(!el){el=document.createElement('div');el.className='v75-saving-pill error';document.body.append(el)}el.className='v75-saving-pill error';el.innerHTML=`<i></i><span>${esc(error)}</span>`;setTimeout(()=>el.remove(),5200);return}
    const pending=queue.length+running;if(!pending){el?.remove();return}
    if(!el){el=document.createElement('div');el.className='v75-saving-pill';document.body.append(el)}el.className='v75-saving-pill';el.innerHTML=`<i></i><span>${pending===1?'Guardando en segundo plano…':`Guardando ${pending} productos…`}</span>`;
  }
  function capturePresentations(){return $$('.v5-presentation-row').map((row,index)=>({id:row.dataset.id||null,name:$('[data-p-name]',row)?.value.trim()||'Unidad',unit_label:$('[data-p-unit]',row)?.value.trim()||'unidad',units_per_presentation:Math.max(1,Math.trunc(Number($('[data-p-units]',row)?.value||1))),price:Math.max(0,Number($('[data-p-price]',row)?.value||0)),compare_at_price:null,sku:null,visible:true,is_default:Boolean($('[data-p-default]',row)?.checked),sort_order:index,cost_total:(()=>{const v=$('[data-p-cost]',row)?.value;return v===''||v==null?null:Math.max(0,Number(v||0))})()})).filter(x=>x.name)}
  function captureJob(){
    const name=$('#productName')?.value.trim()||'',price=Number($('#productPrice')?.value);if(name.length<2||!Number.isFinite(price)||price<0)return null;
    const old=productCache.get(String(activeProductId))||{};const file=$('#productImage')?.files?.[0]||null;
    return {file,old,product:{id:activeProductId||null,name,category_id:$('#productCategory')?.value||null,brand:$('#productBrand')?.value.trim()||null,price,compare_at_price:$('#productComparePrice')?.value?Number($('#productComparePrice').value):null,unit:$('#productUnit')?.value.trim()||null,sku:$('#productSku')?.value.trim()||null,description:$('#productDescription')?.value.trim()||null,status:$('#productStatus')?.value||'available',sort_order:Number($('#productSort')?.value||0),visible:$('#productVisible')?.checked!==false,featured:Boolean($('#productFeatured')?.checked),image_path:old.image_path||null,image_url:old.image_url||null},presentations:capturePresentations(),stock:{stock_tracking:Boolean($('#v5StockTracking')?.checked),stock_quantity:Math.max(0,Math.trunc(Number($('#v5StockQuantity')?.value||0))),low_stock_threshold:Math.max(0,Math.trunc(Number($('#v5LowThreshold')?.value||5))),base_unit:$('#v5BaseUnit')?.value.trim()||'unidad',allow_item_note:$('#v5AllowNote')?.checked!==false}};
  }
  async function optimize(file){if(!(file instanceof File)||file.size<300*1024||!/^image\/(jpeg|png|webp)$/i.test(file.type))return file;try{const bm=await createImageBitmap(file,{imageOrientation:'from-image'});const max=1152,s=Math.min(1,max/Math.max(bm.width,bm.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bm.width*s));c.height=Math.max(1,Math.round(bm.height*s));c.getContext('2d',{alpha:true}).drawImage(bm,0,0,c.width,c.height);bm.close?.();const blob=await new Promise(r=>c.toBlob(r,'image/webp',.8));return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'}):file}catch{return file}}
  async function upload(job){if(!job.file)return;const file=await optimize(job.file);const form=new FormData();form.set('action','upload_asset');form.set('kind','product');form.set('slug',slug);form.set('old_path',job.old?.image_path||'');form.set('file',file,file.name);const r=await baseFetch(CORE,{method:'POST',headers:{'X-Client-Version':config.version,'X-Provider-Session':providerToken()},body:form});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||'image_upload_failed');job.product.image_path=p.path||null;job.product.image_url=p.public_url||null}
  async function saveJob(job){
    await upload(job);
    const r=await baseFetch(CORE,{method:'POST',headers:headers(),body:JSON.stringify({action:'save_product',slug,product:job.product})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||'save_product_failed');const id=String(p.id||job.product.id||'');if(!id)throw new Error('missing_product_id');job.product.id=id;
    if(job.presentations.length){const pr=await baseFetch(V6,{method:'POST',headers:headers(),body:JSON.stringify({action:'save_presentations',slug,product_id:id,presentations:job.presentations})});if(!pr.ok)throw new Error('save_presentations_failed')}
    const sr=await baseFetch(ROUTER,{method:'POST',headers:headers(),body:JSON.stringify({action:'save_stock',slug,product_id:id,...job.stock})});if(!sr.ok)throw new Error('save_stock_failed');
    productCache.set(id,{...(job.old||{}),...job.product,...job.stock});
  }
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if($('#productModal')?.hidden!==false)$('#refreshBtn')?.click()},700)}
  function pump(){while(running<2&&queue.length){const job=queue.shift();running++;savingPill();saveJob(job).then(()=>scheduleRefresh()).catch(()=>savingPill('No se pudo terminar de guardar un producto. Toca actualizar y revisa ese producto.')).finally(()=>{running--;savingPill();pump()})}}
  function enqueue(job){queue.push(job);savingPill();pump()}

  function rowState(product){if(product?.archived_at)return'archived';if(product?.visible===false)return'hidden';return product?.status||'available'}
  function updateFilterCounts(){
    const products=[...productCache.values()];const counts={all:0,available:0,low:0,out:0,hidden:0,archived:0};products.forEach(p=>{const s=rowState(p);if(!p.archived_at)counts.all++;if(counts[s]!=null)counts[s]++});
    $$('[data-product-filter]').forEach(btn=>{const k=btn.dataset.productFilter;let b=$('b',btn);if(!b){b=document.createElement('b');btn.append(b)}b.textContent=String(counts[k]||0)});
  }
  function renderCategoryFilters(){
    const row=$('.filter-row');if(!row||!categories.length)return;let rail=$('#v75CategoryFilters');if(!rail){rail=document.createElement('div');rail.id='v75CategoryFilters';rail.className='v75-category-filters';row.insertAdjacentElement('afterend',rail)}
    const products=[...productCache.values()].filter(p=>!p.archived_at);const count=id=>products.filter(p=>String(p.category_id)===String(id)).length;
    const html=`<button data-v75-category="all" class="${activeCategory==='all'?'active':''}">Todas las categorías <b>${products.length}</b></button>${categories.filter(c=>c.visible!==false).map(c=>`<button data-v75-category="${esc(c.id)}" class="${String(activeCategory)===String(c.id)?'active':''}">${esc(c.name)} <b>${count(c.id)}</b></button>`).join('')}`;
    if(rail.dataset.html!==html){rail.dataset.html=html;rail.innerHTML=html}
  }
  function applyCombinedFilters(){
    if(applyingFilters)return;const list=$('#adminProductList');if(!list)return;applyingFilters=true;
    const q=($('#productSearch')?.value||'').trim().toLowerCase();const status=$('[data-product-filter].active')?.dataset.productFilter||'all';
    $$('.admin-product',list).forEach(row=>{const id=$('[data-edit-product]',row)?.dataset.editProduct||'';const p=productCache.get(String(id));if(!p)return;const s=rowState(p);const text=[p.name,p.brand,p.sku,p.unit,(categories.find(c=>String(c.id)===String(p.category_id))?.name||'')].join(' ').toLowerCase();const textOk=!q||text.includes(q);const statusOk=status==='all'?!p.archived_at:s===status;const catOk=activeCategory==='all'||String(p.category_id)===String(activeCategory);const show=textOk&&statusOk&&catOk;if(row.hidden===show)row.hidden=!show});
    applyingFilters=false;
  }

  function ensureOrderClose(){
    const modal=$('#orderModal');if(!modal||modal.hidden)return;if(!$('.v75-order-x',modal)){const b=document.createElement('button');b.type='button';b.className='v75-order-x';b.setAttribute('aria-label','Cerrar pedido');b.textContent='×';b.onclick=()=>{const native=$('[data-close-modal]',modal);if(native)native.click();else{modal.classList.remove('visible');modal.hidden=true}};modal.append(b)}
  }
  function polish(){applyStaticLogo();removeInstall();polishEditor();ensureOrderClose();$('#saveNextProductBtn')?.remove();if($('#archiveProductBtn'))$('#archiveProductBtn').hidden=true;renderCategoryFilters();updateFilterCounts();applyCombinedFilters()}
  function queuePolish(){if(polishQueued)return;polishQueued=true;requestAnimationFrame(()=>{polishQueued=false;polish()})}

  document.addEventListener('click',e=>{
    const edit=e.target.closest?.('[data-edit-product]');if(edit)activeProductId=edit.dataset.editProduct||'';
    if(e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]'))activeProductId='';
    const cat=e.target.closest?.('[data-v75-category]');if(cat){e.preventDefault();activeCategory=cat.dataset.v75Category||'all';renderCategoryFilters();applyCombinedFilters();return}
    if(e.target.closest?.('#saveProductBtn')&&!location.pathname.startsWith('/master')){
      const job=captureJob();if(!job){e.preventDefault();e.stopImmediatePropagation();savingPill('Completa nombre y precio correctamente.');return}
      e.preventDefault();e.stopImmediatePropagation();enqueue(job);closeModalNow();return;
    }
    if(e.target.closest?.('[data-open-order]'))setTimeout(ensureOrderClose,30);
  },true);

  const bodyObserver=new MutationObserver(records=>{if(records.every(r=>r.target?.closest?.('#v75CategoryFilters,.v75-saving-pill')))return;queuePolish()});
  const start=()=>{
    applyStaticLogo();removeInstall();bodyObserver.observe(document.body,{childList:true,subtree:true});setTimeout(queuePolish,40);
    const list=$('#adminProductList');if(list)new MutationObserver(()=>{if(!applyingFilters)requestAnimationFrame(()=>{updateFilterCounts();renderCategoryFilters();applyCombinedFilters()})}).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
    const filters=$('.filter-row');if(filters)new MutationObserver(()=>requestAnimationFrame(applyCombinedFilters)).observe(filters,{subtree:true,attributes:true,attributeFilter:['class']});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
