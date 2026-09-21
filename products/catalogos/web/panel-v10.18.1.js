/* Hakuna Panel 10.18.2 — compact product editor + explicit catalog cover. */
(()=>{
'use strict';
if(window.__hm1181Panel)return;window.__hm1181Panel=true;
if(!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname))return;

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let raf=0;
const modal=()=>$('#productModal');
const modalOpen=()=>{const m=modal();return Boolean(m&&!m.hidden&&m.classList.contains('visible'))};
const rows=()=>$$('.v5-presentation-row');
const rowVisible=r=>$('[data-hm-visible]',r)?.checked!==false;
const rowUnits=r=>Math.max(1,Number($('[data-p-units]',r)?.value||1));
const rowName=r=>$('[data-p-name]',r)?.value?.trim()||(rowUnits(r)===1?'Unidad':'Caja / jaba');
const savedFor=r=>(window.__hm111Presentations||[]).find(p=>String(p.id)===String(r?.dataset?.id||''))||null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0));

function fallbackImage(){
  return $('#productImagePreview img')?.getAttribute('src')||'';
}
function rowImage(r){
  const saved=savedFor(r);
  return r?.dataset?.hm109ImageUrl||r?.dataset?.hm108ImageUrl||saved?.image_url||fallbackImage()||'';
}
function rowLabel(r){return rowUnits(r)===1?'Unidad':rowName(r)}
function currentCover(){
  const active=rows().filter(rowVisible);
  return active.find(r=>$('[data-p-default]',r)?.checked)||active[0]||null;
}
function chooseCover(r){
  if(!r)return;
  const radio=$('[data-p-default]',r);
  if(radio&&!radio.checked){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}))}
  schedule();
  setTimeout(schedule,40);
}

function ensureCoverChoice(){
  const ed=$('#v5ProductEditor'),sale=$('#hm111SaleMode');if(!ed||!sale)return;
  let box=$('#hm1181Cover',ed);
  if(!box){
    box=document.createElement('section');box.id='hm1181Cover';box.className='hm1181-cover';
    box.innerHTML='<header><div><small>PORTADA DEL CATÁLOGO</small><h3>¿Qué verá primero el cliente?</h3><p></p></div><em></em></header><div class="hm1181-cover-grid"></div>';
    sale.insertAdjacentElement('afterend',box);
  }
  const active=rows().filter(rowVisible);if(!active.length){box.hidden=true;return}box.hidden=false;
  const cover=currentCover();if(cover&&!$('[data-p-default]',cover)?.checked)chooseCover(cover);
  const p=$('header p',box),badge=$('header em',box),grid=$('.hm1181-cover-grid',box);
  if(p)p.textContent=active.length>1?'Toca la presentación que quieres usar como foto y precio principal del catálogo.':'Esta presentación será la portada automáticamente.';
  if(badge)badge.textContent=active.length>1?'ELIGE 1':'AUTOMÁTICA';
  grid.innerHTML=active.map(r=>{
    const index=rows().indexOf(r),selected=r===cover,src=rowImage(r),name=rowLabel(r),price=Number($('[data-p-price]',r)?.value||0);
    return `<button type="button" data-hm1181-cover="${index}" class="${selected?'active':''}" aria-pressed="${selected}"><span class="hm1181-cover-photo">${src?`<img src="${esc(src)}" alt="">`:'<b>+</b>'}</span><span class="hm1181-cover-copy"><b>${esc(name)}</b><small>${money(price)} · ${selected?'Portada actual':'Usar como portada'}</small></span><i>${selected?'✓':'›'}</i></button>`;
  }).join('');
  $$('[data-hm1181-cover]',grid).forEach(button=>button.onclick=()=>chooseCover(rows()[Number(button.dataset.hm1181Cover||0)]));
}

function exposePresentationPhotos(){
  const cover=currentCover();
  rows().forEach(r=>{
    const box=$('.v77-presentation-image',r);if(!box)return;
    const on=rowVisible(r);box.hidden=!on;box.classList.toggle('hm1181-presentation-photo',on);box.classList.toggle('is-cover',on&&r===cover);
    if(!on)return;
    const title=$('.v77-presentation-image-copy b',box),copy=$('.v77-presentation-image-copy small',box),name=rowLabel(r),ready=Boolean(r.dataset.id);
    if(title)title.textContent=`Foto de ${name}${r===cover?' · portada':''}`;
    if(copy)copy.textContent=!ready?'Guarda el producto una vez para habilitar esta foto.':r===cover?'Esta imagen representa al producto en el catálogo.':'Se mostrará cuando el cliente elija esta presentación.';
  });
}

function ensureFallbackPhoto(){
  const ed=$('#v5ProductEditor'),main=$('.product-image-upload');if(!ed||!main)return;
  let details=main.closest('.hm1181-fallback-photo');
  if(!details){
    details=document.createElement('details');details.className='hm1181-fallback-photo';
    details.innerHTML='<summary><span><b>Foto general de respaldo</b><small>Opcional · solo si una presentación no tiene foto propia</small></span><i>+</i></summary><div class="hm1181-fallback-body"></div>';
    ed.append(details);$('.hm1181-fallback-body',details).append(main);
  }
  const title=$('label b',main),hint=$('label small',main);
  if(title)title.textContent='Foto general del producto';
  if(hint)hint.textContent='Se usa como respaldo. Las fotos principales se eligen arriba por presentación.';
  const existing=rows().some(r=>Boolean(r.dataset.id));if(!existing)details.open=true;
}

