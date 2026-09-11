(()=>{
'use strict';
if(window.__kiuboPanelPresentationSyncV10)return;window.__kiuboPanelPresentationSyncV10=true;
if(/^\/master(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const VERSION='10.3.2';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const QUEUE_KEY=`kiubo-v10-presentation-image-queue:${slug}`;
const MAX_ATTEMPTS=6,BASE_RETRY_MS=1400;
const token=()=>sessionStorage.getItem(`kiubo-provider-session:${slug}`)||'';
const attempts=new Map(),retryTimers=new Map();let flushing=false;
const pathFromUrl=url=>{try{const u=new URL(url,location.href),mark='/storage/v1/object/public/catalog-assets-v4/';const i=u.pathname.indexOf(mark);return i>=0?decodeURIComponent(u.pathname.slice(i+mark.length)):''}catch{return''}};
const readQueue=()=>{try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'{}');return q&&typeof q==='object'&&!Array.isArray(q)?q:{}}catch{return{}}};
const writeQueue=q=>{try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q))}catch{}};
function remember(item){if(!item?.id||!item.image_url||!item.image_path)return;const q=readQueue();q[item.id]={...item,queued_at:item.queued_at||new Date().toISOString()};writeQueue(q)}
function forget(id){const q=readQueue();if(q[id]){delete q[id];writeQueue(q)}attempts.delete(id);const timer=retryTimers.get(id);if(timer)clearTimeout(timer);retryTimers.delete(id)}
function rowFor(id){return $(`#v5PresentationRows .v5-presentation-row[data-id="${CSS.escape(String(id))}"]`)}
function rowItem(row){const id=String(row?.dataset?.id||''),img=$('.v77-presentation-preview img',row),imageUrl=img?.src||'',imagePath=pathFromUrl(imageUrl);if(!/^[0-9a-f-]{36}$/i.test(id)||!imageUrl||!imagePath)return null;return{id,image_url:imageUrl,image_path:imagePath}}
function setCopy(row,text){const copy=$('.v77-presentation-image-copy small',row);if(copy)copy.textContent=text}
function repairLegacyToast(){const list=$$('.v77-panel-toast');const toast=list[list.length-1];if(toast&&/guarda el producto/i.test(toast.textContent||''))toast.textContent='Foto guardada automáticamente para esta presentación'}
function markBusy(row){if(!row)return;row.dataset.v10ImageSync='busy';row.setAttribute('aria-busy','true');setCopy(row,'Sincronizando foto…')}
function markSaved(row){if(!row)return;row.dataset.v77PendingImage='0';row.dataset.v10ImageSync='done';row.removeAttribute('aria-busy');delete row.dataset.v10ImageAttempts;setCopy(row,'Foto guardada automáticamente para esta presentación');repairLegacyToast()}
function markPending(row,text='Foto pendiente de sincronizar · se reintentará automáticamente'){if(!row)return;row.dataset.v10ImageSync='error';row.removeAttribute('aria-busy');setCopy(row,text)}
async function post(item){const session=token();if(!session)throw new Error('session_missing');const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version||VERSION,'X-Provider-Session':session},body:JSON.stringify({action:'save_presentation_image',slug,presentation_id:item.id,image_url:item.image_url,image_path:item.image_path})});const b=await r.json().catch(()=>({}));if(!r.ok||!b?.ok)throw new Error(b?.error||`sync_failed_${r.status}`);return{ok:true}}
function scheduleRetry(id){if(!id||retryTimers.has(id))return;const n=attempts.get(id)||0;if(n>=MAX_ATTEMPTS)return;const delay=Math.min(30000,BASE_RETRY_MS*Math.pow(2,Math.max(0,n-1)));const timer=setTimeout(()=>{retryTimers.delete(id);const item=readQueue()[id];if(item)syncItem(item,rowFor(id))},delay);retryTimers.set(id,timer)}
async function syncItem(item,row=null){if(!item?.id||!token()||!navigator.onLine)return false;const current=attempts.get(item.id)||0;if(current>=MAX_ATTEMPTS){markPending(row||rowFor(item.id),'Foto pendiente · se volverá a intentar al reconectar o abrir el panel');return false}row=row||rowFor(item.id);if(row?.dataset.v10ImageSync==='busy')return false;markBusy(row);attempts.set(item.id,current+1);if(row)row.dataset.v10ImageAttempts=String(current+1);try{await post(item);forget(item.id);markSaved(row||rowFor(item.id));return true}catch(err){console.error('presentation image sync',err);markPending(row||rowFor(item.id));scheduleRetry(item.id);return false}}
async function flushQueue(){if(flushing||!token()||!navigator.onLine)return;flushing=true;try{const q=readQueue();for(const item of Object.values(q)){if(!item?.id)continue;await syncItem(item)}}finally{flushing=false}}
function captureRow(row){if(!row||row.dataset.v77PendingImage!=='1')return;const item=rowItem(row);if(!item)return;remember(item);syncItem(item,row)}
function scan(){$$('#v5PresentationRows .v5-presentation-row[data-v77-pending-image="1"]').forEach(captureRow);flushQueue()}
const obs=new MutationObserver(scan);
function resetAttemptsAndFlush(){attempts.clear();retryTimers.forEach(t=>clearTimeout(t));retryTimers.clear();$$('#v5PresentationRows .v5-presentation-row[data-v77-pending-image="1"]').forEach(row=>{delete row.dataset.v10ImageSync;delete row.dataset.v10ImageAttempts;row.removeAttribute('aria-busy')});scan()}
function start(){const modal=$('#productModal')||document.body;obs.observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['data-v77-pending-image','src']});document.addEventListener('change',e=>{const row=e.target?.closest?.('.v5-presentation-row');if(row&&e.target?.closest?.('.v77-presentation-image')){attempts.delete(String(row.dataset.id||''));delete row.dataset.v10ImageSync;setTimeout(scan,120)}},true);document.addEventListener('click',e=>{if(e.target?.closest?.('#productModal'))setTimeout(scan,60)},true);window.addEventListener('online',resetAttemptsAndFlush);window.addEventListener('focus',()=>setTimeout(resetAttemptsAndFlush,80));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resetAttemptsAndFlush()});setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)flushQueue()},15000);setTimeout(scan,80);setTimeout(scan,500);setTimeout(scan,1600)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();