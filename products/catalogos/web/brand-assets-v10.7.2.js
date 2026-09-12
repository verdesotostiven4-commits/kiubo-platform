/* Hakuna Matata 10.7.2 — verified brand assets + optical brand tuning. */
(()=>{
'use strict';
const current=window.KIUBO_BRAND_ASSETS||{};
const HALLS='https://blogger.googleusercontent.com/img/a/AVvXsEgbQYF-4TAbUEmeIDMmF6BEQEd8x7s22rHzckWMSpF5LJluu8_Tq48tzEuc8xKQFWZkv7m78rxOmRWeHYdXQSz7YLvyk8_xsDn7fjGxxLyuH_OLsZfr4j_pCelg4yRKSqDMrdgAvyergqaMUmB8fSb6hGn6_Cx0-H1Bk9caBSGCiHRRQuogmV3H1FUW5no';
window.KIUBO_BRAND_ASSETS=Object.freeze({...current,
  'kinder':'https://blogger.googleusercontent.com/img/a/AVvXsEjhCWtIsLsNpwkLtqVHznwvqoRhanhsB0GanfRzb5QODLbcY_PaeIpYM_atG1Y1FGbRlSP9AO0qL13D67JUbWddLcXnGDsx71-WwmrabZa5phtFj-bgV1B8vLdXgJDX3_a7u1TmUhd2OV6hF-cYb-PX8vVI2HtWnvhh_tOmMYFspUkZ8mjdSklPks8qhGc',
  'halls':HALLS
});
if(document.getElementById('hmBrandOpticalTuning'))return;
const style=document.createElement('style');
style.id='hmBrandOpticalTuning';
style.textContent=`
/* Brand logos: use more of the chip instead of looking tiny inside it. */
#homeView [data-brand-chip] .hm-brand-visual.has-image,
.hm-v104-catalog-brands [data-brand-chip] .hm-brand-visual.has-image{
  width:100%!important;height:100%!important;padding:2px!important;box-sizing:border-box!important;
  display:grid!important;place-items:center!important;overflow:hidden!important;border-radius:12px!important;
}
#homeView [data-brand-chip] .hm-brand-visual.has-image img,
.hm-v104-catalog-brands [data-brand-chip] .hm-brand-visual.has-image img{
  width:94%!important;height:84%!important;max-width:none!important;object-fit:contain!important;
  display:block!important;margin:auto!important;
}
/* Horizontal/compact logos get a little more presence. */
#homeView [data-brand-chip="Chips Ahoy!"] img,.hm-v104-catalog-brands [data-brand-chip="Chips Ahoy!"] img,
#homeView [data-brand-chip="Ritz"] img,.hm-v104-catalog-brands [data-brand-chip="Ritz"] img,
#homeView [data-brand-chip="Club Social"] img,.hm-v104-catalog-brands [data-brand-chip="Club Social"] img,
#homeView [data-brand-chip="Chiki"] img,.hm-v104-catalog-brands [data-brand-chip="Chiki"] img,
#homeView [data-brand-chip="Galak"] img,.hm-v104-catalog-brands [data-brand-chip="Galak"] img,
#homeView [data-brand-chip="Yogu Yogu"] img,.hm-v104-catalog-brands [data-brand-chip="Yogu Yogu"] img{
  width:100%!important;height:90%!important;
}
/* Artwork that already contains its own colored plate should visually become the chip. */
#homeView [data-brand-chip="Mías"],.hm-v104-catalog-brands [data-brand-chip="Mías"]{background:#e4312c!important;overflow:hidden!important;}
#homeView [data-brand-chip="Mías"] .hm-brand-visual,.hm-v104-catalog-brands [data-brand-chip="Mías"] .hm-brand-visual{padding:0!important;border-radius:inherit!important;}
#homeView [data-brand-chip="Mías"] img,.hm-v104-catalog-brands [data-brand-chip="Mías"] img{
  width:116%!important;height:112%!important;object-fit:cover!important;transform:scale(1.08)!important;
}
#homeView [data-brand-chip="Power"] .hm-brand-visual,#homeView [data-brand-chip="Powerade"] .hm-brand-visual,
.hm-v104-catalog-brands [data-brand-chip="Power"] .hm-brand-visual,.hm-v104-catalog-brands [data-brand-chip="Powerade"] .hm-brand-visual,
#homeView [data-brand-chip="Vivant"] .hm-brand-visual,.hm-v104-catalog-brands [data-brand-chip="Vivant"] .hm-brand-visual{
  padding:0!important;
}
#homeView [data-brand-chip="Power"] img,#homeView [data-brand-chip="Powerade"] img,
.hm-v104-catalog-brands [data-brand-chip="Power"] img,.hm-v104-catalog-brands [data-brand-chip="Powerade"] img{
  width:112%!important;height:100%!important;object-fit:cover!important;transform:scale(1.07)!important;
}
#homeView [data-brand-chip="Vivant"] img,.hm-v104-catalog-brands [data-brand-chip="Vivant"] img{
  width:110%!important;height:100%!important;object-fit:cover!important;transform:scale(1.06)!important;
}
#homeView [data-brand-chip="Natura"] img,.hm-v104-catalog-brands [data-brand-chip="Natura"] img,
#homeView [data-brand-chip="Inacake"] img,.hm-v104-catalog-brands [data-brand-chip="Inacake"] img,
#homeView [data-brand-chip="Rellenitas"] img,.hm-v104-catalog-brands [data-brand-chip="Rellenitas"] img{
  width:106%!important;height:94%!important;
}
/* Halls: guarantee the supplied artwork even if an older fallback was already rendered. */
#homeView [data-brand-chip="Halls"] .hm-brand-visual,
.hm-v104-catalog-brands [data-brand-chip="Halls"] .hm-brand-visual{
  padding:0!important;background:#fff url('${HALLS}') center/96% 90% no-repeat!important;
}
#homeView [data-brand-chip="Halls"] .hm-brand-visual b,
.hm-v104-catalog-brands [data-brand-chip="Halls"] .hm-brand-visual b{display:none!important;}
#homeView [data-brand-chip="Halls"] .hm-brand-visual img,
.hm-v104-catalog-brands [data-brand-chip="Halls"] .hm-brand-visual img{width:100%!important;height:94%!important;object-fit:contain!important;}
/* Same optical sizing inside search brand suggestions. */
.hm1072-search-brands [data-brand-chip] .hm-brand-visual{padding:2px!important;overflow:hidden!important;}
.hm1072-search-brands [data-brand-chip] .hm-brand-visual img{width:96%!important;height:90%!important;max-width:none!important;object-fit:contain!important;}
.hm1072-search-brands [data-brand-chip="Mías"] .hm-brand-visual{padding:0!important;background:#e4312c!important;}
.hm1072-search-brands [data-brand-chip="Mías"] img{width:116%!important;height:112%!important;object-fit:cover!important;transform:scale(1.08)!important;}
.hm1072-search-brands [data-brand-chip="Power"] img,.hm1072-search-brands [data-brand-chip="Powerade"] img{width:112%!important;height:100%!important;object-fit:cover!important;}
.hm1072-search-brands [data-brand-chip="Vivant"] img{width:110%!important;height:100%!important;object-fit:cover!important;}
.hm1072-search-brands [data-brand-chip="Halls"] .hm-brand-visual{padding:0!important;background:#fff url('${HALLS}') center/96% 90% no-repeat!important;}
.hm1072-search-brands [data-brand-chip="Halls"] .hm-brand-visual b{display:none!important;}
`;
document.head.append(style);
})();
