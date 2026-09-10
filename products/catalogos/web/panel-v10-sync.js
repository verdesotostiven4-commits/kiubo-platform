(()=>{
'use strict';
if(window.__kiuboPanelPresentationSyncV10)return;window.__kiuboPanelPresentationSyncV10=true;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
const pathFromUrl=url=>{try{const u=new URL(url,location.href),mark='/storage/v1/object/public/catalog-assets-v4/';const i=u.pathname.indexOf(mark);return i>=0?decodeURIComponent(u.pathname.slice(i+mark.length)):''}catch{return''}};
async function save(row){
  if(!row||row.dataset.v77PendingImage!=='1'||row.dataset.v10ImageSync==='busy')return;
  const id=String(row.dataset.id||'');const img=$('.v77-presentation-preview img',row);const imageUrl=img?.src||'';const imagePath=pathFromUrl(imageUrl);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!imageUrl||!imagePath)return;
  row.dataset.v10ImageSync='busy';
  try{
    const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version||'10.1.0','X-Provider-Session':token()},body:JSON.stringify({action:'save_presentation_image',slug,presentation_id:id,image_url:imageUrl,image_path:imagePath})});
    const b=await r.json().catch(()=>({}));if(!r.ok||!b?.ok)throw new Error(b?.error||'sync_failed');
    row.dataset.v77PendingImage='0';row.dataset.v10ImageSync='done';
    const copy=$('.v77-presentation-image-copy small',row);if(copy)copy.textContent='Foto guardada para esta presentación';
  }catch(err){console.error('presentation image sync',err);row.dataset.v10ImageSync='error';setTimeout(()=>{if(row.dataset.v10ImageSync==='error'){delete row.dataset.v10ImageSync;save(row)}},1400)}
}
function scan(){$$('#v5PresentationRows .v5-presentation-row[data-v77-pending-image="1"]').forEach(save)}
const obs=new MutationObserver(scan);
function start(){const modal=$('#productModal')||document.body;obs.observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['data-v77-pending-image']});document.addEventListener('change',e=>{if(e.target?.closest?.('.v77-presentation-image'))setTimeout(scan,80)},true);document.addEventListener('click',e=>{if(e.target?.closest?.('#productModal'))setTimeout(scan,50)},true);scan()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
