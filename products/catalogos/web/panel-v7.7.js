/* Hakuna Panel 10.8 — presentation photo UI only. Persistence is owned by panel-v10.8.js. */
(()=>{
'use strict';
if(window.__hakunaPanel77Stable)return;window.__hakunaPanel77Stable=true;
if(!/^\/panel(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
let activeProductId='',bootstrapCache=null,bootstrapAt=0,rowsObserver=null;

const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';

async function boot(force=false){
  if(!force&&bootstrapCache&&Date.now()-bootstrapAt<12000)return bootstrapCache;
  if(!C.apiUrl||!token())return bootstrapCache||{};
  try{
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version,'X-Provider-Session':token()},body:JSON.stringify({action:'provider_bootstrap',slug}),signal:ctl.signal});
    clearTimeout(timer);
    if(r.ok){bootstrapCache=await r.json();bootstrapAt=Date.now()}
  }catch{}
  return bootstrapCache||{};
}
function currentProduct(data){
  return (data.products||[]).find(p=>String(p.id)===String(activeProductId))||null;
}
function presentationFor(row,data){
  const id=String(row.dataset.id||'');
  if(id)return (data.presentations||[]).find(p=>String(p.id)===id)||null;
  const name=$('[data-p-name]',row)?.value?.trim()||'',units=Number($('[data-p-units]',row)?.value||1);
  return (data.presentations||[]).find(p=>String(p.product_id)===String(activeProductId)&&String(p.name||'').trim()===name&&Number(p.units_per_presentation||1)===units)||null;
}
function setBox(row,data){
  let box=$('.v77-presentation-image',row);
  if(!box){
    box=document.createElement('div');
    box.className='v77-presentation-image';
    box.innerHTML='<div class="v77-presentation-preview"><span>+</span></div><div class="v77-presentation-image-copy"><b>Foto de esta presentación</b><small>Usa una foto distinta solo cuando Unidad, Caja o Jaba se vean diferentes.</small></div><label><span>Elegir foto</span><input class="v77-presentation-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>';
    row.append(box);
  }
  const p=presentationFor(row,data),product=currentProduct(data);
  if(p?.id&&!row.dataset.id)row.dataset.id=String(p.id);
  const own=p?.image_url||row.dataset.hm108ImageUrl||'';
  const fallback=product?.image_url||'';
  const src=own||fallback;
  row.dataset.hm108ImageUrl=own||'';
  row.dataset.hm108ImagePath=p?.image_path||row.dataset.hm108ImagePath||'';
  row.dataset.hm108IsDefault=String(Boolean(p?.is_default));
  box.classList.toggle('inherited',!own&&!!fallback);
  const preview=$('.v77-presentation-preview',box);
  const existing=$('img',preview)?.getAttribute('src')||'';
  if(src&&existing!==src)preview.innerHTML=`<img src="${esc(src)}" alt="">`;
  else if(!src&&!preview.querySelector('span'))preview.innerHTML='<span>+</span>';
  const label=$('label',box),input=$('input',box);
  const ready=Boolean(row.dataset.id);
  input.disabled=!ready;
  label.classList.toggle('disabled',!ready);
  label.title=ready?'Cambiar foto':'Guarda el producto primero para habilitar la foto';
  const copy=$('.v77-presentation-image-copy small',box);
  if(copy&&!ready)copy.textContent='Primero guarda el producto. Luego podrás cargar la foto de esta presentación.';
  else if(copy&&own)copy.textContent=p?.is_default?'Esta foto también será la portada principal del producto.':'Foto propia guardada para esta presentación.';
  else if(copy&&fallback)copy.textContent='Ahora usa la portada general. Puedes elegir una foto propia.';
  else if(copy)copy.textContent='Añade una foto clara y centrada para esta presentación.';
}
async function decorate(force=false){
  const root=$('#v5PresentationRows');if(!root)return;
  const data=await boot(force);
  $$('.v5-presentation-row',root).forEach(row=>setBox(row,data));
}
function watchRows(){
  const root=$('#v5PresentationRows');if(!root||root.dataset.hm108Observed==='1')return;
  root.dataset.hm108Observed='1';
  rowsObserver?.disconnect();
  rowsObserver=new MutationObserver(()=>queueMicrotask(()=>decorate(false)));
  rowsObserver.observe(root,{childList:true});
  decorate(false);
}
document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-edit-product]');
  if(edit){activeProductId=String(edit.dataset.editProduct||'');bootstrapCache=null;setTimeout(()=>{watchRows();decorate(true)},45)}
  if(e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]')){activeProductId='';bootstrapCache=null;setTimeout(watchRows,45)}
},true);
window.addEventListener('hm108:photo-saved',()=>{bootstrapCache=null;decorate(true)});
const start=()=>{watchRows();setTimeout(()=>decorate(true),80)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();