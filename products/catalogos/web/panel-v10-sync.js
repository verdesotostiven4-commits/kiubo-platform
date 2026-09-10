(()=>{
'use strict';
if(window.__kiuboPanelPresentationSyncV10)return;window.__kiuboPanelPresentationSyncV10=true;
if(/^\/master(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
const pathFromUrl=url=>{try{const u=new URL(url,location.href),mark='/storage/v1/object/public/catalog-assets-v4/';const i=u.pathname.indexOf(mark);return i>=0?decodeURIComponent(u.pathname.slice(i+mark.length)):''}catch{return''}};
async function save(row){
  if(!row||row.dataset.v77PendingImage!=='1'||row.dataset.v10ImageSync==='busy')return;
  const id=String(row.dataset.id||''),session=token();const img=$('.v77-presentation-preview img',row);const imageUrl=img?.src||'';const imagePath=pathFromUrl(imageUrl);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!imageUrl||!imagePath||!session)return;
  row.dataset.v10ImageSync='busy';
  try{
    const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version||'10.2.0','X-Provider-Session':session},body:JSON.stringify({action:'save_presentation_image',slug,presentation_id:id,image_url:imageUrl,image_path:imagePath})});
    const b=await r.json().catch(()=>({}));if(!r.ok||!b?.ok)throw new Error(b?.error||'sync_failed');
    row.dataset.v77PendingImage='0';row.dataset.v10ImageSync='done';row.dataset.v10ImageAttempts='0';
    const copy=$('.v77-presentation-image-copy small',row);if(copy)copy.textContent='Foto guardada para esta presentación';
  }catch(err){
    console.error('presentation image sync',err);
    const attempts=Math.min(3,Number(row.dataset.v10ImageAttempts||0)+1);row.dataset.v10ImageAttempts=String(attempts);row.dataset.v10ImageSync='error';
    if(attempts<3)setTimeout(()=>{if(row.dataset.v10ImageSync==='error'){delete row.dataset.v10ImageSync;save(row)}},900*attempts);
    else{const copy=$('.v77-presentation-image-copy small',row);if(copy)copy.textContent='Foto pendiente de sincronizar · vuelve a intentar al estar en línea'}
  }
}
function scan(){$$('#v5PresentationRows .v5-presentation-row[data-v77-pending-image="1"]').forEach(row=>{if(row.dataset.v10ImageSync!=='error'||Number(row.dataset.v10ImageAttempts||0)<3)save(row)})}
const obs=new MutationObserver(scan);
function start(){const modal=$('#productModal')||document.body;obs.observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['data-v77-pending-image']});document.addEventListener('change',e=>{const row=e.target?.closest?.('.v5-presentation-row');if(row&&e.target?.closest?.('.v77-presentation-image')){row.dataset.v10ImageAttempts='0';delete row.dataset.v10ImageSync;setTimeout(scan,80)}},true);document.addEventListener('click',e=>{if(e.target?.closest?.('#productModal'))setTimeout(scan,50)},true);window.addEventListener('online',()=>{$$('#v5PresentationRows .v5-presentation-row[data-v77-pending-image="1"]').forEach(row=>{row.dataset.v10ImageAttempts='0';delete row.dataset.v10ImageSync});scan()});scan()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();