(()=>{
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const cfg=()=>window.KIUBO_CATALOG_CONFIG||{};
  const slug=()=>{const q=new URLSearchParams(location.search).get('slug');const m=location.pathname.match(/^\/c\/([^/]+)/);return(q||m?.[1]||cfg().defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,'')};
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const money=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0));
  let dataPromise=null, bootstrap=null, searchIndex=new Map(), compact=false, cartCount=0, cartHideTimer=0;

  async function ensureBootstrap(){
    if(dataPromise)return dataPromise;
    dataPromise=(async()=>{
      try{
        const c=cfg();if(!c.apiUrl)return null;
        const res=await fetch(c.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Client-Version':c.version||'7.1.0'},body:JSON.stringify({action:'catalog_bootstrap',slug:slug()})});
        if(!res.ok)return null;
        bootstrap=await res.json();
        const cats=new Map((bootstrap.categories||[]).map(c=>[String(c.id),c.name||'']));
        searchIndex=new Map((bootstrap.products||[]).map(p=>[String(p.id),normalize([p.name,p.brand,p.description,p.sku,p.unit,p.category_name||cats.get(String(p.category_id))||''].join(' '))]));
        return bootstrap;
      }catch{return null}
    })();
    return dataPromise;
  }

  function ensureSearchEmpty(body,visible,query){
    let empty=$('#v71SearchEmpty',body);
    if(visible||!query){empty?.remove();return}
    if(!empty){empty=document.createElement('div');empty.id='v71SearchEmpty';empty.className='v7-empty';empty.innerHTML='<b>No encontramos productos</b><span>Prueba otra palabra o limpia la búsqueda.</span>';body.append(empty)}
  }
  async function applySearch(input){
    await ensureBootstrap();
    const q=normalize(input.value),body=$('.v7-catalog-body');if(!body)return;
    let visible=0;
    $$('.v7-product',body).forEach(card=>{const id=card.dataset.product||'';const hay=searchIndex.get(String(id))||normalize(card.textContent);const show=!q||hay.includes(q);card.hidden=!show;if(show)visible++});
    const count=$('.v7-catalog-title>span');if(count)count.textContent=String(visible);
    const clear=$('#clearSearch');if(clear)clear.hidden=!q;
    ensureSearchEmpty(body,visible>0,q);
  }
  document.addEventListener('input',e=>{
    const input=e.target;if(!(input instanceof HTMLInputElement)||input.id!=='catalogSearch')return;
    e.stopImmediatePropagation();e.stopPropagation();applySearch(input);
  },{capture:true});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#clearSearch')){const input=$('#catalogSearch');if(input){input.value='';requestAnimationFrame(()=>{applySearch(input);input.focus()})}}
  },true);

  function applyHeaderState(){
    const head=$('#catalogHead');if(!head)return;
    const y=window.scrollY;
    if(!compact&&y>220)compact=true;
    else if(compact&&y<48)compact=false;
    head.classList.toggle('v71-compact',compact);
  }
  let scrollTick=false;
  window.addEventListener('scroll',()=>{if(scrollTick)return;scrollTick=true;requestAnimationFrame(()=>{scrollTick=false;applyHeaderState()})},{passive:true});

  function readCart(){
    try{
      const raw=JSON.parse(localStorage.getItem(`kiubo-v7-cart:${slug()}`)||'{}');
      const entries=Object.values(raw||{}).filter(x=>Number(x?.quantity)>0);
      return {count:entries.reduce((s,x)=>s+Number(x.quantity||0),0),total:entries.reduce((s,x)=>s+Number(x.quantity||0)*Number(x.price||0),0)};
    }catch{return{count:0,total:0}}
  }
  function removeCartPeek(){const p=$('.v71-cart-peek');if(!p)return;p.classList.remove('show');setTimeout(()=>p.remove(),180)}
  function showCartPeek(count,total){
    if(count<1)return removeCartPeek();
    let peek=$('.v71-cart-peek');if(!peek){peek=document.createElement('button');peek.type='button';peek.className='v71-cart-peek';peek.innerHTML='<span class="v71-cart-peek__icon"><svg viewBox="0 0 24 24"><path d="M3 4h2l2 12h10l3-8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg></span><span><b></b><small></small></span><i>›</i>';peek.addEventListener('click',()=>$('.v7-nav [data-view="cart"]')?.click());document.body.append(peek)}
    $('b',peek).textContent=count===1?'1 producto en tu carrito':`${count} productos en tu carrito`;
    $('small',peek).textContent=money(total);
    clearTimeout(cartHideTimer);requestAnimationFrame(()=>peek.classList.add('show'));cartHideTimer=setTimeout(removeCartPeek,2200);
  }
  function animateCart(){
    const cart=readCart(),btn=$('.v7-nav [data-view="cart"]'),badge=$('#cartBadge');
    if(cart.count>cartCount){
      btn?.classList.remove('v71-cart-bump');badge?.classList.remove('v71-badge-pop');
      void btn?.offsetWidth;btn?.classList.add('v71-cart-bump');badge?.classList.add('v71-badge-pop');
      showCartPeek(cart.count,cart.total);
      try{navigator.vibrate?.(12)}catch{}
      setTimeout(()=>{btn?.classList.remove('v71-cart-bump');badge?.classList.remove('v71-badge-pop')},520);
    }
    cartCount=cart.count;
  }
  function observeCartBadge(){
    const badge=$('#cartBadge');if(!badge||badge.dataset.v71Observed)return;
    badge.dataset.v71Observed='1';cartCount=readCart().count;
    new MutationObserver(animateCart).observe(badge,{attributes:true,childList:true,subtree:true,attributeFilter:['hidden']});
  }

  function suppressOldCartToast(){
    new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes){if(node.nodeType===1&&node.classList?.contains('v7-toast')&&/agregado al carrito/i.test(node.textContent||''))node.remove()}}).observe(document.body,{childList:true});
  }

  function featuredProducts(data){
    const products=(data?.products||[]).filter(p=>p.visible!==false&&!p.archived_at);
    const featured=products.filter(p=>p.featured).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
    return (featured.length?featured:products.slice(0,8)).map(p=>String(p.id));
  }
  function cloneFeaturedCard(id){
    const source=$(`#catalogView .v7-product[data-product="${CSS.escape(String(id))}"]`);if(!source)return null;
    const clone=source.cloneNode(true);clone.hidden=false;clone.removeAttribute('hidden');return clone;
  }
  function initCarousel(strip,ids){
    if(strip.dataset.v71Ready==='1'&&strip.dataset.v71Ids===ids.join(','))return;
    strip.dataset.v71Ready='1';strip.dataset.v71Ids=ids.join(',');strip.classList.add('v71-infinite-strip');strip.innerHTML='';
    const groups=[];
    for(let g=0;g<3;g++){
      const group=document.createElement('div');group.className='v71-carousel-group';
      ids.forEach(id=>{const card=cloneFeaturedCard(id);if(card)group.append(card)});
      if(group.children.length){strip.append(group);groups.push(group)}
    }
    if(groups.length<2)return;
    const heading=strip.closest('.v7-block')?.querySelector('.v7-heading');
    const h2=heading?.querySelector('h2'),small=heading?.querySelector('small');if(h2)h2.textContent='Productos destacados';if(small)small.textContent='SELECCIÓN DE LA TIENDA';
    let paused=false,last=performance.now(),resumeTimer=0;
    const width=()=>groups[1]?.offsetWidth||groups[0]?.offsetWidth||0;
    requestAnimationFrame(()=>{const w=width();if(w)strip.scrollLeft=w});
    const normalizeLoop=()=>{const w=width();if(!w)return;if(strip.scrollLeft<Math.max(1,w*.45))strip.scrollLeft+=w;else if(strip.scrollLeft>w*1.55)strip.scrollLeft-=w};
    const tick=now=>{
      if(!strip.isConnected)return;
      const dt=Math.min(50,now-last);last=now;
      if(!paused&&document.visibilityState==='visible'){strip.scrollLeft+=dt*.018;normalizeLoop()}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const pause=()=>{paused=true;clearTimeout(resumeTimer)};
    const resume=()=>{clearTimeout(resumeTimer);resumeTimer=setTimeout(()=>{normalizeLoop();paused=false;last=performance.now()},900)};
    strip.addEventListener('touchstart',pause,{passive:true});strip.addEventListener('touchend',resume,{passive:true});strip.addEventListener('touchcancel',resume,{passive:true});
    strip.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')pause()},{passive:true});strip.addEventListener('pointerup',e=>{if(e.pointerType==='mouse')resume()},{passive:true});
    let scrollTimer=0;strip.addEventListener('scroll',()=>{if(paused){clearTimeout(scrollTimer);scrollTimer=setTimeout(normalizeLoop,120)}},{passive:true});
  }
  async function ensureFeaturedCarousel(){
    const strip=$('#homeView .v7-product-strip');if(!strip)return;
    const data=await ensureBootstrap();if(!data)return;
    const ids=featuredProducts(data);if(!ids.length)return;
    initCarousel(strip,ids);
  }

  function nativeSurface(){
    const meta=document.querySelector('meta[name="viewport"]');if(meta)meta.setAttribute('content','width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    document.addEventListener('contextmenu',e=>{if(!e.target.closest?.('input,textarea'))e.preventDefault()});
    document.addEventListener('dragstart',e=>{if(e.target.closest?.('img,.v7-product,.v7-nav'))e.preventDefault()});
  }

  function observeViews(){
    const catalog=$('#catalogView'),home=$('#homeView');
    if(catalog&&!catalog.dataset.v71Observed){catalog.dataset.v71Observed='1';new MutationObserver(()=>{applyHeaderState();observeCartBadge()}).observe(catalog,{childList:true})}
    if(home&&!home.dataset.v71Observed){home.dataset.v71Observed='1';new MutationObserver(()=>{requestAnimationFrame(ensureFeaturedCarousel)}).observe(home,{childList:true})}
  }
  function start(){
    nativeSurface();suppressOldCartToast();observeCartBadge();observeViews();ensureBootstrap().then(()=>ensureFeaturedCarousel());applyHeaderState();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
