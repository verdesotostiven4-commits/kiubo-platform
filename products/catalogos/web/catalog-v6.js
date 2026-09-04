import { api, money, escapeHTML, slugFromLocation, initials, uid, phoneDigits, formatDate } from './core.js';

const slug = slugFromLocation();
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const LS = {
  cart: `kiubo-v6-cart:${slug}`,
  fav: `kiubo-v6-favorites:${slug}`,
  history: `kiubo-v6-orders:${slug}`,
  customer: `kiubo-v6-customer:${slug}`,
  cache: `kiubo-v6-bootstrap:${slug}`
};

const icon = name => ({
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 7.7-4.6M8 13l7.7 4.6"/></svg>',
  home:'<svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8v10h-6v-6H9v6H3z"/></svg>',
  grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  receipt:'<svg viewBox="0 0 24 24"><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  cart:'<svg viewBox="0 0 24 24"><path d="M3 4h2l2 12h10l3-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg>',
  back:'<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  chevron:'<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  pin:'<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  filter:'<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>'
}[name] || '');

const state = {
  account: null,
  categories: [],
  products: [],
  presentations: [],
  popularIds: [],
  cart: read(LS.cart, {}),
  favorites: new Set(read(LS.fav, [])),
  history: read(LS.history, []),
  activeView: 'home',
  activeCategory: 'all',
  activeBrand: '',
  query: '',
  activeProduct: null,
  activePresentation: null,
  delivery: 'delivery',
  location: null,
  paymentMethod: 'cash',
  checkoutStep: 0,
  loading: true,
  sheetOpen: false
};

