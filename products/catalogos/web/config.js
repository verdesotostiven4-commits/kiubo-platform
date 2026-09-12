/* Hakuna 10.9.1 — forward-only runtime freeze hotfix. */
window.KIUBO_CATALOG_CONFIG=Object.freeze({
  supabaseUrl:'https://hysrlckmnzlmscwwbibn.supabase.co',
  publishableKey:'sb_publishable_hnsAgTsI1c_wErMMwAYwMQ_crWdOBpT',
  apiUrl:'https://hysrlckmnzlmscwwbibn.supabase.co/functions/v1/catalog-v7',
  notifyUrl:'https://hysrlckmnzlmscwwbibn.supabase.co/functions/v1/catalog-notify',
  defaultSlug:'hakuna-matata',
  version:'10.9.1',
  brandLogoUrl:'https://cdn.phototourl.com/free/2026-09-09-81972c89-9fb3-4bb7-ad34-74c1fe90aca9.jpg'
});
(()=>{
  const path=location.pathname,v='10.9.1',logo=window.KIUBO_CATALOG_CONFIG.brandLogoUrl;
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
      '/panel-v10-stability.css','/panel-v10.4.2.css','/panel-v10.5.css','/panel-v10.5.1.css','/panel-v10.6.css','/panel-v10.9.css'
    ].forEach(addStyle);
    addManifest('/panel.webmanifest');
    const scripts=[
      '/panel-fast-save-v7.4.js','/panel-v6.js','/panel-v5.js','/panel-extras-v5.js','/panel-orders-v6.js','/panel-v7.js','/panel-v7.5.js','/panel-v7.5.1.js',
      '/panel-v7.6.js','/panel-v7.7.js',
      '/panel-v10-stability.js','/panel-v10.5.1.js','/panel-v10.6.js','/panel-v10.9.js','/push-v10.7.js'
    ];
    document.write(scripts.map(src=>`<script src="${src}?v=${v}"><\/script>`).join(''));
  }else if(/^\/pedido/.test(path)){
    addStyle('/orders-v5.css');
  }else{
    addManifest('/manifest.webmanifest');
  }
})();