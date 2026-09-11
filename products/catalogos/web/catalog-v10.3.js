/* Hakuna Matata Catalog 10.3 — presentation layer on top of the stable Catalog 10.2 runtime.
   Keeps cart/search/order logic owned by 10.2 and upgrades the customer-facing UX only. */

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const brandKey=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const BRAND_ASSETS=window.KIUBO_BRAND_ASSETS||{};
const preferredBrands=['Coca-Cola','Toni','Bubbaloo','Chiclets','Cheese Tris'];
const brandThemes={
  'coca-cola':['#e5202b','#fff'],
  'toni':['#3157a2','#fff'],
  'bubbaloo':['#ff4d9c','#173f86'],
  'chiclets':['#ffd728','#111'],
  'cheese-tris':['#ff7a18','#114e9c'],
  'nestle':['#fff','#d5272c'],
  'chips-ahoy':['#eef8ff','#0b54a0'],
  'club-social':['#0d4c8e','#fff'],
  'chiki':['#ef2937','#ffe21c']
};

const icons={
 bottle:'<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v4l-3 4v9h10v-9l-3-4V3M8 12h8"/></svg>',
 bag:'<svg viewBox="0 0 24 24"><path d="M7 3h10l1 18H6L7 3Zm1 4h8M9 12h6M9 16h6"/></svg>',
 cookie:'<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-8-8c0 2 2 4 4 4 0 2 2 4 4 4Z"/><circle cx="9" cy="9" r="1"/><circle cx="8" cy="15" r="1"/><circle cx="14" cy="14" r="1"/></svg>',
 milk:'<svg viewBox="0 0 24 24"><path d="M9 3h6v4l2 3v11H7V10l2-3V3Zm-1 9h8"/></svg>',
 candy:'<svg viewBox="0 0 24 24"><path d="m8 8 8 8M8 16l8-8M7 7 4-2 2 2 4-2 2 4-2 4 2 2-4 4-4-2-2 2-4-4 2-4-2-2 4-4Z"/></svg>',
 grid:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
 download:'<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14"/></svg>',
 receipt:'<svg viewBox="0 0 120 120"><path d="M38 19h44v75l-7-5-7 5-8-5-8 5-7-5-7 5V19Z"/><path d="M48 42h25M48 54h25M48 66h18"/><path d="M78 83h18l7-20H82"/><circle cx="84" cy="89" r="3"/><circle cx="98" cy="89" r="3"/></svg>',
 trash:'<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>'
};

function categoryIcon(name){const n=norm(name);if(n.includes('bebida'))return icons.bottle;if(n.includes('snack'))return icons.bag;if(n.includes('galleta'))return icons.cookie;if(n.includes('lact'))return icons.milk;if(n.includes('golos')||n.includes('confite')||n.includes('dulce'))return icons.candy;return icons.grid}
function brandLogo(name){const key=brandKey(name),url=BRAND_ASSETS[key],theme=brandThemes[key]||['#f4f6f2','#294a37'];if(url)return`<span class="hm-brand-visual has-image"><img src="${esc(url)}" alt="${esc(name)}"></span>`;return`<span class="hm-brand-visual" style="--hm-brand-bg:${theme[0]};--hm-brand-fg:${theme[1]}"><b>${esc(name)}</b></span>`}
function makeBrandButton(name){const btn=document.createElement('button');btn.type='button';btn.dataset.brandChip=name;btn.className='hm-brand-chip';btn.innerHTML=brandLogo(name);btn.setAttribute('aria-label',`Ver productos ${name}`);return btn}