function normalize(v=''){ return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function productPresentations(id){
  const rows = state.presentations.filter(p=>String(p.product_id)===String(id)&&p.visible!==false).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  if(rows.length) return rows;
  const p = state.products.find(x=>String(x.id)===String(id));
  return p ? [{id:`legacy-${p.id}`,product_id:p.id,name:p.unit||'Unidad',unit_label:p.base_unit||'unidad',units_per_presentation:1,price:Number(p.price||0),is_default:true,visible:true}] : [];
}
function defaultPresentation(p){ return productPresentations(p.id).find(x=>x.is_default) || productPresentations(p.id)[0]; }
function categoryName(product){ return state.categories.find(c=>String(c.id)===String(product.category_id))?.name || 'Otros'; }
function visibleProducts(){ return state.products.filter(p=>p.visible!==false&&!p.archived_at); }
function filteredProducts(){
  const q = normalize(state.query);
  return visibleProducts().filter(p=>{
    if(state.activeCategory!=='all'&&String(p.category_id)!==String(state.activeCategory)) return false;
    if(state.activeBrand&&normalize(p.brand)!==normalize(state.activeBrand)) return false;
    if(!q) return true;
    return [p.name,p.brand,p.description,p.unit,categoryName(p)].some(v=>normalize(v).includes(q));
  });
}
function brands(){ return [...new Set(visibleProducts().map(p=>String(p.brand||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')); }
function cartEntries(){ return Object.entries(state.cart).map(([key,item])=>({key,...item})).filter(x=>Number(x.quantity)>0); }
function cartCount(){ return cartEntries().reduce((s,x)=>s+Number(x.quantity||0),0); }
function cartTotal(){ return cartEntries().reduce((s,x)=>s+Number(x.quantity||0)*Number(x.price||0),0); }
function cartKey(productId,presentationId){ return `${productId}:${presentationId}`; }
function reservedBaseUnits(productId){ return cartEntries().filter(x=>String(x.product_id)===String(productId)).reduce((s,x)=>s+Number(x.quantity||0)*Number(x.units_per_presentation||1),0); }
function canAdd(product,presentation,qty=1){ if(!product?.stock_tracking) return true; return reservedBaseUnits(product.id)+qty*Number(presentation.units_per_presentation||1)<=Number(product.stock_quantity||0); }
function stockState(product){
  if(product.status==='out'||(product.stock_tracking&&Number(product.stock_quantity||0)<=0)) return ['Agotado','out'];
  if(product.status==='low'||(product.stock_tracking&&Number(product.stock_quantity||0)<=Number(product.low_stock_threshold||0))) return ['Pocas','low'];
  return ['Disponible',''];
}
function paymentLabel(id){ return ({cash:'Efectivo',transfer:'Transferencia',card:'Tarjeta',credit:'Crédito',other:'Otro'})[id] || id; }
function toast(message,type=''){ const el=document.createElement('div');el.className=`v6-toast ${type}`;el.textContent=message;document.body.append(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),180)},2400); }
function saveCart(){ write(LS.cart,state.cart); updateBadges(); }
function saveFav(){ write(LS.fav,[...state.favorites]); updateBadges(); }

function shell(){
  document.body.innerHTML=`<div class="v6-app">
    <header class="v6-topbar"><div class="v6-shell v6-topbar__row">
      <button class="v6-brand" data-view="home" aria-label="Inicio"><span class="v6-brand__logo" id="brandLogo"></span><span><b id="brandName">Hakuna Matata</b><small id="brandTagline">Catálogo mayorista</small></span></button>
      <button class="v6-iconbtn" id="shareBtn" aria-label="Compartir">${icon('share')}</button>
    </div></header>
    <main class="v6-main">
      <section class="v6-view active" data-view-panel="home" id="viewHome"></section>
      <section class="v6-view" data-view-panel="catalog" id="viewCatalog"></section>
      <section class="v6-view" data-view-panel="favorites" id="viewFavorites"></section>
      <section class="v6-view" data-view-panel="orders" id="viewOrders"></section>
      <section class="v6-view" data-view-panel="cart" id="viewCart"></section>
    </main>
    <nav class="v6-bottomnav" aria-label="Navegación">
      <button class="active" data-view="home">${icon('home')}<span>Inicio</span></button>
      <button data-view="catalog">${icon('grid')}<span>Catálogo</span></button>
      <button data-view="favorites">${icon('heart')}<span>Favoritos</span><i id="favBadge" hidden>0</i></button>
      <button data-view="orders">${icon('receipt')}<span>Pedidos</span><i id="orderBadge" hidden>0</i></button>
    </nav>
    <button class="v6-cartfab" id="cartFab" hidden><span id="cartFabCount">0</span><div><b>Mi pedido</b><small id="cartFabTotal">$0.00</small></div>${icon('cart')}</button>
    <div id="sheetHost"></div>
  </div>`;
  bindGlobal();
}

function applyBrand(){
  const a=state.account||{};
  $('#brandName').textContent=a.name||'Hakuna Matata'; $('#brandTagline').textContent=a.tagline||'Catálogo mayorista';
  const logo=$('#brandLogo'); logo.innerHTML=a.logo_url?`<img src="${escapeHTML(a.logo_url)}" alt="">`:escapeHTML(initials(a.name||'Hakuna Matata'));
  document.documentElement.style.setProperty('--brand',a.accent||'#ef7048');
  document.documentElement.style.setProperty('--brand-deep',a.accent_deep||'#d95731');
  document.title=`${a.name||'Hakuna Matata'} · Catálogo`;
}

function productCard(product,{compact=false}={}){
  const p=defaultPresentation(product); const [stock,klass]=stockState(product); const fav=state.favorites.has(String(product.id));
  const image=product.image_url?`<img loading="lazy" decoding="async" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}">`:`<span class="v6-product-placeholder">${escapeHTML(initials(product.name))}</span>`;
  return `<article class="v6-product ${compact?'compact':''}" data-product="${product.id}">
    <div class="v6-product__media" data-open-product="${product.id}">${image}<span class="v6-stock ${klass}">${stock}</span><button class="v6-fav ${fav?'active':''}" data-favorite="${product.id}" aria-label="Favorito">${icon('heart')}</button></div>
    <div class="v6-product__body" data-open-product="${product.id}"><small>${escapeHTML(product.brand||categoryName(product))}</small><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(p?.name||product.unit||'Unidad')}${productPresentations(product.id).length>1?` · ${productPresentations(product.id).length} opciones`:''}</p><div><strong>${state.account?.show_prices===false?'Consultar':money(p?.price??product.price,state.account?.currency||'USD')}</strong><button class="v6-add" data-quick-add="${product.id}" ${klass==='out'?'disabled':''}>${icon('plus')}</button></div></div>
  </article>`;
}

function renderHome(){
  const a=state.account||{}; const products=visibleProducts(); const popular=(state.popularIds.length?state.popularIds.map(id=>products.find(p=>String(p.id)===String(id))).filter(Boolean):products).slice(0,6);
  const categories=state.categories.filter(c=>c.visible!==false).slice(0,8);
  $('#viewHome').innerHTML=`<div class="v6-shell">
    <section class="v6-homehero"><div class="v6-homehero__glow"></div><div class="v6-homehero__logo" id="heroLogo">${a.logo_url?`<img src="${escapeHTML(a.logo_url)}" alt="">`:escapeHTML(initials(a.name||'Hakuna Matata'))}</div><span class="v6-kicker">${a.is_open===false?'Catálogo pausado':'Catálogo disponible'}</span><h1>${escapeHTML(a.hero_title||'Todo lo que necesitas, más fácil.')}</h1><p>${escapeHTML(a.hero_subtitle||'Explora, arma tu pedido y revisa el estado sin perder tiempo.')}</p><button class="v6-herocta" data-view="catalog">Explorar catálogo ${icon('chevron')}</button></section>
    <section class="v6-home-search"><button data-view="catalog" data-focus-search>${icon('search')}<span>¿Qué necesitas hoy?</span></button></section>
    <section class="v6-home-block"><div class="v6-sectionhead"><div><small>Explora rápido</small><h2>Categorías</h2></div><button data-view="catalog">Ver todas</button></div><div class="v6-category-cards">${categories.map(c=>`<button data-category-jump="${c.id}"><span>${escapeHTML((c.name||'?').slice(0,1).toUpperCase())}</span><b>${escapeHTML(c.name)}</b></button>`).join('')}</div></section>
    <section class="v6-home-block"><div class="v6-sectionhead"><div><small>${state.popularIds.length?'Lo que más se mueve':'Selección'}</small><h2>${state.popularIds.length?'Más pedidos':'Para empezar'}</h2></div><button data-view="catalog">Ver catálogo</button></div><div class="v6-horizontal-products">${popular.map(p=>productCard(p,{compact:true})).join('')}</div></section>
    <section class="v6-trust"><article><b>Pedido rápido</b><span>Sin registros complicados</span></article><article><b>Seguimiento</b><span>Revisa el estado cuando quieras</span></article><article><b>Presentaciones</b><span>Unidad, pack, caja o jaba</span></article></section>
  </div>`;
}

function renderCatalog(){
  const items=filteredProducts(); const cats=state.categories.filter(c=>c.visible!==false); const bs=brands();
  $('#viewCatalog').innerHTML=`<div class="v6-catalog-head"><div class="v6-shell"><div class="v6-page-title"><div><small>CATÁLOGO</small><h1>Encuentra lo que buscas</h1></div><span>${items.length}</span></div><label class="v6-search">${icon('search')}<input id="catalogSearch" value="${escapeHTML(state.query)}" placeholder="Producto, marca o categoría…"><button id="catalogSearchClear" ${state.query?'':'hidden'}>×</button></label><div class="v6-categoryrail" id="categoryRail"><button class="${state.activeCategory==='all'?'active':''}" data-category="all">Todos</button>${cats.map(c=>`<button class="${String(state.activeCategory)===String(c.id)?'active':''}" data-category="${c.id}">${escapeHTML(c.name)}</button>`).join('')}</div><div class="v6-filterrow"><button class="v6-filterbtn ${state.activeBrand?'active':''}" id="brandFilterBtn">${icon('filter')}<span>${state.activeBrand?escapeHTML(state.activeBrand):'Marca'}</span></button>${state.activeBrand?'<button class="v6-clearbrand" id="clearBrand">Quitar filtro</button>':''}</div>${bs.length?`<div class="v6-brandrail" id="brandRail" hidden>${bs.map(b=>`<button data-brand="${escapeHTML(b)}" class="${state.activeBrand===b?'active':''}">${escapeHTML(b)}</button>`).join('')}</div>`:''}</div></div>
    <div class="v6-shell"><div class="v6-catalog-stage" id="catalogStage">${items.length?`<div class="v6-grid">${items.map(p=>productCard(p)).join('')}</div>`:`<div class="v6-empty"><b>No encontramos productos</b><span>Prueba otra categoría, marca o búsqueda.</span><button id="resetCatalog">Ver todo</button></div>`}</div><div class="v6-swipehint">Desliza a los lados para cambiar de categoría</div></div>`;
  bindCatalogInteractions();
}

function renderFavorites(){
  const items=visibleProducts().filter(p=>state.favorites.has(String(p.id)));
  $('#viewFavorites').innerHTML=`<div class="v6-shell v6-page"><div class="v6-page-title"><div><small>GUARDADOS</small><h1>Favoritos</h1></div><span>${items.length}</span></div>${items.length?`<div class="v6-grid">${items.map(p=>productCard(p)).join('')}</div>`:`<div class="v6-empty v6-empty--large">${icon('heart')}<b>Aún no tienes favoritos</b><span>Guarda productos con el corazón para encontrarlos rápido.</span><button data-view="catalog">Explorar catálogo</button></div>`}</div>`;
}

async function refreshHistory(){
  const current=[...state.history];
  const updates=await Promise.all(current.slice(0,12).map(async item=>{try{const {order}=await api('order_status',{slug,public_token:item.public_token},{timeout:8000});return {...item,...order};}catch{return item;}}));
  state.history=[...updates,...current.slice(12)]; write(LS.history,state.history); renderOrders(); updateBadges();
}
function statusLabel(s){ return ({new:'Recibido',confirmed:'Confirmado',preparing:'Preparando',dispatched:'Despachado',delivered:'Entregado',cancelled:'Cancelado'})[s]||'En proceso'; }
function renderOrders(){
  const items=state.history;
  $('#viewOrders').innerHTML=`<div class="v6-shell v6-page"><div class="v6-page-title"><div><small>SEGUIMIENTO</small><h1>Mis pedidos</h1></div>${items.length?'<button id="refreshOrders" class="v6-mini-action">Actualizar</button>':''}</div>${items.length?`<div class="v6-order-list">${items.map(o=>`<article class="v6-order-card"><div><small>${formatDate(o.created_at||o.updated_at)}</small><h3>${escapeHTML(o.order_number||'Pedido')}</h3><span class="v6-order-status status-${escapeHTML(o.status||'new')}">${escapeHTML(statusLabel(o.status))}</span></div><div class="v6-order-right"><strong>${money(o.total||0,state.account?.currency||'USD')}</strong><a href="/pedido?ref=${encodeURIComponent(o.public_token)}">Ver detalle ${icon('chevron')}</a></div></article>`).join('')}</div>`:`<div class="v6-empty v6-empty--large">${icon('receipt')}<b>No tienes pedidos guardados</b><span>Cuando hagas uno aparecerá aquí con su seguimiento.</span><button data-view="catalog">Ir al catálogo</button></div>`}</div>`;
  $('#refreshOrders')?.addEventListener('click',refreshHistory);
}

function renderCart(){
  const items=cartEntries(); const c=read(LS.customer,{}); const methods=(state.account?.payment_methods||['cash','transfer']).filter(Boolean); if(!methods.includes(state.paymentMethod)) state.paymentMethod=methods[0]||'cash';
  const page=$('#viewCart');
  if(state.checkoutStep===0){
    page.innerHTML=`<div class="v6-shell v6-page v6-cartpage"><div class="v6-cart-head"><button class="v6-back" id="cartBack">${icon('back')}</button><div><small>TU SELECCIÓN</small><h1>Mi pedido</h1></div></div>${items.length?`<div class="v6-cart-layout"><div class="v6-cart-lines">${items.map(x=>`<article class="v6-cartline"><div class="v6-cartline__img">${x.image_url?`<img src="${escapeHTML(x.image_url)}" alt="">`:escapeHTML(initials(x.product_name))}</div><div class="v6-cartline__copy"><h3>${escapeHTML(x.product_name)}</h3><p>${escapeHTML(x.presentation_name)}</p>${x.item_note?`<small>${escapeHTML(x.item_note)}</small>`:''}</div><div class="v6-cartline__actions"><strong>${money(Number(x.quantity)*Number(x.price),state.account?.currency||'USD')}</strong><div class="v6-mini-step"><button data-cart-minus="${escapeHTML(x.key)}">${icon('minus')}</button><b>${x.quantity}</b><button data-cart-plus="${escapeHTML(x.key)}">${icon('plus')}</button></div></div></article>`).join('')}</div><aside class="v6-cart-summary"><div><span>Productos</span><b>${cartCount()}</b></div><div class="total"><span>Total estimado</span><strong>${money(cartTotal(),state.account?.currency||'USD')}</strong></div><button class="v6-primary" id="checkoutStart">Continuar</button></aside></div>`:`<div class="v6-empty v6-empty--large">${icon('cart')}<b>Tu pedido está vacío</b><span>Agrega productos desde el catálogo para continuar.</span><button data-view="catalog">Explorar catálogo</button></div>`}</div>`;
    $('#cartBack')?.addEventListener('click',()=>showView('catalog'));
    $$('[data-cart-minus]').forEach(b=>b.onclick=()=>changeCart(b.dataset.cartMinus,-1)); $$('[data-cart-plus]').forEach(b=>b.onclick=()=>changeCart(b.dataset.cartPlus,1)); $('#checkoutStart')?.addEventListener('click',()=>{state.checkoutStep=1;renderCart();window.scrollTo({top:0,behavior:'auto'});});
    return;
  }
  if(state.checkoutStep===1){
    page.innerHTML=`<div class="v6-shell v6-page v6-checkout"><div class="v6-cart-head"><button class="v6-back" id="stepBack">${icon('back')}</button><div><small>PASO 1 DE 2</small><h1>Datos del pedido</h1></div></div><form id="checkoutForm" class="v6-form"><label><span>Negocio o cliente *</span><input id="cBusiness" maxlength="80" value="${escapeHTML(c.business||'')}" placeholder="Ej. Tienda Barrio Max"></label><label><span>Persona de contacto</span><input id="cName" maxlength="80" value="${escapeHTML(c.name||'')}" placeholder="¿Con quién coordinamos?"></label><label><span>WhatsApp *</span><input id="cPhone" inputmode="numeric" maxlength="10" value="${escapeHTML(localPhone(c.phone||''))}" placeholder="099 123 4567"></label><fieldset><legend>Entrega</legend><div class="v6-choice"><button type="button" data-delivery="delivery" class="${state.delivery==='delivery'?'active':''}">Entrega</button><button type="button" data-delivery="pickup" class="${state.delivery==='pickup'?'active':''}">Retiro</button></div></fieldset><div id="deliveryBox" ${state.delivery==='pickup'?'hidden':''}><label><span>Dirección o referencia</span><input id="cAddress" maxlength="160" value="${escapeHTML(c.address||'')}" placeholder="Sector, calle o referencia"></label><button type="button" class="v6-locationbtn ${state.location?'done':''}" id="locationBtn">${icon('pin')}<span>${state.location?'Ubicación agregada':'Agregar ubicación actual'}</span></button></div><fieldset><legend>Forma de pago</legend><div class="v6-payment-grid">${methods.map(m=>`<button type="button" data-payment="${m}" class="${state.paymentMethod===m?'active':''}">${paymentLabel(m)}</button>`).join('')}</div>${state.paymentMethod==='transfer'&&state.account?.payment_details?paymentDetails():''}</fieldset><label><span>Observación general</span><textarea id="cNotes" maxlength="400" rows="3" placeholder="Horario, referencia u otra indicación…">${escapeHTML(c.notes||'')}</textarea></label><button type="button" class="v6-primary" id="reviewOrder">Revisar pedido</button></form></div>`;
    bindCheckoutForm(); return;
  }
  if(state.checkoutStep===2){ renderReview(); return; }
}
function paymentDetails(){ const d=state.account?.payment_details||{}; const rows=[[d.bank_name,'Banco'],[d.account_type,'Tipo'],[d.account_number,'Cuenta'],[d.account_holder,'Titular']].filter(x=>x[0]); return rows.length?`<div class="v6-bank"><small>Datos de transferencia</small>${rows.map(([v,l])=>`<div><span>${l}</span><b>${escapeHTML(v)}</b></div>`).join('')}</div>`:''; }
function localPhone(v){const d=String(v||'').replace(/\D/g,'');return d.startsWith('593')?`0${d.slice(3,12)}`:d.length===9?`0${d}`:d.slice(0,10)}
function collectCustomer(){ return {business:$('#cBusiness')?.value.trim()||'',name:$('#cName')?.value.trim()||'',phone:$('#cPhone')?.value.trim()||'',address:$('#cAddress')?.value.trim()||'',notes:$('#cNotes')?.value.trim()||''}; }
function bindCheckoutForm(){
  $('#stepBack').onclick=()=>{state.checkoutStep=0;renderCart()};
  $$('[data-delivery]').forEach(b=>b.onclick=()=>{state.delivery=b.dataset.delivery;$$('[data-delivery]').forEach(x=>x.classList.toggle('active',x===b));$('#deliveryBox').hidden=state.delivery==='pickup';});
  $$('[data-payment]').forEach(b=>b.onclick=()=>{state.paymentMethod=b.dataset.payment;renderCart();});
  $('#locationBtn')?.addEventListener('click',()=>{if(!navigator.geolocation)return toast('Ubicación no disponible','error');const btn=$('#locationBtn');btn.disabled=true;btn.querySelector('span').textContent='Obteniendo ubicación…';navigator.geolocation.getCurrentPosition(pos=>{state.location={lat:Number(pos.coords.latitude.toFixed(6)),lng:Number(pos.coords.longitude.toFixed(6)),label:'Ubicación compartida por el cliente'};btn.disabled=false;btn.classList.add('done');btn.querySelector('span').textContent='Ubicación agregada';toast('Ubicación guardada');},()=>{btn.disabled=false;btn.querySelector('span').textContent='Agregar ubicación actual';toast('No pudimos obtener la ubicación','error')},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});});
  $('#reviewOrder').onclick=()=>{const c=collectCustomer();if(!c.business||phoneDigits(c.phone).length<11)return toast('Completa negocio y WhatsApp','error');write(LS.customer,c);state.checkoutStep=2;renderCart();window.scrollTo({top:0,behavior:'auto'});};
}
function renderReview(){
  const c=read(LS.customer,{}),items=cartEntries();
  $('#viewCart').innerHTML=`<div class="v6-shell v6-page v6-review"><div class="v6-cart-head"><button class="v6-back" id="reviewBack">${icon('back')}</button><div><small>PASO 2 DE 2</small><h1>Revisa tu pedido</h1></div></div><div class="v6-review-grid"><section><div class="v6-review-card"><h2>${escapeHTML(c.business||'Cliente')}</h2><p>${escapeHTML(c.name||'')}</p><p>${escapeHTML(localPhone(c.phone||''))}</p><p>${state.delivery==='delivery'?`Entrega · ${escapeHTML(c.address||'Por coordinar')}`:'Retiro'}</p>${state.location?'<span class="v6-location-chip">Ubicación compartida</span>':''}<span class="v6-payment-chip">${paymentLabel(state.paymentMethod)}</span></div><div class="v6-review-items">${items.map(x=>`<div><span><b>${x.quantity}×</b> ${escapeHTML(x.product_name)}<small>${escapeHTML(x.presentation_name)}${x.item_note?` · ${escapeHTML(x.item_note)}`:''}</small></span><strong>${money(x.quantity*x.price,state.account?.currency||'USD')}</strong></div>`).join('')}</div></section><aside class="v6-cart-summary"><div><span>Productos</span><b>${cartCount()}</b></div><div class="total"><span>Total estimado</span><strong>${money(cartTotal(),state.account?.currency||'USD')}</strong></div><button class="v6-primary" id="submitOrder">Confirmar pedido</button></aside></div></div>`;
  $('#reviewBack').onclick=()=>{state.checkoutStep=1;renderCart()}; $('#submitOrder').onclick=submitOrder;
}
async function submitOrder(){
  const btn=$('#submitOrder'); if(btn.disabled)return; btn.disabled=true;btn.textContent='Registrando…';const c=read(LS.customer,{}),entries=cartEntries();
  try{
    const payload=await api('create_order',{slug,idempotency_key:uid(),payment_method:state.paymentMethod,customer:{customer_business:c.business,customer_name:c.name,customer_phone:phoneDigits(c.phone),delivery_method:state.delivery,delivery_address:state.delivery==='delivery'?c.address:null,delivery_lat:state.location?.lat??null,delivery_lng:state.location?.lng??null,delivery_location_label:state.location?.label??null,notes:c.notes},items:entries.map(x=>({product_id:x.product_id,presentation_id:String(x.presentation_id).startsWith('legacy-')?null:x.presentation_id,quantity:x.quantity,item_note:x.item_note||null}))},{timeout:18000});
    const o=payload.order||{};const record={order_number:o.order_number,public_token:o.public_token,total:o.total||cartTotal(),created_at:o.created_at||new Date().toISOString(),status:o.status||'new',payment_method:state.paymentMethod};state.history=[record,...state.history.filter(x=>x.public_token!==record.public_token)].slice(0,30);write(LS.history,state.history);state.cart={};saveCart();state.checkoutStep=0;renderSuccess(record,payload.whatsapp_url);
  }catch(err){btn.disabled=false;btn.textContent='Confirmar pedido';toast(err.code==='product_unavailable'?'Un producto ya no está disponible':'No pudimos registrar el pedido','error');}
}
function renderSuccess(order,whatsapp){
  const page=$('#viewCart');page.innerHTML=`<div class="v6-shell v6-page"><div class="v6-success"><span>${icon('check')}</span><small>PEDIDO REGISTRADO</small><h1>Listo, ya lo recibimos.</h1><p>Tu pedido <b>${escapeHTML(order.order_number||'')}</b> quedó guardado. Desde “Pedidos” puedes revisar cuándo Mayra lo confirme, prepare y despache.</p><div class="v6-success-actions"><a href="/pedido?ref=${encodeURIComponent(order.public_token)}">Ver seguimiento</a>${whatsapp?`<a href="${escapeHTML(whatsapp)}" target="_blank" rel="noopener">Coordinar por WhatsApp</a>`:''}<button id="successOrders">Ir a mis pedidos</button></div></div></div>`;$('#successOrders').onclick=()=>showView('orders');updateBadges();
}

function changeCart(key,delta){ const item=state.cart[key];if(!item)return;const p=state.products.find(x=>String(x.id)===String(item.product_id));const pres=productPresentations(item.product_id).find(x=>String(x.id)===String(item.presentation_id))||item;if(delta>0&&!canAdd(p,pres,1))return toast('No hay más stock disponible','error');item.quantity=Math.max(0,Number(item.quantity||0)+delta);if(!item.quantity)delete state.cart[key];saveCart();renderCart(); }
function addToCart(product,presentation,qty=1,note=''){ if(stockState(product)[1]==='out')return toast('Este producto está agotado','error');if(!canAdd(product,presentation,qty))return toast('La cantidad supera el stock','error');const key=cartKey(product.id,presentation.id);const current=state.cart[key]||{};state.cart[key]={product_id:product.id,presentation_id:presentation.id,product_name:product.name,presentation_name:presentation.name,units_per_presentation:Number(presentation.units_per_presentation||1),price:Number(presentation.price||0),quantity:Number(current.quantity||0)+qty,item_note:note.trim().slice(0,180),image_url:product.image_url||''};saveCart();toast('Agregado a tu pedido'); }
function quickAdd(product){const ps=productPresentations(product.id);if(ps.length>1)return openProduct(product);addToCart(product,ps[0],1,'');}

function openProduct(product){
  const ps=productPresentations(product.id);state.activeProduct=product;state.activePresentation=defaultPresentation(product);const [stock,klass]=stockState(product);const image=product.image_url?`<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}">`:`<span class="v6-product-placeholder">${escapeHTML(initials(product.name))}</span>`;
  openSheet(`<div class="v6-detail"><div class="v6-detail-media">${image}<span class="v6-stock ${klass}">${stock}</span></div><div class="v6-detail-copy"><small>${escapeHTML(product.brand||categoryName(product))}</small><h2>${escapeHTML(product.name)}</h2>${product.description?`<p>${escapeHTML(product.description)}</p>`:''}<div class="v6-detail-label">Presentación</div><div class="v6-presentation-list">${ps.map(p=>`<button data-presentation="${p.id}" class="${String(p.id)===String(state.activePresentation?.id)?'active':''}"><span><b>${escapeHTML(p.name)}</b><small>${Number(p.units_per_presentation||1)} ${escapeHTML(product.base_unit||p.unit_label||'unidad')}${Number(p.units_per_presentation||1)===1?'':'es'}</small></span><strong>${state.account?.show_prices===false?'Consultar':money(p.price,state.account?.currency||'USD')}</strong></button>`).join('')}</div>${product.allow_item_note!==false?`<button class="v6-note-toggle" id="noteToggle">+ Añadir detalle opcional</button><div class="v6-note" id="noteBox" hidden><textarea id="itemNote" maxlength="180" placeholder="Sabor, color, modelo o variedad…"></textarea></div>`:''}<div class="v6-detail-buy"><div class="v6-stepper"><button id="qtyMinus">${icon('minus')}</button><b id="qtyValue">1</b><button id="qtyPlus">${icon('plus')}</button></div><button class="v6-primary" id="addSelected">Agregar · <span id="detailTotal">${state.account?.show_prices===false?'Consultar':money(state.activePresentation?.price||product.price,state.account?.currency||'USD')}</span></button></div></div></div>`,sheet=>{let qty=1;const refresh=()=>{$('#qtyValue',sheet).textContent=qty;$('#detailTotal',sheet).textContent=state.account?.show_prices===false?'Consultar':money(Number(state.activePresentation?.price||0)*qty,state.account?.currency||'USD')};$$('[data-presentation]',sheet).forEach(b=>b.onclick=()=>{state.activePresentation=ps.find(p=>String(p.id)===String(b.dataset.presentation))||ps[0];$$('[data-presentation]',sheet).forEach(x=>x.classList.toggle('active',x===b));qty=1;refresh()});$('#qtyMinus',sheet).onclick=()=>{qty=Math.max(1,qty-1);refresh()};$('#qtyPlus',sheet).onclick=()=>{if(canAdd(product,state.activePresentation,qty+1))qty++;else toast('No hay más stock disponible','error');refresh()};$('#noteToggle',sheet)?.addEventListener('click',()=>{const box=$('#noteBox',sheet);box.hidden=!box.hidden;$('#noteToggle',sheet).textContent=box.hidden?'+ Añadir detalle opcional':'− Ocultar detalle'});$('#addSelected',sheet).onclick=()=>{addToCart(product,state.activePresentation,qty,$('#itemNote',sheet)?.value||'');closeSheet()};});
}
function openSheet(body,onMount){ closeSheet(true);const host=$('#sheetHost');host.innerHTML=`<div class="v6-overlay"></div><section class="v6-sheet"><div class="v6-grab"></div><button class="v6-sheet-close" aria-label="Cerrar">×</button><div class="v6-sheet-scroll">${body}</div></section>`;state.sheetOpen=true;requestAnimationFrame(()=>{$('.v6-overlay',host).classList.add('show');$('.v6-sheet',host).classList.add('show')});$('.v6-overlay',host).onclick=()=>closeSheet();$('.v6-sheet-close',host).onclick=()=>closeSheet();setupSheetGesture($('.v6-sheet',host));onMount?.($('.v6-sheet',host)); }
function closeSheet(immediate=false){const host=$('#sheetHost');if(!host?.children.length){state.sheetOpen=false;return}const done=()=>{host.innerHTML='';state.sheetOpen=false};if(immediate)return done();$('.v6-overlay',host)?.classList.remove('show');$('.v6-sheet',host)?.classList.remove('show');setTimeout(done,160);}
function setupSheetGesture(sheet){let startY=0,lastY=0,drag=false;const grab=$('.v6-grab',sheet);const begin=e=>{drag=true;startY=e.clientY;lastY=startY;sheet.classList.add('dragging');sheet.setPointerCapture?.(e.pointerId)};const move=e=>{if(!drag)return;lastY=e.clientY;const dy=Math.max(0,lastY-startY);sheet.style.transform=`translate3d(-50%,${dy}px,0)`};const end=()=>{if(!drag)return;drag=false;sheet.classList.remove('dragging');const dy=Math.max(0,lastY-startY);if(dy>72)closeSheet();else sheet.style.transform=''};grab.addEventListener('pointerdown',begin);grab.addEventListener('pointermove',move);grab.addEventListener('pointerup',end);grab.addEventListener('pointercancel',end);}

function showView(name,{push=true,focusSearch=false}={}){
  if(name==='cart') state.checkoutStep=Math.max(0,state.checkoutStep);
  state.activeView=name;$$('[data-view-panel]').forEach(p=>p.classList.toggle('active',p.dataset.viewPanel===name));$$('.v6-bottomnav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  if(name==='home')renderHome();if(name==='catalog')renderCatalog();if(name==='favorites')renderFavorites();if(name==='orders'){renderOrders();if(state.history.length)refreshHistory();}if(name==='cart')renderCart();
  if(push&&history.state?.v6View!==name)history.pushState({v6View:name},'',name==='home'?location.pathname:`${location.pathname}#${name}`);
  window.scrollTo({top:0,behavior:'auto'});if(focusSearch&&name==='catalog')setTimeout(()=>$('#catalogSearch')?.focus(),80);updateBadges();
}
function updateBadges(){const f=state.favorites.size,o=state.history.length,c=cartCount();const fb=$('#favBadge'),ob=$('#orderBadge'),fab=$('#cartFab');if(fb){fb.textContent=f;fb.hidden=!f}if(ob){ob.textContent=o;ob.hidden=!o}if(fab){fab.hidden=!c||state.activeView==='cart';$('#cartFabCount').textContent=c;$('#cartFabTotal').textContent=money(cartTotal(),state.account?.currency||'USD')}}

function bindGlobal(){
  document.addEventListener('click',e=>{
    const view=e.target.closest?.('[data-view]');if(view){e.preventDefault();return showView(view.dataset.view,{focusSearch:Boolean(view.hasAttribute('data-focus-search'))})}
    const jump=e.target.closest?.('[data-category-jump]');if(jump){state.activeCategory=jump.dataset.categoryJump;state.activeBrand='';state.query='';return showView('catalog')}
    const fav=e.target.closest?.('[data-favorite]');if(fav){e.preventDefault();e.stopPropagation();const id=String(fav.dataset.favorite);state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveFav();if(state.activeView==='favorites')renderFavorites();else{fav.classList.toggle('active',state.favorites.has(id));}return}
    const open=e.target.closest?.('[data-open-product]');if(open){const p=state.products.find(x=>String(x.id)===String(open.dataset.openProduct));if(p)openProduct(p);return}
    const add=e.target.closest?.('[data-quick-add]');if(add){e.preventDefault();e.stopPropagation();const p=state.products.find(x=>String(x.id)===String(add.dataset.quickAdd));if(p)quickAdd(p);}
  });
  $('#shareBtn').onclick=async()=>{const data={title:state.account?.name||'Catálogo',text:'Mira este catálogo',url:location.origin+location.pathname};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);toast('Enlace copiado')}}catch{}};
  $('#cartFab').onclick=()=>showView('cart');
  history.replaceState({v6View:'home'},'',location.pathname);window.addEventListener('popstate',e=>{if(state.sheetOpen)return closeSheet();showView(e.state?.v6View||'home',{push:false});});
}
function bindCatalogInteractions(){
  $('#catalogSearch')?.addEventListener('input',e=>{state.query=e.target.value;const pos=window.scrollY;renderCatalog();window.scrollTo(0,pos);requestAnimationFrame(()=>{const i=$('#catalogSearch');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}})});$('#catalogSearchClear')?.addEventListener('click',()=>{state.query='';renderCatalog();$('#catalogSearch')?.focus()});
  $$('[data-category]',$('#viewCatalog')).forEach(b=>b.onclick=e=>{e.preventDefault();state.activeCategory=b.dataset.category;state.query='';const y=window.scrollY;renderCatalog();window.scrollTo(0,y)});
  $('#brandFilterBtn')?.addEventListener('click',()=>{$('#brandRail').hidden=!$('#brandRail').hidden});$$('[data-brand]',$('#viewCatalog')).forEach(b=>b.onclick=()=>{state.activeBrand=b.dataset.brand;const y=window.scrollY;renderCatalog();window.scrollTo(0,y)});$('#clearBrand')?.addEventListener('click',()=>{state.activeBrand='';renderCatalog()});$('#resetCatalog')?.addEventListener('click',()=>{state.activeCategory='all';state.activeBrand='';state.query='';renderCatalog()});
  const stage=$('#catalogStage');if(stage){let sx=0,sy=0;stage.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});stage.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)<58||Math.abs(dx)<Math.abs(dy)*1.2)return;const ids=['all',...state.categories.filter(c=>c.visible!==false).map(c=>String(c.id))];let i=ids.indexOf(String(state.activeCategory));i=dx<0?Math.min(ids.length-1,i+1):Math.max(0,i-1);if(ids[i]!==String(state.activeCategory)){state.activeCategory=ids[i];renderCatalog();toast(state.activeCategory==='all'?'Todos':state.categories.find(c=>String(c.id)===String(state.activeCategory))?.name||'Categoría')}} ,{passive:true});}
}

