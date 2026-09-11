/* Hakuna Matata Catalog 10.4.1 — stability + mobile UX consolidation. */
(()=>{
'use strict';
if(window.__hakunaCatalog1041)return;window.__hakunaCatalog1041=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const C=window.KIUBO_CATALOG_CONFIG||{};
const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'');
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assets=window.KIUBO_BRAND_ASSETS||{};
const preferred=['Coca-Cola','Bubbaloo','Chiclets','Cheese Tris','Cheetos','Chips Ahoy!','Dasani','Fanta','Sprite','Gatorade','Oreo','Ruffles','Tostitos','Club Social','Chiki','Halls','Trident','Pony Malta','Manicho'];
const themes={'coca-cola':['#fff','#d91f2b'],'bubbaloo':['#fff','#174b91'],'chiclets':['#ffd72a','#171717'],'cheese-tris':['#ff7a18','#174d92'],'club-social':['#0d4c8e','#fff'],'chiki':['#ef2937','#ffe21c']};
const read=(k,f)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}};
const bootstrap=()=>read(`kiubo-v10-bootstrap:${slug}`,{});
function allBrands(){
 const p=Array.isArray(bootstrap()?.products)?bootstrap().products:[];
 const raw=[...new Set(p.filter(x=>x&&x.visible!==false&&!x.archived_at).map(x=>String(x.brand||'').trim()).filter(Boolean))];
 return raw.sort((a,b)=>{const ai=preferred.findIndex(x=>norm(x)===norm(a)),bi=preferred.findIndex(x=>norm(x)===norm(b));if(ai>=0||bi>=0)return (ai<0?999:ai)-(bi<0?999:bi);return a.localeCompare(b,'es')});
}
function brandVisual(name){
 const k=key(name),url=assets[k],t=themes[k]||['#f4f6f2','#294a37'];
 return url?`<span class="hm-brand-visual has-image"><img src="${esc(url)}" alt="${esc(name)}"></span>`:`<span class="hm-brand-visual" style="--hm-brand-bg:${t[0]};--hm-brand-fg:${t[1]}"><b>${esc(name)}</b></span>`;
}
function selectedBrand(){return norm($('#activeFilterHost .v10-active-filter b')?.textContent||'')}
function ensureCatalogBrands(){
 const shell=$('#catalogView .v10-catalog-head .v10-shell'),cats=shell&&$('.v10-category-rail',shell);if(!cats)return;
 const names=allBrands();if(!names.length)return;
 let rail=$('.hm-v104-catalog-brands',shell);if(!rail){rail=document.createElement('div');rail.className='hm-v104-catalog-brands';rail.setAttribute('aria-label','Marcas destacadas');cats.insertAdjacentElement('afterend',rail)}
 const shown=names.slice(0,8),signature=shown.map(norm).join('|');
 if(rail.dataset.signature!==signature){
   rail.dataset.signature=signature;
   rail.innerHTML=`<button type="button" class="hm-v1041-all" data-brand-chip="" aria-label="Ver todos los productos"><span>Todos</span></button>`+
   shown.map(name=>`<button type="button" data-brand-chip="${esc(name)}" aria-label="Ver ${esc(name)}">${brandVisual(name)}</button>`).join('')+
   `<button type="button" class="hm-v104-more" data-hm-open-brands="1"><span>•••</span>Ver todas</button>`;
 }
 const active=selectedBrand();
 $$('[data-brand-chip]',rail).forEach(btn=>btn.classList.toggle('active',active?norm(btn.dataset.brandChip)===active:btn.dataset.brandChip===''));
}
const catHelp={bebidas:'Gaseosas, jugos y más',snacks:'Papas, chifles y confites',galletas:'Dulces y saladas',lacteos:'Leches y derivados',golosinas:'Dulces y confites'};
function polishHome(){
 const home=$('#homeView .v10-home');if(!home)return;
 const brand=$('.hm-brand-block',home);if(brand){const s=$('.v10-heading small',brand);if(s)s.textContent='NUESTRAS MARCAS'}
 const blocks=$$('.v10-block',home),cats=blocks.find(b=>$('.v10-categories',b)),featured=blocks.find(b=>$('#featuredStrip',b));
 if(cats){const s=$('.v10-heading small',cats);if(s)s.textContent='EXPLORA POR CATEGORÍA';$$('.v10-categories [data-category-jump]',cats).forEach(btn=>{if($('.hm1041-cat-copy',btn))return;const b=$('b',btn);if(!b)return;const name=b.textContent.trim(),n=norm(name);const sub=catHelp[n]||'Encuentra más productos';const wrap=document.createElement('div');wrap.className='hm1041-cat-copy';wrap.innerHTML=`<b>${esc(name)}</b><small>${esc(sub)}</small>`;b.replaceWith(wrap)})}
 if(featured){const s=$('.v10-heading small',featured);if(s)s.textContent='PRODUCTOS DESTACADOS';const action=$('.v10-heading>button',featured);if(action)action.innerHTML='Ver catálogo <span aria-hidden="true">›</span>'}
 stabilizeFeatured();
 repairHeroMedia();
}
function stabilizeFeatured(){
 const strip=$('#featuredStrip');if(!strip||strip.dataset.hm1041Ready)return;
 const real=[...strip.children].filter(el=>!el.hasAttribute('data-carousel-clone'));if(!real.length)return;
 const next=strip.cloneNode(false);next.id='featuredStrip';next.dataset.hm1041Ready='1';real.forEach(card=>next.append(card.cloneNode(true)));strip.replaceWith(next);
 let pauseUntil=0,autoTimer=0;
 const pause=(ms=9000)=>{pauseUntil=Date.now()+ms};
 ['pointerdown','touchstart','wheel'].forEach(ev=>next.addEventListener(ev,()=>pause(),{passive:true}));
 const advance=()=>{if(!next.isConnected){clearInterval(autoTimer);return}if(document.hidden||Date.now()<pauseUntil||next.matches(':hover'))return;const cards=[...next.children];if(cards.length<2)return;const step=cards[1].offsetLeft-cards[0].offsetLeft;if(step<=0)return;const max=Math.max(0,next.scrollWidth-next.clientWidth),target=next.scrollLeft+step;next.scrollTo({left:target>max-4?0:target,behavior:'smooth'})};
 autoTimer=setInterval(advance,4800);
}
function repairHeroMedia(){
 const pile=$('#homeView .hm-slide-main .hm-product-pile');if(!pile)return;
 const current=$$('img',pile).filter(i=>i.src);if(current.length>=2)return;
 const cards=$$('#featuredStrip .v10-product').slice(0,3);if(!cards.length)return;
 pile.innerHTML=cards.map((card,i)=>{const img=$('.v10-product-media img',card),title=$('.v10-product-title h3',card),id=card.dataset.product||'';if(!img)return'';return `<button type="button" class="hm-pile-card p${i+1}" ${id?`data-open="${esc(id)}"`:''}><img src="${esc(img.src)}" alt="${esc(title?.textContent||'Producto')}"><small>${esc(title?.textContent||'Producto')}</small></button>`}).join('');
}
function polishOrders(){
 const view=$('#ordersView');if(!view)return;
 const empty=$('.v10-empty.big',view);if(!empty)return;
 empty.classList.add('hm1041-order-empty');
 let art=$('.hm-empty-art',empty);if(!art){art=document.createElement('div');art.className='hm-empty-art';empty.prepend(art)}
 if(!art.dataset.hm1041){art.dataset.hm1041='1';art.innerHTML='<svg viewBox="0 0 160 160" aria-hidden="true"><path d="M42 54 80 34l38 20v52L80 126l-38-20V54Z"/><path d="m43 55 37 20 37-20M80 75v50M62 45l38 20"/><path d="m104 92 9 9 18-21"/></svg>'}
 const b=$('b',empty),span=$('span',empty),btn=$('button',empty);if(b)b.textContent='Aún no tienes pedidos';if(span)span.textContent='Cuando confirmes un pedido, podrás seguirlo desde aquí.';if(btn)btn.textContent='Explorar catálogo';
}
let lastY=window.scrollY,scrollTick=0;
function catalogScrollBehavior(){
 if(scrollTick)return;scrollTick=requestAnimationFrame(()=>{scrollTick=0;const head=$('#catalogView .v10-catalog-head');if(!head)return;const active=$('#catalogView')?.classList.contains('active');if(!active){head.classList.remove('hm-v1041-hidden');lastY=window.scrollY;return}
 const y=window.scrollY,dy=y-lastY,focus=head.contains(document.activeElement),sheet=$('#sheetHost .v10-sheet.show');
 if(y<140||dy<-5||focus||sheet)head.classList.remove('hm-v1041-hidden');else if(dy>7&&y>190)head.classList.add('hm-v1041-hidden');
 lastY=y;
 })}
function hardenImages(){$$('img').forEach(img=>{if(img.dataset.hm1041)return;img.dataset.hm1041='1';img.draggable=false;img.addEventListener('error',()=>{const visual=img.closest('.hm-brand-visual');if(visual){visual.classList.remove('has-image');visual.classList.add('image-failed')}},{once:true})})}
function enhance(){polishHome();ensureCatalogBrands();polishOrders();hardenImages();document.documentElement.dataset.hmCatalog='10.4.1'}
let raf=0;const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest?.('[data-brand-chip],#clearBrand,#resetCatalog,[data-view]'))setTimeout(schedule,0)},true);
window.addEventListener('scroll',catalogScrollBehavior,{passive:true});window.addEventListener('pageshow',schedule);window.addEventListener('popstate',schedule);
})();