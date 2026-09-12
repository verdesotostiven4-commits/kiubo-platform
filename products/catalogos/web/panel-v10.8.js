/* Hakuna Panel 10.8 — single, durable photo pipeline + mobile modal stability. */
(()=>{
'use strict';
if(window.__hakunaPanel108)return;window.__hakunaPanel108=true;
if(!/^\/panel(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const QKEY=`hm108-photo-queue:${slug}`;
const objectUrls=new WeakMap();
let flushing=false;

const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
const readQueue=()=>{try{return JSON.parse(localStorage.getItem(QKEY)||'[]')}catch{return[]}};
const writeQueue=q=>{try{q.length?localStorage.setItem(QKEY,JSON.stringify(q.slice(-40))):localStorage.removeItem(QKEY)}catch{}};
function toast(message,error=false){
  const old=$('.hm108-toast');old?.remove();
  const el=document.createElement('div');el.className=`hm108-toast${error?' error':''}`;el.textContent=message;document.body.append(el);
  requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),180)},2800);
}
async function fetchTimed(url,init={},ms=22000){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),ms);
  try{return await fetch(url,{...init,signal:ctl.signal})}finally{clearTimeout(timer)}
}
async function api(action,payload={},ms=18000){
  const r=await fetchTimed(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version,'X-Provider-Session':token()},body:JSON.stringify({action,slug,...payload})},ms);
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data.message||data.error||'request_failed'),{status:r.status,code:data.error});
  return data;
}
async function optimize(file){
  if(!(file instanceof File)||file.size<350*1024||!/^image\/(jpeg|png|webp)$/i.test(file.type))return file;
  try{
    const bmp=await createImageBitmap(file,{imageOrientation:'from-image'}),max=1200,scale=Math.min(1,max/Math.max(bmp.width,bmp.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));
    canvas.getContext('2d',{alpha:true}).drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close?.();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));
    return blob&&blob.size<file.size?new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'}):file;
  }catch{return file}
}
async function upload(file,oldPath=''){
  const f=await optimize(file),form=new FormData();
  form.set('action','upload_asset');form.set('kind','product');form.set('slug',slug);form.set('old_path',oldPath||'');form.set('file',f,f.name);
  const r=await fetchTimed(C.apiUrl,{method:'POST',headers:{'X-Client-Version':C.version,'X-Provider-Session':token()},body:form},35000);
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(data.message||data.error||'upload_failed'),{status:r.status,code:data.error});
  if(!data.public_url||!data.path)throw new Error('upload_incomplete');
  return data;
}
async function verify(id,url){
  const b=await api('provider_bootstrap',{},18000),p=(b.presentations||[]).find(x=>String(x.id)===String(id));
  return Boolean(p&&String(p.image_url||'')===String(url||''));
}
function enqueue(item){
  const q=readQueue().filter(x=>String(x.id)!==String(item.id));q.push({...item,at:Date.now(),tries:Number(item.tries||0)});writeQueue(q);
}
async function persist(item,shouldVerify=true){
  await api('save_presentation_image',{presentation_id:item.id,image_url:item.url,image_path:item.path},18000);
  if(shouldVerify&&!(await verify(item.id,item.url)))throw new Error('verify_failed');
}
async function flush(){
  if(flushing||!navigator.onLine||!token())return;flushing=true;
  try{
    const source=readQueue(),left=[];
    for(const item of source){
      try{await persist(item,false)}
      catch{left.push({...item,tries:Number(item.tries||0)+1})}
    }
    writeQueue(left);
  }finally{flushing=false}
}
function setPreview(row,url){
  const preview=$('.v77-presentation-preview',row);if(!preview)return;
  const old=objectUrls.get(preview);if(old&&old!==url&&old.startsWith('blob:'))URL.revokeObjectURL(old);
  if(url?.startsWith('blob:'))objectUrls.set(preview,url);
  preview.innerHTML=url?'<img alt="">':'<span>+</span>';
  const img=$('img',preview);if(img)img.src=url;
}
function setRowState(row,state,message=''){
  const box=$('.v77-presentation-image',row);if(!box)return;
  box.classList.toggle('busy',state==='saving');box.classList.toggle('hm108-saved',state==='saved');box.classList.toggle('hm108-pending',state==='pending');
  box.setAttribute('aria-busy',String(state==='saving'));
  const input=$('.v77-presentation-file',box);if(input)input.disabled=state==='saving'||!row.dataset.id;
  const copy=$('.v77-presentation-image-copy small',box);if(copy&&message)copy.textContent=message;
}
async function handlePresentation(input){
  const row=input.closest('.v5-presentation-row'),file=input.files?.[0];if(!row||!file)return;
  const id=String(row.dataset.id||'');
  if(!id){input.value='';return toast('Guarda el producto primero; luego sube la foto de Unidad, Caja o Jaba.',true)}
  if(file.size>5*1024*1024){input.value='';return toast('La imagen supera 5 MB.',true)}
  if(!/^image\/(png|jpeg|webp)$/i.test(file.type)){input.value='';return toast('Usa PNG, JPG o WebP.',true)}
  const local=URL.createObjectURL(file);setPreview(row,local);setRowState(row,'saving','Subiendo y verificando la foto…');
  try{
    const up=await upload(file,row.dataset.hm108ImagePath||'');
    const item={id,url:up.public_url,path:up.path};
    row.dataset.hm108ImageUrl=item.url;row.dataset.hm108ImagePath=item.path;
    try{
      await persist(item,true);writeQueue(readQueue().filter(x=>String(x.id)!==id));
      setPreview(row,item.url);setRowState(row,'saved',row.dataset.hm108IsDefault==='true'?'Guardada · también es la portada principal.':'Guardada correctamente para esta presentación.');
      window.dispatchEvent(new CustomEvent('hm108:photo-saved',{detail:item}));toast('Foto guardada');
    }catch{
      enqueue(item);setPreview(row,item.url);setRowState(row,'pending','Foto subida. Quedó en cola y se guardará automáticamente al reconectar.');
      toast('La foto quedó protegida en cola; reintentaremos automáticamente.',true)
    }
  }catch(error){
    setRowState(row,'','No pudimos subirla. Intenta otra vez; el resto del producto sigue editable.');
    toast(error?.name==='AbortError'?'La subida tardó demasiado. Intenta nuevamente.':'No pudimos subir la foto.',true)
  }finally{input.value=''}
}
function polishGeneral(){
  const wrap=$('.product-image-upload');if(!wrap)return;
  const title=$('label b',wrap),hint=$('label small',wrap);
  if(title)title.textContent='Portada general (opcional)';
  if(hint)hint.textContent='No necesitas subir la misma foto dos veces: la foto de la presentación principal también se usa como portada.';
}