function decorateBrandRail(home){const block=$('.v10-brand-block',home);if(!block)return;const hero=$('.v10-hero',home);if(hero&&block.nextElementSibling!==hero)home.insertBefore(block,hero);
  block.classList.add('hm-brand-block');const heading=$('.v10-heading',block);if(heading){const small=$('small',heading),h2=$('h2',heading),more=$('button',heading);if(small)small.textContent='NUESTRAS MARCAS';if(h2)h2.hidden=true;if(more)more.innerHTML='Ver todas <span aria-hidden="true">›</span>'}
  const rail=$('.v10-brand-rail',block);if(!rail||rail.dataset.hmRailReady)return;rail.dataset.hmRailReady='1';const existing=$$('[data-brand-chip]',rail).map(b=>b.dataset.brandChip).filter(Boolean),seen=new Set(),names=[];for(const name of [...preferredBrands,...existing]){const key=norm(name);if(!key||seen.has(key))continue;seen.add(key);names.push(name)}rail.innerHTML='';for(const name of names.slice(0,5))rail.append(makeBrandButton(name));const more=document.createElement('button');more.type='button';more.className='hm-brand-more';more.dataset.hmOpenBrands='1';more.innerHTML='<span>•••</span><b>Más</b>';rail.append(more)}

function heroProductData(hero){return $$('.v102-hero-products button',hero).map(b=>({id:b.dataset.open||'',name:b.getAttribute('aria-label')?.replace(/^Abrir\s+/,'')||$('span',b)?.textContent||'',img:$('img',b)?.src||''})).filter(x=>x.img).slice(0,3)}
function heroCategoryData(home){return $$('.v10-categories [data-category-jump]',home).slice(0,3).map(b=>({id:b.dataset.categoryJump,name:$('b',b)?.textContent||b.textContent.trim()}))}
function brandMini(name){return`<button type="button" data-brand-chip="${esc(name)}" class="hm-hero-brand">${brandLogo(name)}</button>`}
function productPile(items){return`<div class="hm-product-pile">${items.map((p,i)=>`<button type="button" class="hm-pile-card p${i+1}" ${p.id?`data-open="${esc(p.id)}"`:''}><img src="${esc(p.img)}" alt="${esc(p.name)}"><small>${esc(p.name)}</small></button>`).join('')}</div>`}

function buildHero(hero,home){if(hero.dataset.hmHeroReady)return;const products=heroProductData(hero),cats=heroCategoryData(home),brandNames=preferredBrands.slice(0,3);hero.dataset.hmHeroReady='1';hero.classList.add('hm-hero-carousel');hero.innerHTML=`<div class="hm-hero-track">
  <section class="hm-hero-slide hm-slide-main"><div class="hm-hero-copy"><small>HAKUNA MATATA · MAYORISTA</small><h1>Compra fácil<br>para tu negocio</h1><p>Combina unidades, jabas, cajas y packs en un solo pedido, sin vueltas.</p><button type="button" data-view="catalog">Ver catálogo <span>›</span></button></div>${productPile(products)}</section>
  <section class="hm-hero-slide hm-slide-categories"><div class="hm-hero-copy"><small>TODO EN UN SOLO LUGAR</small><h2>Encuentra rápido<br>lo que necesitas</h2><p>Explora por categorías y arma tu pedido sin perder tiempo.</p><button type="button" data-view="catalog">Explorar productos <span>›</span></button></div><div class="hm-hero-categories">${cats.map(c=>`<button type="button" data-category-jump="${esc(c.id)}"><i>${categoryIcon(c.name)}</i><b>${esc(c.name)}</b></button>`).join('')}</div></section>
  <section class="hm-hero-slide hm-slide-brands"><div class="hm-hero-copy"><small>TUS FAVORITAS</small><h2>Grandes marcas,<br>mejores pedidos</h2><p>Tus marcas de siempre listas para encontrar en segundos.</p><button type="button" data-hm-open-brands="1">Ver marcas <span>›</span></button></div><div class="hm-hero-brand-stack">${brandNames.map(brandMini).join('')}</div></section>
 </div><div class="hm-hero-dots" aria-label="Banners"><button class="active" data-hm-slide="0" aria-label="Banner 1"></button><button data-hm-slide="1" aria-label="Banner 2"></button><button data-hm-slide="2" aria-label="Banner 3"></button></div>`;setupHeroCarousel(hero)}

