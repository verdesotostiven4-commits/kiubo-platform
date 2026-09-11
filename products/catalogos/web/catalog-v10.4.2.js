/* Hakuna Matata Catalog 10.4.2 — interaction polish on top of Catalog 10.4. */
(()=>{
'use strict';
if(window.__hakunaCatalog1042)return;window.__hakunaCatalog1042=true;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const key=v=>norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const themes={'coca-cola':['#fff','#e31d2b'],'toni':['#3157a2','#fff'],'bubbaloo':['#fff','#144287'],'chiclets':['#ffd72d','#111'],'cheese-tris':['#ff7b1b','#174d93'],'club-social':['#0d4c8e','#fff'],'chiki':['#ef2937','#ffe21c']};
const assets=()=>window.KIUBO_BRAND_ASSETS||{};
function brandVisual(name){const k=key(name),url=assets()[k],t=themes[k]||['#f5f7f4','#294a37'];return url?`<span class="hm-brand-visual has-image"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy" decoding="async"></span>`:`<span class="hm-brand-visual" style="--hm-brand-bg:${t[0]};--hm-brand-fg:${t[1]}"><b>${esc(name)}</b></span>`}
function selectedBrand(){return norm($('#activeFilterHost .v10-active-filter b')?.textContent||'')}
function homeBrandNames(){const out=[],seen=new Set();$$('#homeView .hm-brand-block [data-brand-chip]').forEach(b=>{const n=(b.dataset.brandChip||'').trim(),k=norm(n);if(n&&!seen.has(k)){seen.add(k);out.push(n)}});return out}
function allBrandNames(){const fromRegistry=Array.isArray(window.KIUBO_BRAND_ORDERED)?window.KIUBO_BRAND_ORDERED.filter(Boolean):[];const source=fromRegistry.length?fromRegistry:homeBrandNames();const out=[],seen=new Set();for(const n of source){const k=norm(n);if(!k||seen.has(k))continue;seen.add(k);out.push(n)}return out}
let nudgeTimer=0,nudgeCooldown=0;
function nudgeBrandButton(){const btn=$('#filterBtn');if(!btn||Date.now()<nudgeCooldown)return;nudgeCooldown=Date.now()+850;btn.classList.remove('hm1042-brand-nudge');void btn.offsetWidth;btn.classList.add('hm1042-brand-nudge');clearTimeout(nudgeTimer);nudgeTimer=setTimeout(()=>btn.classList.remove('hm1042-brand-nudge'),1250)}
function ensureCatalogBrands(){
 const shell=$('#catalogView .v10-catalog-head .v10-shell');if(!shell)return;const categories=$('.v10-category-rail',shell);if(!categories)return;
 let rail=$('.hm-v104-catalog-brands',shell);if(!rail){rail=document.createElement('div');rail.className='hm-v104-catalog-brands';categories.insertAdjacentElement('afterend',rail)}
 const names=allBrandNames();if(!names.length)return;const sig=names.map(norm).join('|'),legacySig=homeBrandNames().slice(0,5).map(norm).join('|');
 const expected=names.length+1,needsBuild=rail.dataset.hm1042Signature!==sig||$$('[data-brand-chip]',rail).length!==expected||!!$('.hm-v104-more',rail);
 if(needsBuild){rail.dataset.hm1042Signature=sig;rail.dataset.signature=legacySig;rail.innerHTML=`<button type="button" class="hm1042-all" data-brand-chip="" aria-label="Ver todos los productos"><span>Todos</span></button>`+names.map(name=>`<button type="button" data-brand-chip="${esc(name)}" aria-label="Ver ${esc(name)}">${brandVisual(name)}</button>`).join('')}
 if(!rail.dataset.hm1042Bound){rail.dataset.hm1042Bound='1';let last=rail.scrollLeft;rail.addEventListener('scroll',()=>{const moved=Math.abs(rail.scrollLeft-last)>8;last=rail.scrollLeft;if(moved&&rail.scrollLeft>22)nudgeBrandButton()},{passive:true})}
 const active=selectedBrand();$$('[data-brand-chip]',rail).forEach(btn=>btn.classList.toggle('active',active?norm(btn.dataset.brandChip)===active:btn.dataset.brandChip===''));
 if(rail.dataset.hm1042Active!==active){rail.dataset.hm1042Active=active;requestAnimationFrame(()=>{const target=active?$$('[data-brand-chip]',rail).find(b=>norm(b.dataset.brandChip)===active):$('[data-brand-chip=""]',rail);target?.scrollIntoView({behavior:'smooth',block:'nearest',inline:active?'center':'start'})})}
}
function keepFeaturedInfinite(){const strip=$('#featuredStrip');if(!strip)return;strip.classList.add('hm1042-marquee');/* Catalog 10.2 owns the continuous RAF loop; 10.4.2 only preserves its clones visually. */}
let lastY=window.scrollY,headHidden=false;
function setHeadHidden(next){const head=$('#catalogView .v10-catalog-head');if(!head||headHidden===next)return;headHidden=next;head.classList.toggle('hm1042-catalog-hidden',next)}
function handleVerticalScroll(){const active=$('#catalogView.v10-view.active'),y=window.scrollY,dy=y-lastY;lastY=y;if(!active){setHeadHidden(false);return}if(y<115){setHeadHidden(false);return}if(document.activeElement?.id==='catalogSearch')return setHeadHidden(false);if(dy>5&&y>175)setHeadHidden(true);else if(dy<-3)setHeadHidden(false)}
function decorateOrdersEmpty(){const empty=$('#ordersView .v10-empty.big');if(!empty||empty.dataset.hm1042==='1')return;empty.dataset.hm1042='1';empty.classList.add('hm1042-orders-empty');const old=$('.hm-empty-art',empty)||$('svg',empty);if(old){const art=document.createElement('div');art.className='hm1042-order-art';art.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="24" y="18" width="72" height="84" rx="20"/><path d="M42 46h36M42 60h28M42 74h20"/><circle cx="84" cy="82" r="14"/><path d="m78 82 5 5 9-11"/></svg>';old.replaceWith(art)}}
function refineHome(){const home=$('#homeView .v10-home');if(!home)return;keepFeaturedInfinite();$('.hm-slide-main',home)?.classList.add('hm1042-reference-hero')}
function enhance(){ensureCatalogBrands();refineHome();decorateOrdersEmpty();document.documentElement.dataset.hmCatalog='10.4.2'}
let raf=0;function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})}
window.addEventListener('scroll',handleVerticalScroll,{passive:true});document.addEventListener('focusin',e=>{if(e.target?.id==='catalogSearch')setHeadHidden(false)});document.addEventListener('click',e=>{if(e.target.closest?.('#filterBtn'))setHeadHidden(false);schedule()},true);window.addEventListener('popstate',schedule);window.addEventListener('pageshow',schedule);
const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
