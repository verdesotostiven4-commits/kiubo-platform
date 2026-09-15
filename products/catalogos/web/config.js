/* Hakuna 10.16.7 — frozen detail background + isolated smooth brand marquee. */
window.KIUBO_CATALOG_CONFIG=Object.freeze({
  supabaseUrl:'https://hysrlckmnzlmscwwbibn.supabase.co',
  publishableKey:'sb_publishable_hnsAgTsI1c_wErMMwAYwMQ_crWdOBpT',
  apiUrl:'https://hysrlckmnzlmscwwbibn.supabase.co/functions/v1/catalog-v9',
  notifyUrl:'https://hysrlckmnzlmscwwbibn.supabase.co/functions/v1/catalog-notify',
  defaultSlug:'hakuna-matata',
  version:'10.16.7',
  brandLogoUrl:'https://cdn.phototourl.com/free/2026-09-09-81972c89-9fb3-4bb7-ad34-74c1fe90aca9.jpg'
});
(()=>{
  const path=location.pathname,v='10.16.7',logo=window.KIUBO_CATALOG_CONFIG.brandLogoUrl;
  document.documentElement.dataset.hmBuild=v;
  const setIcon=(rel,href)=>{let l=document.querySelector(`link[rel="${rel}"]`);if(!l){l=document.createElement('link');l.rel=rel;document.head.append(l)}l.href=href};
  if(logo){setIcon('icon',logo);setIcon('apple-touch-icon',logo)}
  const addStyle=href=>{if(document.querySelector(`link[href^="${href}"]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=`${href}?v=${v}`;document.head.append(l)};
  const addManifest=href=>{let l=document.querySelector('link[rel="manifest"]');if(!l){l=document.createElement('link');l.rel='manifest';document.head.append(l)}l.href=`${href}?v=${v}`};
  if(/^\/(panel|master)(?:\/|$)/.test(path)){
    const theme=document.querySelector('meta[name="theme-color"]');if(theme)theme.content='#ffffff';else{const m=document.createElement('meta');m.name='theme-color';m.content='#ffffff';document.head.append(m)}
    document.documentElement.style.background='#ffffff';if(document.body)document.body.style.background='#ffffff';
    if(logo)document.querySelectorAll('img[src="/assets/brand-mark.svg"]').forEach(img=>{img.src=logo;img.style.objectFit='contain';img.style.background='#fff'});
    [
      '/panel-v5.css','/panel-v6.css','/panel-v7.css','/panel-v7.1.css','/panel-v7.2.1.css','/panel-v7.5.css','/panel-v7.6.css','/panel-v7.7.css',
      '/panel-v10-stability.css','/panel-v10.4.2.css','/panel-v10.5.css','/panel-v10.5.1.css','/panel-v10.6.css','/panel-v10.9.css','/panel-v10.10.css','/panel-v10.11.css','/panel-v10.14.css','/panel-v10.15.css','/panel-v10.16.2.css'
    ].forEach(addStyle);
    addManifest('/panel.webmanifest');
    const scripts=[
      '/panel-fast-save-v7.4.js','/panel-v6.js','/panel-v5.js','/panel-extras-v5.js','/panel-orders-v6.js','/panel-v7.js','/panel-v7.5.js','/panel-v7.5.1.js',
      '/panel-v7.6.js','/panel-v7.7.js',
      '/panel-v10-stability.js','/panel-v10.5.1.js','/panel-v10.6.js','/panel-v10.9.js','/panel-v10.10.js','/panel-v10.11-core.js','/panel-v10.11-ui.js','/panel-v10.14.js','/panel-v10.15.js','/panel-v10.16.2.js','/push-v10.7.js'
    ];
    document.write(scripts.map(src=>`<script src="${src}?v=${v}"><\/script>`).join(''));
  }else if(/^\/pedido/.test(path)){
    addStyle('/orders-v5.css');
  }else{
    document.documentElement.classList.add('hm112-boot','hm1162-home-brands-pending','hm1163-boot','hm1164-boot');
    if(!document.getElementById('hm112Critical')){
      const s=document.createElement('style');s.id='hm112Critical';s.textContent=`html.hm112-boot:not(.hm112-ready) .v10-app,html.hm1164-boot .v10-app{opacity:0!important;visibility:hidden!important;pointer-events:none!important}html.hm112-boot:not(.hm112-ready) body::before,html.hm1164-boot body::before{content:"";position:fixed;inset:0;z-index:2147483000;background:#fff}html.hm112-boot:not(.hm112-ready) body::after,html.hm1164-boot body::after{content:"";position:fixed;z-index:2147483001;left:50%;top:50%;width:78px;height:78px;transform:translate(-50%,-50%);border-radius:18px;background:#fff url("${logo||'/assets/brand-mark.svg'}") center/contain no-repeat;box-shadow:0 8px 30px rgba(15,66,44,.08)}html.hm1164-ready body::before,html.hm1164-ready body::after{display:none!important}`;document.head.append(s);
    }
    const hero='https://blogger.googleusercontent.com/img/a/AVvXsEi0hDelNFtHhwoe6guvslOKkEqE0a4o3qVn_Mnut7m2IPdXwfoGDifE1S5QksIbMEDzm_LFESZjvksQ3JEKR_i5iFIYzTkCryXadiPRtu7R9w00ZOtqLTFnDZEUdStZX1IyEbuPqy4CR8QCVlqrVoMEl2Q7FqCzkreaLh26NUkdZJ-TCRQbrvooScWcthA';
    if(!document.querySelector('link[data-hm112-hero]')){const l=document.createElement('link');l.rel='preload';l.as='image';l.href=hero;l.dataset.hm112Hero='1';try{l.fetchPriority='high'}catch{}document.head.append(l)}
    addManifest('/manifest.webmanifest');
    addStyle('/catalog-v10.11.css');
    addStyle('/catalog-v10.12.css');
    addStyle('/catalog-v10.13.css');
    addStyle('/catalog-v10.16.css');
    addStyle('/catalog-v10.16.1.css');
    addStyle('/catalog-v10.16.2.css');
    addStyle('/catalog-v10.16.3.css');
    addStyle('/catalog-v10.16.4.css');
    addStyle('/catalog-v10.16.5.css');
    addStyle('/catalog-v10.16.7.css');
    document.write(`<script src="/catalog-v10.12.js?v=${v}"><\/script><script src="/catalog-v10.13.js?v=${v}"><\/script><script src="/catalog-v10.11.js?v=${v}"><\/script><script src="/catalog-v10.16.1.js?v=${v}"><\/script><script src="/catalog-v10.16.2.js?v=${v}"><\/script><script src="/catalog-v10.16.3.js?v=${v}"><\/script><script src="/catalog-v10.16.4.js?v=${v}"><\/script><script src="/catalog-v10.16.6.js?v=${v}"><\/script><script src="/catalog-v10.16.7.js?v=${v}"><\/script>`);
  }
})();
