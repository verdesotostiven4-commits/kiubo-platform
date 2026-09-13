/* Hakuna Matata 10.10.8 — background image prewarm/decode. Visual only; no catalog routing changes. */
(()=>{
'use strict';
if(window.__hakunaCatalog10108)return;window.__hakunaCatalog10108=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const HERO_IMAGES=[
  'https://blogger.googleusercontent.com/img/a/AVvXsEi0hDelNFtHhwoe6guvslOKkEqE0a4o3qVn_Mnut7m2IPdXwfoGDifE1S5QksIbMEDzm_LFESZjvksQ3JEKR_i5iFIYzTkCryXadiPRtu7R9w00ZOtqLTFnDZEUdStZX1IyEbuPqy4CR8QCVlqrVoMEl2Q7FqCzkreaLh26NUkdZJ-TCRQbrvooScWcthA',
  'https://blogger.googleusercontent.com/img/a/AVvXsEi3HryNfbEOSl5KpAX1VsCus8Q_o3YRxcfb-_BSAsd-yPGyY_KRxIFyM-HnIaEWrEY7BImj7Dio2dze84LecAO2aBYxTXEUimky3GtqS3ln_dbsOtNAXtwAEMLKiut-zoN7P-7D_oov6-AFg42_Uwzg_dBKwd9IE7AhhTJZHTJoQHQxacyy6OWCchoiBog',
  'https://blogger.googleusercontent.com/img/a/AVvXsEjwNc7uz385CAxTzuZEaQSMdo-TBctEwPRxDSRk-bcYjgiNqu_Sol5tiTHaWaa1-zh6GQ9KHR-D-VNEEKU9zkcONv_7K_68wWIDEkoJxCEtclhN1bBBo4fUX16ZE7o-yCLcxDBhs3cikH8Tbf_oVXwfdJcX1b3gtPbgeypeW85otTQ3dj6bqrAK1ETvzkQ'
];
const DEFAULT_LOGO='https://cdn.phototourl.com/free/2026-09-09-81972c89-9fb3-4bb7-ad34-74c1fe90aca9.jpg';
const seen=new Set(),queue=[],live=new Set();
let active=0;
const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
const concurrency=connection?.saveData?2:/2g/.test(String(connection?.effectiveType||''))?2:5;

function validUrl(v){return typeof v==='string'&&/^https?:\/\//i.test(v.trim())}
function enqueue(url,priority='low',front=false){
  url=String(url||'').trim();
  if(!validUrl(url)||seen.has(url))return;
  seen.add(url);
  const item={url,priority};
  front?queue.unshift(item):queue.push(item);
  pump();
}
function finish(img){
  live.delete(img);
  active=Math.max(0,active-1);
  pump();
}
function pump(){
  while(active<concurrency&&queue.length){
    const {url,priority}=queue.shift();
    active++;
    const img=new Image();
    live.add(img);
    img.decoding='async';
    try{img.fetchPriority=priority}catch{}
    const done=()=>{
      if(typeof img.decode==='function')Promise.resolve(img.decode()).catch(()=>{}).finally(()=>finish(img));
      else finish(img);
    };
    img.onload=done;
    img.onerror=()=>finish(img);
    img.src=url;
  }
}

function decodeMetaImages(description=''){
  try{
    const m=String(description||'').match(/\[\[KIUBO_PI:([A-Za-z0-9_-]+)\]\]\s*$/);
    if(!m)return[];
    let s=m[1].replace(/-/g,'+').replace(/_/g,'/');
    s+='='.repeat((4-s.length%4)%4);
    const raw=atob(s),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const obj=JSON.parse(new TextDecoder().decode(bytes));
    return Object.values(obj||{}).map(x=>x?.u).filter(validUrl);
  }catch{return[]}
}
function slug(){
  const C=window.KIUBO_CATALOG_CONFIG||{};
  return (new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
}
function cachedPayload(){
  try{return JSON.parse(localStorage.getItem(`kiubo-v10-bootstrap:${slug()}`)||'null')}catch{return null}
}
function warmPayload(payload){
  if(!payload||typeof payload!=='object')return;
  if(validUrl(payload.account?.logo_url))enqueue(payload.account.logo_url,'high',true);
  const urls=[];
  for(const product of Array.isArray(payload.products)?payload.products:[]){
    if(validUrl(product?.image_url))urls.push(product.image_url);
    urls.push(...decodeMetaImages(product?.description||''));
  }
  for(const presentation of Array.isArray(payload.presentations)?payload.presentations:[]){
    if(validUrl(presentation?.image_url))urls.push(presentation.image_url);
  }
  [...new Set(urls)].forEach((url,index)=>enqueue(url,index<24?'auto':'low',index<12));
}
function warmBrands(){
  const urls=Object.values(window.KIUBO_BRAND_ASSETS||{}).filter(validUrl);
  urls.slice(0,12).forEach(url=>enqueue(url,'auto'));
  urls.slice(12).forEach(url=>enqueue(url,'low'));
}

/* Start the images needed on Home before the catalog runtime finishes mounting. */
enqueue(HERO_IMAGES[0],'high',true);
enqueue(DEFAULT_LOGO,'high',true);
HERO_IMAGES.slice(1).forEach(url=>enqueue(url,'auto'));
warmPayload(cachedPayload());
setTimeout(warmBrands,0);

/* First visit: catalog-v10.2 writes bootstrap to localStorage after the API responds. Poll briefly and warm it immediately. */
let ticks=0,lastStamp=-1;
const poll=setInterval(()=>{
  ticks++;
  warmBrands();
  const payload=cachedPayload(),stamp=Number(payload?.cached_at||0);
  if(payload&&(stamp!==lastStamp||ticks<=3)){
    lastStamp=stamp;
    warmPayload(payload);
  }
  if(ticks>=36)clearInterval(poll);
},350);

/* A cache miss should fade in from a neutral surface rather than flash white. */
function markImage(img){
  if(!(img instanceof HTMLImageElement)||img.dataset.hm10108Visual==='1'||!img.getAttribute('src'))return;
  img.dataset.hm10108Visual='1';
  const ready=()=>{
    img.classList.remove('hm10108-img-pending');
    img.classList.add('hm10108-img-ready');
  };
  const decoded=()=>typeof img.decode==='function'?Promise.resolve(img.decode()).catch(()=>{}).finally(ready):ready();
  if(img.complete&&img.naturalWidth){decoded();return}
  img.classList.add('hm10108-img-pending');
  img.addEventListener('load',decoded,{once:true});
  img.addEventListener('error',ready,{once:true});
}
function scan(node=document){
  if(node instanceof HTMLImageElement)markImage(node);
  if(node?.querySelectorAll)node.querySelectorAll('img').forEach(markImage);
}
function startObserver(){
  scan();
  new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)scan(node);
  }).observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});else startObserver();
window.addEventListener('pageshow',()=>{warmPayload(cachedPayload());warmBrands();scan()});
})();
