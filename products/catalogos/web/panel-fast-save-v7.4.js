(()=>{
  'use strict';
  const config=window.KIUBO_CATALOG_CONFIG;
  if(!config?.apiUrl||window.__kiuboFastSave74)return;
  window.__kiuboFastSave74=true;

  const nativeFetch=window.fetch.bind(window);
  const optimizedFiles=new WeakMap();
  let bootstrapCache=null,cacheUntil=0,refreshTimer=0,currentProductId='',advanceAfterSave=false;
  const urlOf=input=>typeof input==='string'?input:input?.url||'';
  const isApi=input=>urlOf(input)===config.apiUrl;
  const parse=init=>{try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}};
  const json=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

  function remember(payload){
    if(payload?.account&&Array.isArray(payload?.products))bootstrapCache=typeof structuredClone==='function'?structuredClone(payload):JSON.parse(JSON.stringify(payload));
  }
  function refreshInBackground(input,init){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>nativeFetch(input,init).then(async r=>{if(r.ok){const p=await r.json().catch(()=>null);if(p)remember(p)}}).catch(()=>{}),500);
  }
  function invalidate(){bootstrapCache=null;cacheUntil=0}

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

  window.fetch=async(input,init={})=>{
    if(!isApi(input))return nativeFetch(input,init);
    if(init?.body instanceof FormData){
      const form=init.body;
      if(form.get('action')==='upload_asset'&&form.get('kind')==='product'){
        const file=form.get('file');
        if(file instanceof File){const small=await prepared(file);if(small!==file)form.set('file',small,small.name)}
      }
      invalidate();
      return nativeFetch(input,init);
    }
    const body=parse(init);
    if(body?.action==='provider_bootstrap'||body?.action==='master_bootstrap'){
      if(bootstrapCache&&Date.now()<cacheUntil){refreshInBackground(input,init);return json(bootstrapCache)}
      const r=await nativeFetch(input,init);
      if(r.ok){const p=await r.clone().json().catch(()=>null);if(p){remember(p);cacheUntil=Date.now()+1200}}
      return r;
    }
    const r=await nativeFetch(input,init);
    if(body?.action&&body.action!=='order_status')invalidate();
    return r;
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