function ensureOptionalDetails(){
  const form=$('#productForm'),ed=$('#v5ProductEditor'),sku=$('#productSku')?.closest('.field'),desc=$('#productDescription')?.closest('.field');
  if(!form||!ed||!sku||!desc)return;
  let details=$('#hm1181More',form);
  if(!details){
    details=document.createElement('details');details.id='hm1181More';details.className='hm1181-more';
    details.innerHTML='<summary><span><b>Más datos del producto</b><small>SKU y descripción · opcional</small></span><i>+</i></summary><div></div>';
    form.insertBefore(details,ed);
    const body=$(':scope>div',details);body.append(sku,desc);
  }
}

function ensurePublishing(){
  const form=$('#productForm'),ed=$('#v5ProductEditor'),status=$('#productStatus')?.closest('.field'),visible=$('#productVisible')?.closest('.switch-row'),featured=$('#productFeatured')?.closest('.switch-row');
  if(!form||!ed||!status||!visible||!featured)return;
  let box=$('#hm1181Publish',form);
  if(!box){
    box=document.createElement('section');box.id='hm1181Publish';box.className='hm1181-publish';
    box.innerHTML='<header><small>PUBLICACIÓN</small><h3>¿Cómo aparece en el catálogo?</h3><p>Disponibilidad, visibilidad y destacados en un solo lugar.</p></header><div></div>';
    ed.insertAdjacentElement('afterend',box);
    const body=$(':scope>div',box);body.append(status,visible,featured);
  }
  const label=$('label',status);if(label)label.textContent='Estado de venta';
  const vb=$('b',visible),vs=$('small',visible),fb=$('b',featured),fs=$('small',featured);
  if(vb)vb.textContent='Mostrar en el catálogo';if(vs)vs.textContent='Apágalo para ocultarlo sin eliminarlo.';
  if(fb)fb.textContent='Destacar en Inicio';if(fs)fs.textContent='Muéstralo en Productos destacados cuando quieras darle más visibilidad.';
}

function compactExample(){
  const intro=$('.v75-presentation-intro');if(!intro||intro.dataset.hm1181==='1')return;
  intro.dataset.hm1181='1';intro.innerHTML='<details><summary>¿Cómo funciona Unidad + caja?</summary><p>Unidad = 1. Jaba x 9 = 9. Ambas descuentan del mismo inventario.</p></details>';
}

function decorateProductCards(){
  const all=window.__hm111Presentations||[];
  $$('#adminProductList .admin-product').forEach(card=>{
    const id=$('[data-edit-product]',card)?.dataset.editProduct;if(!id)return;
    const options=all.filter(p=>String(p.product_id)===String(id)&&p.visible!==false).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
    const d=options.find(p=>p.is_default)||options[0];if(!d)return;
    const image=$('.admin-product__image',card);
    if(d.image_url&&image?.dataset.hm1181Image!==d.image_url){image.dataset.hm1181Image=d.image_url;image.innerHTML=`<img src="${esc(d.image_url)}" alt="">`}
    const copy=$('.admin-product__copy p',card);if(copy){const cat=String(copy.textContent||'').split('·')[0].trim(),next=`${cat} · ${d.name||'Unidad'}`;if(copy.textContent!==next)copy.textContent=next}
    const price=$('.admin-product__copy strong',card);if(price){const next=money(d.price);if(price.textContent!==next)price.textContent=next}
  });
  $$('#attentionProducts [data-edit-product]').forEach(card=>{
    const id=card.dataset.editProduct,options=all.filter(p=>String(p.product_id)===String(id)&&p.visible!==false),d=options.find(p=>p.is_default)||options[0],img=$('.attention-item__image',card);
    if(d?.image_url&&img?.dataset.hm1181Image!==d.image_url){img.dataset.hm1181Image=d.image_url;img.innerHTML=`<img src="${esc(d.image_url)}" alt="">`}
  });
}

function enhance(){
  decorateProductCards();
  if(!modalOpen())return;
  const ed=$('#v5ProductEditor');if(!ed)return;
  modal().classList.add('hm1181-editor');
  ensureCoverChoice();exposePresentationPhotos();ensureFallbackPhoto();ensureOptionalDetails();ensurePublishing();compactExample();
}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;enhance()})}

document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-edit-product],#newProductBtn,#mobileCreateBtn,[data-quick="new-product"],#hm111SaleMode [data-m]'))[30,90,180,320].forEach(ms=>setTimeout(schedule,ms));
},true);
document.addEventListener('change',e=>{if(e.target?.matches?.('[data-p-default],[data-hm-visible],.v77-presentation-file'))setTimeout(schedule,20)},true);
document.addEventListener('input',e=>{if(e.target?.matches?.('[data-p-name],[data-p-units],[data-p-price]'))setTimeout(schedule,20)},true);
window.addEventListener('hm111:presentations',()=>setTimeout(schedule,20));
window.addEventListener('hm108:photo-saved',()=>setTimeout(schedule,50));
const m=modal();if(m)new MutationObserver(()=>schedule()).observe(m,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
const list=$('#adminProductList');if(list)new MutationObserver(()=>schedule()).observe(list,{childList:true,subtree:true});
const start=()=>{schedule();document.documentElement.dataset.hmProductEditor='10.18.2'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();