function setupHeroCarousel(hero){const track=$('.hm-hero-track',hero),dots=$$('[data-hm-slide]',hero);if(!track||track.dataset.hmBound)return;track.dataset.hmBound='1';let index=0,gesture=null,lastAuto=performance.now(),raf=0;const count=dots.length;const go=i=>{index=(i+count)%count;track.scrollTo({left:index*track.clientWidth,behavior:'smooth'});dots.forEach((d,n)=>d.classList.toggle('active',n===index));lastAuto=performance.now()};dots.forEach(d=>d.addEventListener('click',()=>go(Number(d.dataset.hmSlide||0))));track.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,mode:''}},{passive:true});track.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.id||gesture.mode)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;gesture.mode=Math.abs(dx)>Math.abs(dy)*1.16?'horizontal':'vertical'},{passive:true});const end=e=>{if(!gesture||e.pointerId!==gesture.id)return;if(gesture.mode==='horizontal'){index=Math.max(0,Math.min(count-1,Math.round(track.scrollLeft/Math.max(1,track.clientWidth))));dots.forEach((d,n)=>d.classList.toggle('active',n===index));lastAuto=performance.now()}gesture=null};track.addEventListener('pointerup',end,{passive:true});track.addEventListener('pointercancel',end,{passive:true});const loop=now=>{if(!hero.isConnected)return;if(!document.hidden&&gesture?.mode!=='horizontal'&&now-lastAuto>5200)go(index+1);raf=requestAnimationFrame(loop)};if(!matchMedia('(prefers-reduced-motion: reduce)').matches)raf=requestAnimationFrame(loop);hero._hmCancel=()=>cancelAnimationFrame(raf)}

function decorateCategories(root=document){$$('.v10-categories [data-category-jump]',root).forEach(btn=>{if(btn.dataset.hmIcon)return;btn.dataset.hmIcon='1';const name=$('b',btn)?.textContent||btn.textContent.trim(),spot=$('span',btn);if(spot)spot.innerHTML=categoryIcon(name)});$$('.v10-category-rail [data-category]',root).forEach(btn=>{if(btn.dataset.hmIcon||btn.dataset.category==='all')return;btn.dataset.hmIcon='1';const name=btn.textContent.trim();btn.innerHTML=`<i class="hm-cat-mini">${categoryIcon(name)}</i><span>${esc(name)}</span>`})}

function enhanceHome(){const home=$('#homeView .v10-home');if(!home)return;decorateBrandRail(home);const hero=$('.v10-hero',home);if(hero)buildHero(hero,home);decorateCategories(home);const blocks=$$('.v10-block',home);const featured=blocks.find(b=>$('#featuredStrip',b));if(featured){const small=$('.v10-heading small',featured),h2=$('.v10-heading h2',featured);if(small)small.textContent='PARA TU NEGOCIO';if(h2)h2.textContent='Productos destacados'}showInstallControl()}

function enhanceFavorites(){const view=$('#favoritesView .v10-page');if(!view)return;const head=$('.v10-page-head',view);if(head&&!$('.hm-page-subtitle',view)){head.insertAdjacentHTML('afterend','<p class="hm-page-subtitle">Tus productos favoritos, siempre a mano.</p>')}}
function enhanceOrders(){const view=$('#ordersView .v10-page');if(!view)return;const empty=$('.v10-empty.big',view);if(empty&&!$('.hm-empty-art',empty)){const old=$('svg',empty);const art=document.createElement('div');art.className='hm-empty-art';art.innerHTML=icons.receipt;if(old)old.replaceWith(art);else empty.prepend(art)}}
function enhanceCart(){const view=$('#cartView .v10-page');if(!view)return;$$('.v10-cart-line',view).forEach(line=>{if($('.hm-line-remove',line))return;const minus=$('[data-cart-minus]',line);if(!minus)return;const key=minus.dataset.cartMinus;const side=$('.v10-cart-side',line);if(!side)return;const btn=document.createElement('button');btn.type='button';btn.className='hm-line-remove';btn.dataset.hmRemoveLine=key;btn.setAttribute('aria-label','Quitar producto');btn.innerHTML=icons.trash;side.prepend(btn)})}