function generalPhotoState(file){
  const wrap=$('.product-image-upload');if(!wrap)return;
  let state=$('#hm108GeneralPhotoState',wrap);
  if(!state){state=document.createElement('span');state.id='hm108GeneralPhotoState';state.className='hm108-general-state';wrap.querySelector('label')?.append(state)}
  state.textContent=file?'Foto seleccionada · se guardará junto con el producto.':'';
}
function stabilizeModal(){
  const modal=$('#productModal');if(!modal)return;
  modal.classList.toggle('hm108-open',!modal.hidden);
  if(!modal.hidden){
    const form=$('#productForm',modal);if(form)form.style.webkitOverflowScrolling='touch';
    const close=$('[data-close-modal]',modal);if(close)close.setAttribute('aria-label','Cerrar editor');
  }
}
document.addEventListener('change',e=>{
  if(e.target?.matches?.('.v77-presentation-file')){e.preventDefault();handlePresentation(e.target);return}
  if(e.target?.id==='productImage')generalPhotoState(e.target.files?.[0]||null);
},true);
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-edit-product],#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]'))setTimeout(()=>{polishGeneral();generalPhotoState(null);stabilizeModal()},50);
  if(e.target.closest?.('[data-close-modal]'))setTimeout(stabilizeModal,0);
},true);
window.addEventListener('online',()=>setTimeout(flush,250));window.addEventListener('focus',()=>setTimeout(flush,250));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(flush,250)});
const modal=$('#productModal');if(modal)new MutationObserver(stabilizeModal).observe(modal,{attributes:true,attributeFilter:['hidden','class']});
const start=()=>{polishGeneral();stabilizeModal();flush();setInterval(flush,30000);document.documentElement.dataset.hmPanel='10.8'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();