/* Hakuna Matata Catalog 10.4.1 — compatibility polish; 10.4.2 owns rails/scroll/marquee. */
(()=>{
'use strict';
if(window.__hakunaCatalog1041)return;window.__hakunaCatalog1041=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catHelp={bebidas:'Gaseosas, jugos y más',snacks:'Papas, chifles y confites',galletas:'Dulces y saladas',lacteos:'Leches y derivados',golosinas:'Dulces y confites'};
function polishHome(){
 const home=$('#homeView .v10-home');if(!home)return;
 const brand=$('.hm-brand-block',home);if(brand){const s=$('.v10-heading small',brand);if(s)s.textContent='NUESTRAS MARCAS'}
 const blocks=$$('.v10-block',home),cats=blocks.find(b=>$('.v10-categories',b)),featured=blocks.find(b=>$('#featuredStrip',b));
 if(cats){const s=$('.v10-heading small',cats);if(s)s.textContent='EXPLORA POR CATEGORÍA';$$('.v10-categories [data-category-jump]',cats).forEach(btn=>{if($('.hm1041-cat-copy',btn))return;const b=$('b',btn);if(!b)return;const name=b.textContent.trim(),n=norm(name),sub=catHelp[n]||'Encuentra más productos',wrap=document.createElement('div');wrap.className='hm1041-cat-copy';wrap.innerHTML=`<b>${esc(name)}</b><small>${esc(sub)}</small>`;b.replaceWith(wrap)})}
 if(featured){const s=$('.v10-heading small',featured);if(s)s.textContent='PRODUCTOS DESTACADOS';const action=$('.v10-heading>button',featured);if(action)action.innerHTML='Ver catálogo <span aria-hidden="true">›</span>'}
 repairHeroMedia();
}
function repairHeroMedia(){
 const pile=$('#homeView .hm-slide-main .hm-product-pile');if(!pile)return;
 const current=$$('img',pile).filter(i=>i.src);if(current.length>=2)return;
 const cards=$$('#featuredStrip .v10-product:not([data-carousel-clone])').slice(0,3);if(!cards.length)return;
 pile.innerHTML=cards.map((card,i)=>{const img=$('.v10-product-media img',card),title=$('.v10-product-title h3',card),id=card.dataset.product||'';if(!img)return'';return `<button type="button" class="hm-pile-card p${i+1}" ${id?`data-open="${esc(id)}"`:''}><img src="${esc(img.src)}" alt="${esc(title?.textContent||'Producto')}"><small>${esc(title?.textContent||'Producto')}</small></button>`}).join('');
}
function polishOrders(){
 const view=$('#ordersView');if(!view)return;const empty=$('.v10-empty.big',view);if(!empty)return;empty.classList.add('hm1041-order-empty');
 let art=$('.hm-empty-art',empty);if(!art){art=document.createElement('div');art.className='hm-empty-art';empty.prepend(art)}
 if(!art.dataset.hm1041){art.dataset.hm1041='1';art.innerHTML='<svg viewBox="0 0 160 160" aria-hidden="true"><path d="M42 54 80 34l38 20v52L80 126l-38-20V54Z"/><path d="m43 55 37 20 37-20M80 75v50M62 45l38 20"/><path d="m104 92 9 9 18-21"/></svg>'}
 const b=$('b',empty),span=$('span',empty),btn=$('button',empty);if(b)b.textContent='Aún no tienes pedidos';if(span)span.textContent='Cuando confirmes un pedido, podrás seguirlo desde aquí.';if(btn)btn.textContent='Explorar catálogo';
}
function hardenImages(){$$('img').forEach(img=>{if(img.dataset.hm1041)return;img.dataset.hm1041='1';img.draggable=false;img.addEventListener('error',()=>{const visual=img.closest('.hm-brand-visual');if(visual){visual.classList.remove('has-image');visual.classList.add('image-failed')}},{once:true})})}
function enhance(){polishHome();polishOrders();hardenImages();document.documentElement.dataset.hmCatalog='10.4.1'}
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('click',schedule,true);window.addEventListener('pageshow',schedule);window.addEventListener('popstate',schedule);
})();