function decorateBrandSheet(){const sheet=$('.v10-filter-sheet');if(!sheet||sheet.dataset.hmSheet)return;sheet.dataset.hmSheet='1';sheet.classList.add('hm-brand-sheet');const title=$('h2',sheet),desc=$('p',sheet),input=$('#brandSearch',sheet);if(title)title.textContent='Encuentra tu marca';if(desc)desc.textContent='Explora todas las marcas disponibles en el catálogo.';if(input)input.placeholder='Buscar marcas…';$$('[data-brand-option]',sheet).forEach(btn=>{const name=btn.dataset.brandOption||'';btn.classList.add('hm-brand-option');btn.innerHTML=name?`${brandLogo(name)}<span><b>${esc(name)}</b><small>Ver productos</small></span><i>›</i>`:`<span class="hm-all-brands">${icons.grid}</span><span><b>Todas las marcas</b><small>Ver todo el catálogo</small></span><i>›</i>`})}

async function removeCartLine(key){for(let guard=0;guard<250;guard++){const selector=`[data-cart-minus="${CSS.escape(key)}"]`,btn=$(selector);if(!btn)return;const q=Number($('b',btn.parentElement)?.textContent||0);if(!q)return;btn.click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}}

let installPrompt=null;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
function showInstallControl(){if(standalone())return;const row=$('.v10-topbar-row');if(!row||$('.hm-install-btn',row))return;if(!installPrompt&&!isIOS())return;const share=$('#shareBtn',row);if(!share)return;let actions=$('.hm-top-actions',row);if(!actions){actions=document.createElement('div');actions.className='hm-top-actions';share.before(actions);actions.append(share)}const btn=document.createElement('button');btn.type='button';btn.className='hm-install-btn';btn.dataset.hmInstall='1';btn.innerHTML=`${icons.download}<span>Instalar</span>`;actions.prepend(btn)}
function hideInstallControl(){$('.hm-install-btn')?.remove()}
function iosInstallHelp(){if($('.hm-install-help'))return;const wrap=document.createElement('div');wrap.className='hm-install-help';wrap.innerHTML='<div class="hm-install-help-card"><button class="hm-install-help-close" aria-label="Cerrar">×</button><small>INSTALAR HAKUNA MATATA</small><h3>Úsalo como una app</h3><p>En Safari toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.</p><button class="hm-install-help-ok">Entendido</button></div>';document.body.append(wrap);const close=()=>wrap.remove();$('.hm-install-help-close',wrap).onclick=close;$('.hm-install-help-ok',wrap).onclick=close;wrap.addEventListener('click',e=>{if(e.target===wrap)close()})}

function enhanceAll(){enhanceHome();decorateCategories();enhanceFavorites();enhanceOrders();enhanceCart();decorateBrandSheet()}
let scheduled=false;function scheduleEnhance(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhanceAll()})}
function bindObservers(){const main=$('.v10-main'),host=$('#sheetHost');if(!main||!host)return false;const obs=new MutationObserver(scheduleEnhance);obs.observe(main,{childList:true,subtree:true});obs.observe(host,{childList:true,subtree:true});scheduleEnhance();return true}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;showInstallControl()});window.addEventListener('appinstalled',()=>{installPrompt=null;hideInstallControl()});
document.addEventListener('click',async e=>{const brands=e.target.closest?.('[data-hm-open-brands]');if(brands){e.preventDefault();const opener=$('#allBrandsBtn')||$('#filterBtn');opener?.click();return}const install=e.target.closest?.('[data-hm-install]');if(install){e.preventDefault();if(isIOS()){iosInstallHelp();return}if(!installPrompt)return;installPrompt.prompt();try{await installPrompt.userChoice}catch{}installPrompt=null;hideInstallControl();return}const remove=e.target.closest?.('[data-hm-remove-line]');if(remove){e.preventDefault();e.stopPropagation();remove.disabled=true;await removeCartLine(remove.dataset.hmRemoveLine)}},false);

if(!bindObservers()){const boot=new MutationObserver(()=>{if(bindObservers())boot.disconnect()});boot.observe(document.documentElement,{childList:true,subtree:true})}
