/* Hakuna Matata 10.7.2 — verified brand assets + rounded full-bleed brand plates. */
(()=>{
'use strict';
const current=window.KIUBO_BRAND_ASSETS||{};
const HALLS='https://blogger.googleusercontent.com/img/a/AVvXsEgbQYF-4TAbUEmeIDMmF6BEQEd8x7s22rHzckWMSpF5LJluu8_Tq48tzEuc8xKQFWZkv7m78rxOmRWeHYdXQSz7YLvyk8_xsDn7fjGxxLyuH_OLsZfr4j_pCelg4yRKSqDMrdgAvyergqaMUmB8fSb6hGn6_Cx0-H1Bk9caBSGCiHRRQuogmV3H1FUW5no';
const VIVANT='https://blogger.googleusercontent.com/img/a/AVvXsEhFa2z3w05Qy3bcmuc0gB53pRAaVMvLHEZYVqErFOI7VWnS4JuknW8V5bYepnqsBJzsBgbK-PaKeXmcCuCJ1tXgmLQzrEATKuvd5-8LCsIXFQ53TfxvP4V2dH0Kg4-P0Q6SZ4GfHGUOg9LVLYD6LdLnkt_gBS7N02INYWXhrthcMkJg11w2stHJhdCjdas';
const FIORA='https://blogger.googleusercontent.com/img/a/AVvXsEjY0AYzWc4HklnXKGIyNp040HmX6Efmz0dcawcUI8OlKwwPX_fbmHwhNOcN525DuP1MFpWmkycsMf84wKvk19Bva7wmYr2GmWyClvpqIlRCMdw9mEAfJ9r_WvmhRfpBrfIhbOUjIS_RPlmsvry0ex8IcHNzkHv_hBIrtHvhTBNvELzjKDzdnuviJPneeSw';
window.KIUBO_BRAND_ASSETS=Object.freeze({...current,
  'kinder':'https://blogger.googleusercontent.com/img/a/AVvXsEjhCWtIsLsNpwkLtqVHznwvqoRhanhsB0GanfRzb5QODLbcY_PaeIpYM_atG1Y1FGbRlSP9AO0qL13D67JUbWddLcXnGDsx71-WwmrabZa5phtFj-bgV1B8vLdXgJDX3_a7u1TmUhd2OV6hF-cYb-PX8vVI2HtWnvhh_tOmMYFspUkZ8mjdSklPks8qhGc',
  'halls':HALLS,
  'vivant':VIVANT,
  'fiora':FIORA
});
const A=window.KIUBO_BRAND_ASSETS||{};
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const aliases={mias:'mias',power:'power',powerade:'power',fiora:'fiora',kataboom:'kataboom',manicho:'manicho',tru:'tru'};
const plateNames=new Set(['mias','power','powerade','fiora','kataboom','manicho','tru']);
const scales={mias:'108% auto',power:'98% auto',powerade:'98% auto',fiora:'auto 100%',kataboom:'120% 114%',manicho:'120% 114%',tru:'120% 114%'};
const positions={fiora:'center center'};
const plateColors={mias:'#e6332e',power:'#050505',powerade:'#050505',fiora:'#f92d66',kataboom:'#ec0a76',manicho:'#f47a26',tru:'#0566a8'};

if(!document.getElementById('hmBrandOpticalTuning')){
  const style=document.createElement('style');
  style.id='hmBrandOpticalTuning';
  style.textContent=`
  #homeView [data-brand-chip] .hm-brand-visual.has-image,
  .hm-v104-catalog-brands [data-brand-chip] .hm-brand-visual.has-image{
    width:100%!important;height:100%!important;padding:2px!important;box-sizing:border-box!important;
    display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:14px!important;
  }
  #homeView [data-brand-chip] .hm-brand-visual.has-image img,
  .hm-v104-catalog-brands [data-brand-chip] .hm-brand-visual.has-image img{
    width:96%!important;height:88%!important;max-width:none!important;object-fit:contain!important;display:block!important;margin:auto!important;
  }
  #homeView [data-brand-chip="Natura"] img,.hm-v104-catalog-brands [data-brand-chip="Natura"] img,
  #homeView [data-brand-chip="Inacake"] img,.hm-v104-catalog-brands [data-brand-chip="Inacake"] img,
  #homeView [data-brand-chip="Rellenitas"] img,.hm-v104-catalog-brands [data-brand-chip="Rellenitas"] img{width:106%!important;height:94%!important;}

  /* Vivant stays on a clean white chip; no full-bleed colored plate. */
  #homeView [data-brand-chip="Vivant"],.hm-v104-catalog-brands [data-brand-chip="Vivant"]{
    background:#fff!important;overflow:hidden!important;
  }
  #homeView [data-brand-chip="Vivant"] .hm-brand-visual,.hm-v104-catalog-brands [data-brand-chip="Vivant"] .hm-brand-visual{
    background:#fff!important;padding:3px!important;border-radius:13px!important;
  }
  #homeView [data-brand-chip="Vivant"] img,.hm-v104-catalog-brands [data-brand-chip="Vivant"] img{
    width:96%!important;height:88%!important;object-fit:contain!important;transform:none!important;opacity:1!important;
  }

  #homeView [data-brand-chip="Halls"] .hm-brand-visual,.hm-v104-catalog-brands [data-brand-chip="Halls"] .hm-brand-visual{padding:0!important;background:#fff url('${HALLS}') center/98% 92% no-repeat!important;}
  #homeView [data-brand-chip="Halls"] .hm-brand-visual b,.hm-v104-catalog-brands [data-brand-chip="Halls"] .hm-brand-visual b{display:none!important;}
  .hm1072-search-brands [data-brand-chip] .hm-brand-visual{padding:2px!important;overflow:hidden!important;border-radius:12px!important;}
  .hm1072-search-brands [data-brand-chip] .hm-brand-visual img{width:98%!important;height:92%!important;max-width:none!important;object-fit:contain!important;}
  .hm1072-search-brands [data-brand-chip="Vivant"] .hm-brand-visual{background:#fff!important;padding:3px!important;}
  .hm1072-search-brands [data-brand-chip="Vivant"] img{width:96%!important;height:88%!important;object-fit:contain!important;opacity:1!important;transform:none!important;}
  `;
  document.head.append(style);
}

function applyPlate(chip){
  if(!chip||chip.dataset.hmFullBleed==='1')return;
  const raw=String(chip.dataset.brandChip||'').trim();
  const k=key(raw);
  if(!plateNames.has(k))return;
  const assetKey=aliases[k]||k;
  const url=A[assetKey];
  if(!url)return;
  chip.dataset.hmFullBleed='1';
  chip.style.setProperty('overflow','hidden','important');
  chip.style.setProperty('padding','0','important');
  chip.style.setProperty('background-color',plateColors[k]||'#fff','important');
  chip.style.setProperty('background-image',`url("${url}")`,'important');
  chip.style.setProperty('background-repeat','no-repeat','important');
  chip.style.setProperty('background-position',positions[k]||'center','important');
  chip.style.setProperty('background-size',scales[k]||'120% 114%','important');
  const visual=chip.querySelector('.hm-brand-visual');
  if(visual){
    visual.style.setProperty('width','100%','important');
    visual.style.setProperty('height','100%','important');
    visual.style.setProperty('padding','0','important');
    visual.style.setProperty('margin','0','important');
    visual.style.setProperty('background','transparent','important');
    visual.style.setProperty('border-radius','inherit','important');
    visual.style.setProperty('overflow','hidden','important');
    const img=visual.querySelector('img');
    if(img)img.style.setProperty('opacity','0','important');
    const b=visual.querySelector('b');
    if(b)b.style.setProperty('display','none','important');
  }
}
function apply(){document.querySelectorAll('[data-brand-chip]').forEach(applyPlate)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('kiubo:brands-ready',apply);
})();
