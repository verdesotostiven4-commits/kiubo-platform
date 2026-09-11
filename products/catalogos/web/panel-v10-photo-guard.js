/* Hakuna Panel 10.4.1 — verified persistence guard for presentation photos. */
(()=>{
'use strict';
if(window.__hakunaPhotoGuard1041)return;window.__hakunaPhotoGuard1041=true;
if(/^\/master(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
const KEY=`kiubo-v10-photo-verified-queue:${slug}`;
const read=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}catch{return{}}};
const write=q=>{try{localStorage.setItem(KEY,JSON.stringify(q))}catch{}};
const pathFromUrl=url=>{try{const u=new URL(url,location.href),m='/storage/v1/object/public/catalog-assets-v4/';const i=u.pathname.indexOf(m);return i>=0?decodeURIComponent(u.pathname.slice(i+m.length)):''}catch{return''}};
function status(row,text,state=''){const copy=$('.v77-presentation-image-copy small',row);if(copy)copy.textContent=text;if(row){row.dataset.hmPhotoGuard=state;state==='busy'?row.setAttribute('aria-busy','true'):row.removeAttribute('aria-busy')}}
function remember(item){if(!item?.id||!item.image_url||!item.image_path)return;const q=read();q[item.id]={...item,attempts:Number(q[item.id]?.attempts||0),updated_at:new Date().toISOString()};write(q)}
function forget(id){const q=read();if(q[id]){delete q[id];write(q)}}
function itemFromRow(row){const id=String(row?.dataset?.id||''),img=$('.v77-presentation-preview img',row),url=row?.dataset?.v10ImageUrl||img?.src||'',path=row?.dataset?.v10ImagePath||pathFromUrl(url);if(!/^[0-9a-f-]{36}$/i.test(id)||!url||!path)return null;return{id,image_url:url,image_path:path}}
async function call(action,payload={}){
 const s=token();if(!s)throw new Error('session_missing');
 const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version||'10.4.1','X-Provider-Session':s},body:JSON.stringify({action,slug,...payload})});
 const b=await r.json().catch(()=>({}));if(!r.ok||b?.ok===false)throw new Error(b?.error||`request_${r.status}`);return b;
}
async function verify(item){
 const b=await call('provider_bootstrap');const p=(b?.presentations||[]).find(x=>String(x.id)===String(item.id));if(!p)return false;
 const sameUrl=String(p.image_url||'')===String(item.image_url||''),samePath=String(p.image_path||'')===String(item.image_path||'');
 return Boolean((p.image_url||p.image_path)&&(sameUrl||samePath));
}
let busy=false;
async function persist(item,row=null){
 if(!item||!navigator.onLine||!token())return false;
 const q=read(),current=q[item.id]||item,attempts=Number(current.attempts||0);
 if(attempts>=12){status(row,'Foto subida · pendiente de guardar. Se reintentará al volver a abrir el panel.','pending');return false}
 q[item.id]={...current,attempts:attempts+1,last_attempt:new Date().toISOString()};write(q);
 status(row,'Guardando foto de forma segura…','busy');
 try{
   await call('save_presentation_image',{presentation_id:item.id,image_url:item.image_url,image_path:item.image_path});
   if(!(await verify(item)))throw new Error('verification_failed');
   forget(item.id);
   if(row){row.dataset.v77PendingImage='0';row.dataset.v10ImageUrl=item.image_url;row.dataset.v10ImagePath=item.image_path}
   status(row,'Foto guardada y verificada · no se perderá al actualizar','saved');
   return true;
 }catch(err){
   console.error('photo persistence guard',err);
   status(row,'Foto subida · guardado pendiente. Reintentaremos automáticamente.','pending');
   return false;
 }
}
async function flush(){
 if(busy||!navigator.onLine||!token())return;busy=true;
 try{for(const item of Object.values(read()))await persist(item,$(`#v5PresentationRows .v5-presentation-row[data-id="${CSS.escape(String(item.id))}"]`))}finally{busy=false}
}
async function captureEventually(row){
 const started=Date.now();
 while(Date.now()-started<45000){
   const item=itemFromRow(row);
   if(item){row.dataset.v10ImageUrl=item.image_url;row.dataset.v10ImagePath=item.image_path;remember(item);await persist(item,row);return}
   await new Promise(r=>setTimeout(r,280));
 }
 status(row,'No pudimos confirmar el guardado de la foto · vuelve a intentarlo','pending');
}
document.addEventListener('change',e=>{const input=e.target;if(!(input instanceof HTMLInputElement)||input.type!=='file'||!input.closest('.v77-presentation-image'))return;const row=input.closest('.v5-presentation-row');if(row)setTimeout(()=>captureEventually(row),40)},true);
const scan=()=>{$$('#v5PresentationRows .v5-presentation-row[data-v77-pending-image="1"]').forEach(row=>{const item=itemFromRow(row);if(item){row.dataset.v10ImageUrl=item.image_url;row.dataset.v10ImagePath=item.image_path;remember(item)}});flush()};
window.addEventListener('online',scan);window.addEventListener('focus',()=>setTimeout(scan,120));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(scan,120)});
document.addEventListener('click',e=>{if(e.target.closest?.('#productModal,[data-edit-product]'))setTimeout(scan,400)},true);
setInterval(()=>{if(document.visibilityState==='visible')flush()},12000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(scan,300),{once:true});else setTimeout(scan,300);
})();