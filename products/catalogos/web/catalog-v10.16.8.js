/* Hakuna Catalog 10.16.8 — fluid brand marquee + preserved blurred detail background. */
(()=>{
'use strict';
if(window.__hm1168Catalog)return;window.__hm1168Catalog=true;
if(/^\/(?:panel|master|pedido)(?:\/|$)/.test(location.pathname))return;

const root=document.documentElement;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const norm=(v='')=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

let marqueeSeq=0,uiRaf=0,detailOpen=false,detailOriginY=null;

function sourceBrands(){
  const source=$('.hm-v104-catalog-brands');
  if(!source)return{source:null,buttons:[]};
  const buttons=$$(':scope > [data-brand-chip]',source).filter(b=>String(b.dataset.brandChip||'').trim());
  return{source,buttons};
}
function signature(buttons){
  return buttons.map(b=>`${norm(b.dataset.brandChip||'')}:${b.querySelector('img')?.getAttribute('src')||''}`).join('|');
}
function cloneBrand(button,copy){
  const clone=button.cloneNode(true);
  const name=button.dataset.brandChip||'';
  clone.removeAttribute('data-brand-chip');
  clone.dataset.hm1168Brand=name;
  clone.dataset.hm1168Copy=String(copy);
  clone.classList.remove('active');
  clone.classList.add('hm1168-brand-chip');
  clone.querySelectorAll('img').forEach(img=>{
    img.loading='eager';img.decoding='async';
    try{img.fetchPriority='auto'}catch{}
  });
  return clone;
}
function syncActive(viewport,source){
  if(!viewport||!source)return;
  const active=[...source.querySelectorAll(':scope > [data-brand-chip].active')]
    .find(b=>String(b.dataset.brandChip||'').trim());
  const name=norm(active?.dataset.brandChip||'');
  $$('[data-hm1168-brand]',viewport).forEach(b=>{
    b.classList.toggle('active',!!name&&norm(b.dataset.hm1168Brand||'')===name);
  });
}
function startMarquee(viewport){
  const track=$('.hm1168-brand-track',viewport);
  const first=$('.hm1168-segment[data-copy="1"]',viewport);
  const second=$('.hm1168-segment[data-copy="2"]',viewport);
  if(!track||!first||!second)return;
  const seq=++marqueeSeq;
  let offset=0,last=performance.now(),drag=null,suppressClickUntil=0;
  const speed=.026;
  const loopWidth=()=>Math.max(0,second.offsetLeft-first.offsetLeft);
  const wrap=()=>{
    const w=loopWidth();
    if(!w)return;
    offset%=w;
    if(offset<0)offset+=w;
  };
  const paint=()=>{track.style.transform=`translate3d(${-offset}px,0,0)`};

  viewport.addEventListener('pointerdown',e=>{
    if(!e.isPrimary)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:offset,mode:'',moved:false};
    try{viewport.setPointerCapture(e.pointerId)}catch{}
  },{passive:true});

  viewport.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.mode){
      if(Math.max(Math.abs(dx),Math.abs(dy))<5)return;
      drag.mode=Math.abs(dx)>Math.abs(dy)*1.08?'horizontal':'vertical';
    }
    if(drag.mode!=='horizontal')return;
    e.preventDefault();
    drag.moved=drag.moved||Math.abs(dx)>7;
    offset=drag.start-dx;
    wrap();paint();
  },{passive:false});

  const end=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(drag.mode==='horizontal'&&drag.moved)suppressClickUntil=performance.now()+260;
    drag=null;last=performance.now();
  };
  viewport.addEventListener('pointerup',end,{passive:true});
  viewport.addEventListener('pointercancel',end,{passive:true});

  viewport.addEventListener('click',e=>{
    if(performance.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();return}
    const chip=e.target.closest?.('[data-hm1168-brand]');
    if(!chip)return;
    e.preventDefault();e.stopPropagation();
    const name=norm(chip.dataset.hm1168Brand||'');
    const source=$('.hm-v104-catalog-brands');
    const real=source?[...source.querySelectorAll(':scope > [data-brand-chip]')]
      .find(b=>norm(b.dataset.brandChip||'')===name):null;
    real?.click();
  },true);

  const tick=now=>{
    if(seq!==marqueeSeq||!viewport.isConnected)return;
    const dt=Math.min(34,Math.max(0,now-last));last=now;
    if(!drag&&document.visibilityState==='visible'){
      offset+=dt*speed;wrap();paint();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(()=>{wrap();paint();requestAnimationFrame(tick)});
}
function buildMarquee(){
  const {source,buttons}=sourceBrands();
  if(!source||buttons.length<2)return;
  source.classList.add('hm1168-brand-source');

  const sig=signature(buttons);
  let viewport=$('#hm1168BrandMarquee');
  if(viewport&&viewport.dataset.signature===sig){
    syncActive(viewport,source);
    return;
  }
  marqueeSeq++;
  $('#hm1167BrandMarquee')?.remove();
  viewport?.remove();

  viewport=document.createElement('div');
  viewport.id='hm1168BrandMarquee';
  viewport.className='hm1168-brand-marquee';
  viewport.dataset.signature=sig;

  const track=document.createElement('div');
  track.className='hm1168-brand-track';
  for(const copy of [1,2]){
    const segment=document.createElement('div');
    segment.className='hm1168-segment';
    segment.dataset.copy=String(copy);
    buttons.forEach(b=>segment.append(cloneBrand(b,copy)));
    track.append(segment);
  }
  viewport.append(track);
  source.insertAdjacentElement('afterend',viewport);
  syncActive(viewport,source);
  requestAnimationFrame(()=>requestAnimationFrame(()=>startMarquee(viewport)));
}

function rememberOrigin(target){
  if(target?.closest?.('#catalogView.active [data-open]'))detailOriginY=window.scrollY;
}
function syncDetailBackground(){
  const open=!!$('#sheetHost .v102-detail');
  if(open&&!detailOpen){
    detailOpen=true;
    const y=Math.max(0,Number(detailOriginY??window.scrollY));
    detailOriginY=y;
    root.classList.add('hm1168-detail-open');
    requestAnimationFrame(()=>{
      if(Math.abs(window.scrollY-y)>2)window.scrollTo(0,y);
      requestAnimationFrame(()=>{if(Math.abs(window.scrollY-y)>2)window.scrollTo(0,y)});
    });
  }else if(!open&&detailOpen){
    detailOpen=false;
    root.classList.remove('hm1168-detail-open');
    const y=detailOriginY;detailOriginY=null;
    if(Number.isFinite(y)){
      requestAnimationFrame(()=>{if(Math.abs(window.scrollY-y)>2)window.scrollTo(0,y)});
    }
  }
}

function sync(){
  uiRaf=0;
  buildMarquee();
  syncDetailBackground();
  root.dataset.hmCatalogClient='10.16.8';
}
function schedule(){if(uiRaf)return;uiRaf=requestAnimationFrame(sync)}

document.addEventListener('pointerdown',e=>rememberOrigin(e.target),true);
window.addEventListener('pageshow',schedule);
window.addEventListener('resize',schedule,{passive:true});
new MutationObserver(schedule).observe(document.documentElement,{
  childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','src']
});
const start=()=>{buildMarquee();syncDetailBackground();schedule()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
