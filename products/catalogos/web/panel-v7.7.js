(()=>{
'use strict';
if(window.__hakunaPresentationPhotos784)return;window.__hakunaPresentationPhotos784=true;
const C=window.KIUBO_CATALOG_CONFIG;if(!C?.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
const upstreamFetch=window.fetch.bind(window);
const META_RE=/\s*\[\[KIUBO_PI:([A-Za-z0-9_-]+)\]\]\s*$/;
let cache=null,loading=null,raf=0,modalObs=null,activeId='';
const imageMaps=new Map();
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function b64e(obj){const bytes=new TextEncoder().encode(JSON.stringify(obj));let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function b64d(s){try{const v=String(s||''),raw=atob(v.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((v.length+3)%4)),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return{}}}
function splitDescription(value=''){const src=String(value||''),m=src.match(META_RE);return{text:(m?src.slice(0,m.index):src).trim(),images:m?b64d(m[1]):{}}}
function withDescriptionMeta(text,map){const clean=splitDescription(text).text,has=map&&Object.keys(map).length;if(!has)return clean||null;return `${clean}${clean?'\n':''}[[KIUBO_PI:${b64e(map)}]]`}
function ingest(payload){cache=payload||cache;if(!payload?.products)return;for(const p of payload.products){const parsed=splitDescription(p.description||'');if(Object.keys(parsed.images).length)imageMaps.set(String(p.id),parsed.images)}}
function productById(id){return cache?.products?.find(p=>String(p.id)===String(id))||null}
function resolveActiveId(){if(activeId)return String(activeId);const name=$('#productName')?.value?.trim();const p=cache?.products?.find(x=>norm(x.name)===norm(name));if(p)activeId=String(p.id);return activeId}
function mapFor(pid){pid=String(pid||'');if(!pid)return{};if(!imageMaps.has(pid)){const p=productById(pid),parsed=splitDescription(p?.description||'');imageMaps.set(pid,parsed.images||{})}return imageMaps.get(pid)||{}}
function rows(){const root=$('#v5PresentationRows');if(!root)return[];const direct=$$('.v5-presentation-row',root);if(direct.length)return direct;return [...new Set($$('[data-p-name]',root).map(el=>el.closest('[data-id]')||el.closest('div')).filter(Boolean))]}
function rowInfo(row){return{id:String(row?.dataset?.id||''),name:$('[data-p-name]',row)?.value?.trim()||'',units:Math.max(1,Math.trunc(Number($('[data-p-units]',row)?.value||1)))}}
function presentationsFor(pid){return(cache?.presentations||[]).filter(p=>String(p.product_id)===String(pid))}
function presentationForRow(pid,row){const info=rowInfo(row),list=presentationsFor(pid);let p=info.id?list.find(x=>String(x.id)===info.id):null;if(!p)p=list.find(x=>norm(x.name)===norm(info.name)&&Number(x.units_per_presentation||1)===info.units)||null;if(p&&!row.dataset.id)row.dataset.id=String(p.id);return p}
function metaForRow(pid,row){const info=rowInfo(row),map=mapFor(pid);if(info.id&&map[info.id])return map[info.id];return Object.values(map).find(x=>norm(x?.n)===norm(info.name)&&Number(x?.c||1)===info.units)||null}
function cleanDescriptionField(){const field=$('#productDescription');if(!field)return;const parsed=splitDescription(field.value);const pid=resolveActiveId();if(pid&&Object.keys(parsed.images).length)imageMaps.set(String(pid),{...mapFor(pid),...parsed.images});if(field.value!==parsed.text)field.value=parsed.text}
async function api(action,payload={}){const r=await upstreamFetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version,'X-Provider-Session':token()},body:JSON.stringify({action,slug,...payload})});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'request_failed');return b}
async function boot(force=false){if(cache&&!force)return cache;if(loading&&!force)return loading;loading=api('provider_bootstrap').then(p=>(ingest(p),p)).finally(()=>loading=null);return loading}
async function optimize(f){if(!(f instanceof File)||f.size<280*1024||!/^image\/(jpeg|png|webp)$/i.test(f.type))return f;try{const b=await createImageBitmap(f,{imageOrientation:'from-image'}),m=960,s=Math.min(1,m/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.width*s));c.height=Math.max(1,Math.round(b.height*s));c.getContext('2d',{alpha:true}).drawImage(b,0,0,c.width,c.height);b.close?.();const blob=await new Promise(r=>c.toBlob(r,'image/webp',.84));return blob&&blob.size<f.size?new File([blob],f.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'}):f}catch{return f}}
function toast(msg,type=''){const e=document.createElement('div');e.className=`v77-panel-toast ${type}`;e.textContent=msg;document.body.append(e);requestAnimationFrame(()=>e.classList.add('show'));setTimeout(()=>{e.classList.remove('show');setTimeout(()=>e.remove(),160)},2300)}
function fallbackSource(pid){return productById(pid)?.image_url||''}
function updateControl(row){const box=$('.v77-presentation-image',row);if(!box)return;const pid=resolveActiveId(),info=rowInfo(row),p=pid?presentationForRow(pid,row):null,m=pid?metaForRow(pid,row):null,own=p?.image_url||m?.u||'',fallback=pid?fallbackSource(pid):'',src=own||fallback||'';box.classList.toggle('inherited',Boolean(!own&&fallback));const preview=$('.v77-presentation-preview',box);if(preview)preview.innerHTML=src?`<img src="${String(src).replace(/"/g,'&quot;')}" alt="">`:'<span>+</span>';const title=$('.v77-presentation-image-copy b',box);if(title)title.textContent=`Foto · ${info.name||'presentación'}`;const copy=$('.v77-presentation-image-copy small',box);if(copy)copy.textContent=own?'Foto propia para esta presentación':fallback?'Ahora usa la foto general · puedes poner una distinta':'Sube una foto específica para esta presentación';const button=$('.v77-presentation-image>label',box);if(button){button.childNodes[0].nodeValue=own?'Cambiar foto':'Subir foto';button.classList.toggle('disabled',Boolean(!p&&!pid))}}
function addControl(row){let wrap=$('.v77-presentation-image',row);if(!wrap){wrap=document.createElement('div');wrap.className='v77-presentation-image';wrap.innerHTML='<div class="v77-presentation-preview"><span>+</span></div><div class="v77-presentation-image-copy"><b>Foto de presentación</b><small>Puedes usar una imagen distinta</small></div><label>Subir foto<input type="file" accept="image/png,image/jpeg,image/webp" hidden></label>';row.append(wrap);const input=$('input[type="file"]',wrap);input.onchange=()=>{const f=input.files?.[0];if(f)upload(row,f);input.value=''}}updateControl(row)}
async function ensureIdentity(row){let pid=resolveActiveId();if(!cache||!pid){try{await boot(true)}catch{}pid=resolveActiveId()}let p=pid?presentationForRow(pid,row):null;if(!p&&pid){try{await boot(true);p=presentationForRow(pid,row)}catch{}}return{pid,p}}
async function upload(row,file){const ui=$('.v77-presentation-image',row);ui?.classList.add('busy');try{const {pid,p}=await ensureIdentity(row);if(!pid||!p?.id)throw new Error('presentation_not_saved');row.dataset.id=String(p.id);const info=rowInfo(row),f=await optimize(file),fd=new FormData();fd.set('action','upload_asset');fd.set('kind','product');fd.set('slug',slug);fd.set('old_path','');fd.set('file',f,f.name);const r=await upstreamFetch(C.apiUrl,{method:'POST',headers:{'X-Client-Version':C.version,'X-Provider-Session':token()},body:fd});const up=await r.json().catch(()=>({}));if(!r.ok)throw new Error(up.error||'upload_failed');const map={...mapFor(pid)};map[String(p.id)]={u:up.public_url||'',p:up.path||'',n:info.name,c:info.units};imageMaps.set(String(pid),map);row.dataset.v77PendingImage='1';updateControl(row);toast(`Foto de ${info.name||'presentación'} lista · sincronizando`)}catch(err){console.error(err);if(err?.message==='presentation_not_saved')toast('Guarda el producto una vez para crear esa presentación y luego sube la foto','error');else toast(err?.message==='file_too_large'?'La imagen supera 5 MB':'No pudimos subir esa imagen','error')}finally{ui?.classList.remove('busy')}}
function decorateRows(){raf=0;cleanDescriptionField();const list=rows();if(!list.length)return;list.forEach(addControl);boot().then(()=>{cleanDescriptionField();list.forEach(updateControl)}).catch(()=>{})}
function queueDecorate(){if(raf)return;raf=requestAnimationFrame(decorateRows)}
function observeModal(){const modal=$('#productModal');if(!modal||modalObs)return false;modalObs=new MutationObserver(queueDecorate);modalObs.observe(modal,{childList:true,subtree:true});return true}
function ensureObserver(){if(observeModal())return;let tries=0;const timer=setInterval(()=>{tries++;if(observeModal()||tries>40)clearInterval(timer)},200)}
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  let next=init,body=null;
  if(url===C.apiUrl&&typeof init?.body==='string'){
    try{body=JSON.parse(init.body)}catch{}
    if(body?.action==='save_product'&&body.product){
      const pid=String(body.product.id||resolveActiveId()||'');
      const map=mapFor(pid);
      if(pid&&Object.keys(map).length){
        body={...body,product:{...body.product,description:withDescriptionMeta(body.product.description,map)}};
        next={...init,body:JSON.stringify(body)};
      }
    }
  }
  const res=await upstreamFetch(input,next);
  if(url===C.apiUrl&&res.ok&&body?.action==='save_product')setTimeout(()=>boot(true).then(queueDecorate).catch(()=>{}),100);
  return res;
};
document.addEventListener('click',e=>{const edit=e.target.closest?.('[data-edit-product]');if(edit)activeId=String(edit.dataset.editProduct||'');if(e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]'))activeId='';if(edit||e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]')){setTimeout(queueDecorate,20);setTimeout(queueDecorate,100);setTimeout(queueDecorate,260);setTimeout(queueDecorate,600)}},true);
document.addEventListener('input',e=>{if(e.target.closest?.('#v5PresentationRows'))queueDecorate()},true);
document.addEventListener('focusin',e=>{if(e.target.closest?.('#productModal'))queueDecorate()},true);
const start=()=>{ensureObserver();queueDecorate();boot().then(queueDecorate).catch(()=>{})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
