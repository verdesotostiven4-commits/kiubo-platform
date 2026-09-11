/* Hakuna Matata · verified brand assets + runtime ordering
   Real logos are used only when a verified public asset is available.
   Missing logos keep the clean text fallback from Catalog 10.3.
*/
(()=>{
'use strict';
const ASSETS=Object.freeze({
  'coca-cola':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Coca-Cola_logo.svg',
  'bubbaloo':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Bubbaloo_logo.svg',
  'cheetos':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Cheetos_logo.svg',
  'sprite':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Sprite_2026.svg',
  'fanta':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Fanta_2023.svg',
  'gatorade':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Gatorade_2025.svg',
  'nestle':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Nestl%C3%A9_textlogo.svg',
  'oreo':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Oreo_Logo_2014.svg',
  'dasani':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Dasani_Logo.svg',
  'fuze-tea':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Fuze-tea-logo.svg',
  'chips-ahoy':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Chips_ahoy_brandlogo.png',
  'tostitos':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Tostitos_2026.svg',
  'ruffles':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Ruffles_2021.svg',
  'kinder-joy':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Kinder_Joy_logo.svg'
});
window.KIUBO_BRAND_ASSETS=ASSETS;

const PREFERRED=['Coca-Cola','Toni','Bubbaloo','Chiclets','Cheese Tris'];
const THEMES={
  'coca-cola':['#e5202b','#fff'],'toni':['#3157a2','#fff'],'bubbaloo':['#ff4d9c','#173f86'],
  'chiclets':['#ffd728','#111'],'cheese-tris':['#ff7a18','#114e9c'],'nestle':['#fff','#d5272c'],
  'chips-ahoy':['#eef8ff','#0b54a0'],'club-social':['#0d4c8e','#fff'],'chiki':['#ef2937','#ffe21c']
};
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ordered=[],signature='',observer=null,raf=0;

function visual(name){const k=key(name),url=ASSETS[k],theme=THEMES[k]||['#f4f6f2','#294a37'];return url?`<span class="hm-brand-visual has-image"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy" decoding="async"></span>`:`<span class="hm-brand-visual" style="--hm-brand-bg:${theme[0]};--hm-brand-fg:${theme[1]}"><b>${esc(name)}</b></span>`}
function brandButton(name){const b=document.createElement('button');b.type='button';b.dataset.brandChip=name;b.className='hm-brand-chip';b.setAttribute('aria-label',`Ver productos ${name}`);b.innerHTML=visual(name);return b}
function heroButton(name){const b=document.createElement('button');b.type='button';b.dataset.brandChip=name;b.className='hm-hero-brand';b.setAttribute('aria-label',`Ver productos ${name}`);b.innerHTML=visual(name);return b}

function patch(){raf=0;if(!ordered.length)return;const home=document.querySelector('#homeView .v10-home');if(!home)return;
  const rail=home.querySelector('.v10-brand-rail');
  if(rail&&rail.dataset.hmVerifiedBrands!==signature){rail.innerHTML='';for(const name of ordered.slice(0,5))rail.append(brandButton(name));const more=document.createElement('button');more.type='button';more.className='hm-brand-more';more.dataset.hmOpenBrands='1';more.innerHTML='<span>•••</span><b>Más</b>';rail.append(more);rail.dataset.hmRailReady='1';rail.dataset.hmVerifiedBrands=signature}
  const stack=home.querySelector('.hm-hero-brand-stack');
  if(stack&&stack.dataset.hmVerifiedBrands!==signature){stack.innerHTML='';for(const name of ordered.slice(0,3))stack.append(heroButton(name));stack.dataset.hmVerifiedBrands=signature}
}
function schedule(){if(raf)return;raf=requestAnimationFrame(patch)}
function observe(){if(observer)return;const target=document.querySelector('#homeView')||document.body;if(!target)return;observer=new MutationObserver(schedule);observer.observe(target,{childList:true,subtree:true});schedule()}

async function loadActualBrands(){const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
  try{const r=await fetch(C.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':C.version||'10.3.2'},body:JSON.stringify({action:'catalog_bootstrap',slug})});if(!r.ok)return;const payload=await r.json();const counts=new Map(),canonical=new Map();for(const p of Array.isArray(payload?.products)?payload.products:[]){const name=String(p?.brand||'').trim();if(!name)continue;const n=norm(name);canonical.set(n,canonical.get(n)||name);counts.set(n,(counts.get(n)||0)+1)}const preferred=PREFERRED.map(x=>canonical.get(norm(x))).filter(Boolean),used=new Set(preferred.map(norm));const rest=[...canonical.values()].filter(x=>!used.has(norm(x))).sort((a,b)=>(counts.get(norm(b))||0)-(counts.get(norm(a))||0)||a.localeCompare(b,'es'));ordered=[...preferred,...rest];signature=ordered.map(norm).join('|');observe();schedule()}catch(err){console.warn('brand registry bootstrap',err)}}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadActualBrands,{once:true});else loadActualBrands();
})();
