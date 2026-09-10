(()=>{
'use strict';
if(window.__hakunaCatalog783)return;window.__hakunaCatalog783=true;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const META_RE=/\s*\[\[KIUBO_PI:([A-Za-z0-9_-]+)\]\]\s*$/;
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let data=null,promise=null,raf=0;
function b64d(s){try{const v=String(s||''),raw=atob(v.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((v.length+3)%4)),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return{}}}
function parsedDescription(value=''){const src=String(value||''),m=src.match(META_RE);return{text:(m?src.slice(0,m.index):src).trim(),images:m?b64d(m[1]):{}}}
async function boot(force=false){if(data&&!force)return data;if(promise&&!force)return promise;promise=fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version||'7.8.3'},body:JSON.stringify({action:'catalog_bootstrap',slug})}).then(async r=>{const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'bootstrap_failed');data=b;return b}).finally(()=>promise=null);return promise}
function products(){return(data?.products||[]).filter(p=>p.visible!==false&&!p.archived_at)}
function productByName(name){return products().find(p=>norm(p.name)===norm(name))||null}
function presentations(pid){return(data?.presentations||[]).filter(p=>String(p.product_id)===String(pid)&&p.visible!==false)}
function metaMap(product){return parsedDescription(product?.description||'').images||{}}
function metaFor(product,presentation){if(!product||!presentation)return null;const map=metaMap(product),id=String(presentation.id||'');if(id&&map[id])return map[id];return Object.values(map).find(x=>norm(x?.n)===norm(presentation.name)&&Number(x?.c||1)===Number(presentation.units_per_presentation||1))||null}
function imageFor(product,presentation){return presentation?.image_url||metaFor(product,presentation)?.u||product?.image_url||''}
function presentationForButton(product,button){if(!product||!button)return null;const id=String(button.dataset.presentation||'');const byId=presentations(product.id).find(p=>String(p.id)===id);if(byId)return byId;const name=$('b',button)?.textContent||'';return presentations(product.id).find(p=>norm(p.name)===norm(name))||null}
function presentationByName(product,name){return presentations(product?.id).find(p=>norm(p.name)===norm(name))||null}
function decorateDetail(){if(!data)return;const sheet=$('.v7-sheet .v7-detail');if(!sheet)return;const title=$('.v7-detail-body h2',sheet)?.textContent||'',product=productByName(title);if(!product)return;const parsed=parsedDescription(product.description||''),desc=$('.v7-detail-body>p',sheet);if(desc){if(parsed.text)desc.textContent=parsed.text;else desc.remove()}
  const buttons=$$('.v7-presentation-list [data-presentation]',sheet);for(const btn of buttons){const pr=presentationForButton(product,btn),src=imageFor(product,pr);let thumb=$('.v783-presentation-thumb',btn);if(!thumb){thumb=document.createElement('span');thumb.className='v783-presentation-thumb';btn.prepend(thumb)}const wanted=src||product.image_url||'';if(wanted){let img=$('img',thumb);if(!img){thumb.innerHTML='<img alt="">';img=$('img',thumb)}if(img.getAttribute('src')!==wanted)img.setAttribute('src',wanted)}else thumb.innerHTML='<span>•</span>'}
  const active=$('.v7-presentation-list [data-presentation].active',sheet)||buttons[0],pr=presentationForButton(product,active),src=imageFor(product,pr),hero=$('.v7-detail-media>img',sheet);if(hero&&src&&hero.getAttribute('src')!==src)hero.setAttribute('src',src);hero?.classList.add('v783-product-contain')
}
function decorateCart(){if(!data)return;$$('#cartView .v7-cart-line').forEach(line=>{const product=productByName($('h3',line)?.textContent||'');if(!product)return;const pr=presentationByName(product,$('p',line)?.textContent||''),src=imageFor(product,pr),box=$('.v7-cart-photo',line);if(!box||!src)return;let img=$('img',box);if(!img){box.innerHTML='<img alt="">';img=$('img',box)}if(img.getAttribute('src')!==src)img.setAttribute('src',src);img.classList.add('v783-product-contain')})}
function hideMetadata(){if(!data)return;$$('.v7-detail-body>p').forEach(p=>{if(!/\[\[KIUBO_PI:/.test(p.textContent||''))return;const clean=parsedDescription(p.textContent||'').text;if(clean)p.textContent=clean;else p.remove()})}
function decorate(){raf=0;hideMetadata();decorateDetail();decorateCart()}
function schedule(){if(raf)return;raf=requestAnimationFrame(decorate)}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-presentation],[data-open],[data-add],[data-view="cart"],[data-cart-plus],[data-cart-minus]'))setTimeout(schedule,0)},true);
const observer=new MutationObserver(()=>schedule());
function start(){observer.observe(document.body,{childList:true,subtree:true});boot().then(schedule).catch(()=>{});schedule()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