async function load(){
  shell(); const cached=read(LS.cache,null);if(cached?.account){hydrate(cached);state.loading=false;renderAll();}
  try{const payload=await api('catalog_bootstrap',{slug},{timeout:14000});hydrate(payload);write(LS.cache,{...payload,cached_at:Date.now()});state.loading=false;renderAll();}catch{if(!cached){$('#viewHome').innerHTML=`<div class="v6-shell"><div class="v6-empty v6-empty--large"><b>No pudimos cargar el catálogo</b><span>Revisa tu conexión e inténtalo nuevamente.</span><button id="retryLoad">Reintentar</button></div></div>`;$('#retryLoad')?.addEventListener('click',()=>location.reload())}}
}
function hydrate(payload){state.account=payload.account||state.account;state.categories=Array.isArray(payload.categories)?payload.categories:state.categories;state.products=Array.isArray(payload.products)?payload.products:state.products;state.presentations=Array.isArray(payload.presentations)?payload.presentations:state.presentations;state.popularIds=Array.isArray(payload.popular_product_ids)?payload.popular_product_ids:state.popularIds;if(state.account?.payment_methods?.length&&!state.account.payment_methods.includes(state.paymentMethod))state.paymentMethod=state.account.payment_methods[0];applyBrand();}
function renderAll(){renderHome();renderCatalog();renderFavorites();renderOrders();updateBadges();}

if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
load();
