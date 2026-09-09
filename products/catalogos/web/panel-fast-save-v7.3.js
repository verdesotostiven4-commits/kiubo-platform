(()=>{
  'use strict';
  const config=window.KIUBO_CATALOG_CONFIG;
  if(!config?.apiUrl||window.__kiuboFastSave73)return;
  window.__kiuboFastSave73=true;

  const nativeFetch=window.fetch.bind(window);
  const optimizedFiles=new WeakMap();
  let bootstrapCache=null;
  let fastBootstrapUntil=0;
  let backgroundRefreshTimer=0;

  const isApiUrl=input=>{
    const url=typeof input==='string'?input:input?.url||'';
    return url===config.apiUrl;
  };
  const parseJsonBody=init=>{
    try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}
  };
  const jsonResponse=(payload,status=200)=>new Response(JSON.stringify(payload),{
    status,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
  const productId=v=>String(v??'');

  function showSyncError(){
    const old=document.querySelector('.v73-save-warning');
    old?.remove();
    const el=document.createElement('div');
    el.className='v73-save-warning';
    el.textContent='El producto se guardó, pero el stock no terminó de sincronizar. Toca actualizar antes de seguir editándolo.';
    el.style.cssText='position:fixed;z-index:10050;left:50%;bottom:92px;max-width:min(92vw,440px);transform:translateX(-50%);padding:11px 14px;border-radius:13px;background:#8d3f3f;color:#fff;font:800 11px/1.35 system-ui,sans-serif;box-shadow:0 14px 34px rgba(0,0,0,.18)';
    document.body.append(el);
    setTimeout(()=>el.remove(),5200);
  }

  function mergeSavedProduct(request,payload){
    if(!bootstrapCache||!request?.product)return;
    const id=productId(payload?.id||request.product.id);
    if(!id)return;
    const products=Array.isArray(bootstrapCache.products)?bootstrapCache.products:[];
    const index=products.findIndex(item=>productId(item.id)===id);
    const existing=index>=0?products[index]:{};
    const merged={...existing,...request.product,id};
    if(index>=0)products[index]=merged;else products.unshift(merged);
    bootstrapCache.products=products;
    if(Array.isArray(payload?.presentations))bootstrapCache.presentations=payload.presentations;
  }

  function mergeStock(request){
    if(!bootstrapCache)return;
    const products=Array.isArray(bootstrapCache.products)?bootstrapCache.products:[];
    const p=products.find(item=>productId(item.id)===productId(request.product_id));
    if(!p)return;
    const tracking=request.stock_tracking===true;
    const qty=Math.max(0,Math.trunc(Number(request.stock_quantity||0)));
    const threshold=Math.max(0,Math.trunc(Number(request.low_stock_threshold||0)));
    p.stock_tracking=tracking;
    p.stock_quantity=qty;
    p.low_stock_threshold=threshold;
    p.base_unit=request.base_unit||p.base_unit||'unidad';
    p.allow_item_note=request.allow_item_note!==false;
    if(tracking)p.status=qty<=0?'out':qty<=threshold?'low':'available';
  }

  function rememberBootstrap(payload){
    if(payload?.account&&Array.isArray(payload?.products))bootstrapCache=typeof structuredClone==='function'?structuredClone(payload):JSON.parse(JSON.stringify(payload));
  }

  function scheduleBackgroundRefresh(input,init){
    clearTimeout(backgroundRefreshTimer);
    backgroundRefreshTimer=setTimeout(()=>{
      nativeFetch(input,init).then(async res=>{
        if(!res.ok)return;
        const payload=await res.json().catch(()=>null);
        if(payload)rememberBootstrap(payload);
      }).catch(()=>{});
    },900);
  }

  async function optimizeImage(file){
    if(!(file instanceof File)||file.size<=650*1024||!/^image\/(jpeg|png|webp)$/i.test(file.type))return file;
    try{
      const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      const maxSide=1400;
      const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
      const width=Math.max(1,Math.round(bitmap.width*scale));
      const height=Math.max(1,Math.round(bitmap.height*scale));
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{alpha:true});
      ctx.drawImage(bitmap,0,0,width,height);
      bitmap.close?.();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.84));
      if(!blob||blob.size>=file.size*.94)return file;
      const name=file.name.replace(/\.[^.]+$/,'')+'.webp';
      return new File([blob],name,{type:'image/webp',lastModified:file.lastModified||Date.now()});
    }catch{return file}
  }

  function prepareImage(file){
    if(!optimizedFiles.has(file))optimizedFiles.set(file,optimizeImage(file));
    return optimizedFiles.get(file);
  }

  document.addEventListener('change',event=>{
    if(event.target?.id!=='productImage')return;
    const file=event.target.files?.[0];
    if(file)void prepareImage(file);
  },true);

  window.fetch=async(input,init={})=>{
    if(!isApiUrl(input))return nativeFetch(input,init);

    if(init?.body instanceof FormData){
      const form=init.body;
      if(form.get('action')==='upload_asset'&&form.get('kind')==='product'){
        const file=form.get('file');
        if(file instanceof File){
          const optimized=await prepareImage(file);
          if(optimized!==file)form.set('file',optimized,optimized.name);
        }
      }
      return nativeFetch(input,init);
    }

    const body=parseJsonBody(init);
    if(!body?.action)return nativeFetch(input,init);

    if(body.action==='provider_bootstrap'||body.action==='master_bootstrap'){
      if(bootstrapCache&&Date.now()<fastBootstrapUntil){
        scheduleBackgroundRefresh(input,init);
        return jsonResponse(bootstrapCache);
      }
      const response=await nativeFetch(input,init);
      if(response.ok){
        const payload=await response.clone().json().catch(()=>null);
        if(payload)rememberBootstrap(payload);
      }
      return response;
    }

    if(body.action==='save_stock'){
      mergeStock(body);
      nativeFetch(input,init).then(res=>{if(!res.ok)showSyncError()}).catch(showSyncError);
      return jsonResponse({ok:true,product_id:body.product_id,deferred:true});
    }

    if(body.action==='save_product'){
      const response=await nativeFetch(input,init);
      if(response.ok){
        const payload=await response.clone().json().catch(()=>({}));
        mergeSavedProduct(body,payload);
        fastBootstrapUntil=Date.now()+5000;
      }
      return response;
    }

    return nativeFetch(input,init);
  };
})();
