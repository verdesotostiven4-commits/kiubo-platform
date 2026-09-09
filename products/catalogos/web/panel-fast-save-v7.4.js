(()=>{
  'use strict';
  const config=window.KIUBO_CATALOG_CONFIG;
  if(!config?.apiUrl||window.__kiuboFastSave74)return;
  window.__kiuboFastSave74=true;

  const nativeFetch=window.fetch.bind(window);
  const CORE=`${config.supabaseUrl}/functions/v1/catalog-api`;
  const ROUTER=`${config.supabaseUrl}/functions/v1/catalog-router`;
  const V6=`${config.supabaseUrl}/functions/v1/catalog-v6`;
  const optimizedFiles=new WeakMap();
  let bootstrapCache=null,fastBootstrapUntil=0,backgroundRefreshTimer=0;
  let currentProductId='',advanceAfterSave=false;

  const urlOf=input=>typeof input==='string'?input:input?.url||'';
  const isApi=input=>urlOf(input)===config.apiUrl;
  const parse=init=>{try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}};
  const cloneInit=(init,body)=>({...init,body:typeof body==='string'||body instanceof FormData?body:JSON.stringify(body)});
  const json=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  const pid=v=>String(v??'');

  function warning(copy='Hubo un problema al sincronizar en segundo plano. Toca actualizar antes de seguir editando ese producto.'){
    document.querySelector('.v74-save-warning')?.remove();
    const el=document.createElement('div');el.className='v74-save-warning';el.textContent=copy;
    el.style.cssText='position:fixed;z-index:10050;left:50%;bottom:96px;max-width:min(92vw,450px);transform:translateX(-50%);padding:11px 14px;border-radius:13px;background:#8d3f3f;color:#fff;font:800 11px/1.35 system-ui,sans-serif;box-shadow:0 14px 34px rgba(0,0,0,.18)';
    document.body.append(el);setTimeout(()=>el.remove(),5200);
  }

  function remember(payload){if(payload?.account&&Array.isArray(payload?.products))bootstrapCache=typeof structuredClone==='function'?structuredClone(payload):JSON.parse(JSON.stringify(payload))}
  function mergeProduct(request,payload){
    if(!bootstrapCache||!request?.product)return;
    const id=pid(payload?.id||request.product.id);if(!id)return;
    const products=Array.isArray(bootstrapCache.products)?bootstrapCache.products:[];
    const i=products.findIndex(x=>pid(x.id)===id),old=i>=0?products[i]:{};
    const merged={...old,...request.product,id};if(i>=0)products[i]=merged;else products.unshift(merged);bootstrapCache.products=products;
  }
  function mergeStock(request){
    if(!bootstrapCache)return;const p=(bootstrapCache.products||[]).find(x=>pid(x.id)===pid(request.product_id));if(!p)return;
    const on=request.stock_tracking===true,qty=Math.max(0,Math.trunc(Number(request.stock_quantity||0))),low=Math.max(0,Math.trunc(Number(request.low_stock_threshold||0)));
    Object.assign(p,{stock_tracking:on,stock_quantity:qty,low_stock_threshold:low,base_unit:request.base_unit||p.base_unit||'unidad',allow_item_note:request.allow_item_note!==false});
    if(on)p.status=qty<=0?'out':qty<=low?'low':'available';
  }
  function mergePresentations(productId,rows){
    if(!bootstrapCache||!Array.isArray(rows))return;
    const keep=(bootstrapCache.presentations||[]).filter(x=>pid(x.product_id)!==pid(productId));
    bootstrapCache.presentations=[...keep,...rows];
  }

  function backgroundRefresh(input,init){
    clearTimeout(backgroundRefreshTimer);
    backgroundRefreshTimer=setTimeout(()=>nativeFetch(V6,init).then(async r=>{if(r.ok){const p=await r.json().catch(()=>null);if(p)remember(p)}}).catch(()=>{}),1400);
  }

  async function optimizeImage(file){
    if(!(file instanceof File)||file.size<=320*1024||!/^image\/(jpeg|png|webp)$/i.test(file.type))return file;
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      const maxSide=1152,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
      const w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      canvas.getContext('2d',{alpha:true})?.drawImage(bitmap,0,0,w,h);bitmap.close?.();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.79));
      if(!blob||blob.size>=file.size*.93)return file;
      return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp',lastModified:file.lastModified||Date.now()});
    }catch{return file}
  }
  function prepared(file){if(!optimizedFiles.has(file))optimizedFiles.set(file,optimizeImage(file));return optimizedFiles.get(file)}
  document.addEventListener('change',e=>{if(e.target?.id==='productImage'&&e.target.files?.[0])void prepared(e.target.files[0])},true);

  async function backgroundPresentations(body,payload,headers){
    if(!Array.isArray(body.presentations)||!body.presentations.length||!payload?.id)return;
    const req={action:'save_presentations',slug:body.slug||'hakuna-matata',product_id:payload.id,presentations:body.presentations};
    try{
      const r=await nativeFetch(V6,{method:'POST',headers,body:JSON.stringify(req)});if(!r.ok)throw 0;
      const p=await r.json().catch(()=>null);if(Array.isArray(p?.presentations))mergePresentations(payload.id,p.presentations);
    }catch{warning('El producto se guardó, pero las presentaciones no terminaron de sincronizar. Toca actualizar antes de volver a editarlo.')}
  }

  window.fetch=async(input,init={})=>{
    if(!isApi(input))return nativeFetch(input,init);

    if(init?.body instanceof FormData){
      const form=init.body;
      if(form.get('action')==='upload_asset'&&form.get('kind')==='product'){
        const file=form.get('file');if(file instanceof File){const small=await prepared(file);if(small!==file)form.set('file',small,small.name)}
        return nativeFetch(CORE,init);
      }
      return nativeFetch(input,init);
    }

    const body=parse(init);if(!body?.action)return nativeFetch(input,init);
    const headers=init.headers||{};

    if(body.action==='provider_bootstrap'||body.action==='master_bootstrap'){
      if(bootstrapCache&&Date.now()<fastBootstrapUntil){backgroundRefresh(input,init);return json(bootstrapCache)}
      const r=await nativeFetch(V6,init);if(r.ok){const p=await r.clone().json().catch(()=>null);if(p)remember(p)}return r;
    }

    if(body.action==='save_product'){
      const coreBody={...body};delete coreBody.presentations;
      const r=await nativeFetch(CORE,cloneInit(init,coreBody));
      if(r.ok){
        const payload=await r.clone().json().catch(()=>({}));mergeProduct(body,payload);fastBootstrapUntil=Date.now()+8000;
        void backgroundPresentations(body,payload,headers);
      }
      return r;
    }

    if(body.action==='save_stock'){
      mergeStock(body);
      nativeFetch(ROUTER,init).then(r=>{if(!r.ok)warning()}).catch(()=>warning());
      return json({ok:true,product_id:body.product_id,deferred:true});
    }

    if(body.action==='delete_product'||body.action==='reset_orders')return nativeFetch(input,init);
    return nativeFetch(V6,init);
  };

  function ensureSaveNext(){
    const modal=document.querySelector('#productModal'),footer=modal?.querySelector('footer'),save=document.querySelector('#saveProductBtn');
    if(!modal||!footer||!save||document.querySelector('#saveNextProductBtn'))return;
    const btn=document.createElement('button');btn.id='saveNextProductBtn';btn.type='button';btn.className='button button--secondary';btn.textContent='Guardar y siguiente';
    footer.insertBefore(btn,save);btn.onclick=()=>{if(!currentProductId)return save.click();advanceAfterSave=true;save.click()};
    new MutationObserver(()=>{if(!modal.hidden||!advanceAfterSave)return;advanceAfterSave=false;const rows=[...document.querySelectorAll('#adminProductList .admin-product:not([hidden])')];const i=rows.findIndex(row=>row.querySelector('[data-edit-product]')?.dataset.editProduct===currentProductId);const next=rows[i+1]?.querySelector('[data-edit-product]');if(next)setTimeout(()=>next.click(),40)}).observe(modal,{attributes:true,attributeFilter:['hidden']});
  }
  document.addEventListener('click',e=>{
    const edit=e.target.closest?.('[data-edit-product]');if(edit){currentProductId=edit.dataset.editProduct||'';setTimeout(ensureSaveNext,30)}
    if(e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]')){currentProductId='';setTimeout(ensureSaveNext,30)}
  },true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureSaveNext,{once:true});else ensureSaveNext();
})();