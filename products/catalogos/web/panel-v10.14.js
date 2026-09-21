/* Hakuna Panel 10.14 — simple product editor for real-world unit/pack workflows. */
(()=>{
'use strict';
if(window.__hm114Panel)return;window.__hm114Panel=true;
if(!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const slug=()=>((new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata').toLowerCase().replace(/[^a-z0-9-]/g,''));
const baseFetch=window.fetch.bind(window);
let raf=0,categoryValue='',categoryObserver=null,lastOpenedId='';

const modalOpen=()=>{const m=$('#productModal');return Boolean(m&&!m.hidden&&m.classList.contains('visible'))};
const rows=()=>$$('.v5-presentation-row');
const rowUnits=r=>Math.max(1,Number($('[data-p-units]',r)?.value||1));
const rowName=r=>$('[data-p-name]',r)?.value?.trim()|| (rowUnits(r)===1?'Unidad':'Caja / jaba');
const rowVisible=r=>$('[data-hm-visible]',r)?.checked!==false;
const unitRow=()=>rows().find(r=>rowUnits(r)===1)||null;
const packRow=()=>rows().find(r=>rowUnits(r)>1)||null;
const currentMode=()=>{
  const active=rows().filter(rowVisible),u=active.some(r=>rowUnits(r)===1),p=active.some(r=>rowUnits(r)>1);
  return u&&p?'both':p?'pack':'unit';
};
function setLabel(label,text){if(!label)return;const n=[...label.childNodes].find(x=>x.nodeType===Node.TEXT_NODE);if(n&&n.nodeValue.trim()!==text)n.nodeValue=`${text} `}
function toast(msg,type=''){const e=document.createElement('div');e.className=`hm114-toast ${type}`;e.textContent=msg;document.body.append(e);requestAnimationFrame(()=>e.classList.add('show'));setTimeout(()=>{e.classList.remove('show');setTimeout(()=>e.remove(),160)},2400)}

/* Category select used to be rebuilt by renderAll(), silently resetting an open editor to “Sin categoría”. */
function installCategoryGuard(){
  const sel=$('#productCategory');if(!sel||sel.dataset.hm114Guard==='1')return;
  sel.dataset.hm114Guard='1';
  sel.addEventListener('change',()=>{if(modalOpen())categoryValue=sel.value});
  categoryObserver?.disconnect();
  categoryObserver=new MutationObserver(()=>{
    if(!modalOpen())return;
    const wanted=categoryValue;
    if(wanted!==sel.value&&[...sel.options].some(o=>o.value===wanted))sel.value=wanted;
  });
  categoryObserver.observe(sel,{childList:true});
}
function armCategory(id=''){
  lastOpenedId=id||'';categoryValue='';
  [20,55,110].forEach(ms=>setTimeout(()=>{
    const sel=$('#productCategory');if(!modalOpen()||!sel)return;
    if(sel.value||!categoryValue)categoryValue=sel.value;
  },ms));
}

function ensureModeDefault(mode){
  const u=unitRow(),p=packRow(),current=rows().find(r=>rowVisible(r)&&$('[data-p-default]',r)?.checked);let wanted=null;
  if(mode==='unit')wanted=u;
  else if(mode==='pack')wanted=p;
  else wanted=current||p||u;
  if(!wanted)return;
  const radio=$('[data-p-default]',wanted);if(radio&&!radio.checked)radio.checked=true;
}
function decorateMode(mode){
  const box=$('#hm111SaleMode');if(!box)return;
  box.classList.add('hm114-sale-mode');
  const small=$('small',box),h=$('h3',box),p=$('p',box);
  if(small&&small.textContent!=='FORMA DE VENTA')small.textContent='FORMA DE VENTA';
  if(h&&h.textContent!=='¿Cómo vendes este producto?')h.textContent='¿Cómo vendes este producto?';
  if(p&&p.textContent!=='Elige una opción. El sistema se encarga del resto.')p.textContent='Elige una opción. El sistema se encarga del resto.';
  $$('[data-m]',box).forEach(b=>{b.classList.toggle('hm114-active',b.dataset.m===mode);b.setAttribute('aria-pressed',String(b.dataset.m===mode))});
}
function addRowHead(r,mode){
  let head=$('.hm114-row-head',r);if(!head){head=document.createElement('div');head.className='hm114-row-head';r.prepend(head)}
  const isUnit=rowUnits(r)===1;
  const headTitle=isUnit?'Venta por unidad':'Venta por caja / jaba / pack',headCopy=isUnit?'El cliente compra unidades sueltas.':'El cliente compra el paquete completo.';
  if(!head.dataset.hm114Built){head.dataset.hm114Built='1';head.innerHTML='<span class="hm114-row-icon"></span><span><b></b><small></small></span>'}
  const hi=$('.hm114-row-icon',head),hb=$('b',head),hs=$('small',head);if(hi&&hi.textContent!==(isUnit?'1':'×'))hi.textContent=isUnit?'1':'×';if(hb&&hb.textContent!==headTitle)hb.textContent=headTitle;if(hs&&hs.textContent!==headCopy)hs.textContent=headCopy;
  r.classList.toggle('hm114-unit-row',isUnit);r.classList.toggle('hm114-pack-row',!isUnit);
  const name=$('[data-p-name]',r)?.closest('label'),units=$('[data-p-units]',r)?.closest('label'),price=$('[data-p-price]',r)?.closest('label'),unit=$('[data-p-unit]',r)?.closest('label');
  [name,units,price,unit].forEach(x=>x?.classList.remove('hm114-field-hidden'));
  if(isUnit){name?.classList.add('hm114-field-hidden');units?.classList.add('hm114-field-hidden');unit?.classList.add('hm114-field-hidden');setLabel(price,'Precio por unidad')}
  else{unit?.classList.add('hm114-field-hidden');setLabel(name,'Cómo se vende');setLabel(units,'Unidades que contiene');setLabel(price,'Precio de venta')}
  const promo=$('.hm111-toggle.promo b',r);if(promo&&promo.textContent!=='¿Está en oferta?')promo.textContent='¿Está en oferta?';
  const promoLabels=$$('.hm111-promo-fields label',r);if(promoLabels[0])setLabel(promoLabels[0],'Precio de oferta');if(promoLabels[1])promoLabels[1].classList.add('hm114-field-hidden');
  const tools=$('.hm111-presentation-tools',r);tools?.classList.add('hm114-tools');
  $('.hm111-toggle:not(.promo)',r)?.classList.add('hm114-field-hidden');
  $('.hm111-price-summary',r)?.classList.add('hm114-field-hidden');
  $('.v5-default',r)?.classList.add('hm114-field-hidden');
  $('.v5-remove-presentation',r)?.classList.add('hm114-field-hidden');

  const cost=$('.v6-cost-block',r);
  if(cost){
    let details=$('.hm114-cost-details',r);
    if(!details){details=document.createElement('details');details.className='hm114-cost-details';details.innerHTML='<summary>Costo y rentabilidad <span>opcional</span></summary>';tools?.after(details);details.append(cost)}
  }

  const active=rowVisible(r);
  r.classList.toggle('hm114-row-disabled',!active);
}
function decoratePhotos(mode){
  const defaultRow=rows().find(r=>$('[data-p-default]',r)?.checked)||null;
  rows().forEach(r=>{
    const box=$('.v77-presentation-image',r);if(!box)return;
    const show=mode==='both'&&rowVisible(r)&&r!==defaultRow;
    box.hidden=!show;box.classList.toggle('hm114-secondary-photo',show);
    if(show){const title=$('.v77-presentation-image-copy b',box),copy=$('.v77-presentation-image-copy small',box);if(title)title.textContent='Foto diferente (opcional)';if(copy&&!String(copy.textContent||'').includes('Guardada'))copy.textContent='Solo úsala si esta presentación se ve diferente a la foto principal.'}
  });
  const main=$('.product-image-upload');if(main){
    main.classList.add('hm114-main-photo');const title=$('label b',main),hint=$('label small',main);
    if(title&&title.textContent!=='Foto del producto')title.textContent='Foto del producto';
    if(hint){const next=mode==='both'?'Esta es la foto principal. La segunda presentación puede tener otra foto opcional.':'Una sola foto es suficiente para este producto.';if(hint.textContent!==next)hint.textContent=next}
  }
}
function decorateStock(mode){
  const stock=$('#hm111Stock'),sale=$('#hm111SaleMode');if(!stock)return;
  stock.classList.add('hm114-stock');if(sale&&sale.nextElementSibling!==stock)sale.after(stock);
  const title=$('.hm111-stock-title',stock);if(title){const small=$('small',title),b=$('b',title),p=$('p',title);if(small&&small.textContent!=='INVENTARIO')small.textContent='INVENTARIO';if(b&&b.textContent!=='¿Cuánto tienes?')b.textContent='¿Cuánto tienes?';const copy=mode==='unit'?'Escribe cuántas unidades tienes disponibles.':mode==='pack'?'Escribe cuántas cajas o jabas completas tienes.':'Escribe cajas/jabas completas y las unidades sueltas.';if(p&&p.textContent!==copy)p.textContent=copy}
  const fields=$$('.hm111-stock-fields > label',stock),sel=$('#hm111StockPresentation',stock),packs=$('#hm111Packs',stock),loose=$('#hm111Loose',stock),under=$('#v5StockQuantity');
  const u=unitRow(),p=packRow(),target=mode==='unit'?u:(p||u),targetIndex=Math.max(0,rows().indexOf(target));
  if(sel&&String(sel.value)!==String(targetIndex))sel.value=String(targetIndex);
  const units=target?rowUnits(target):1,q=Math.max(0,Math.trunc(Number(under?.value||0)));
  if(!stock.contains(document.activeElement)){
    if(packs)packs.value=String(mode==='unit'?q:Math.floor(q/units));
    if(loose)loose.value=String(mode==='unit'?0:q%units);
  }
  if(fields[0])fields[0].classList.add('hm114-field-hidden');
  if(fields[1])setLabel(fields[1],mode==='unit'?'Unidades disponibles':`${rowName(target)} disponibles`);
  if(fields[2]){fields[2].classList.toggle('hm114-field-hidden',mode!=='both');if(mode==='both')setLabel(fields[2],'Unidades sueltas')}
  stock.classList.toggle('hm114-stock-single',mode!=='both');

  let track=$('#hm114Track',stock);if(!track){
    track=document.createElement('label');track.id='hm114Track';track.className='hm114-track';track.innerHTML='<span><b>Controlar inventario</b><small>Actívalo para evitar vender más de lo que tienes.</small></span><input type="checkbox"><i></i>';title?.after(track);
    const input=$('input',track);input.addEventListener('change',()=>{const old=$('#v5StockTracking');if(old){old.checked=input.checked;old.dispatchEvent(new Event('change',{bubbles:true}))}});
  }
  const oldTrack=$('#v5StockTracking'),trackInput=$('input',track);if(oldTrack&&trackInput&&trackInput.checked!==oldTrack.checked)trackInput.checked=oldTrack.checked;

  let note=$('.hm114-stock-note',stock);if(!note){note=document.createElement('p');note.className='hm114-stock-note';$('.hm111-stock-result',stock)?.after(note)}
  if(note){const rem=mode==='pack'?q%units:0;note.textContent=mode==='pack'&&rem?`Además hay ${rem} ${rem===1?'unidad suelta registrada':'unidades sueltas registradas'}; no se ofrecerán por unidad.`:'Todo descuenta del mismo inventario para que el stock no se duplique.'}

  let adv=$('.hm114-stock-advanced',stock);if(!adv){adv=document.createElement('details');adv.className='hm114-stock-advanced';adv.innerHTML='<summary>Aviso de pocas unidades <span>opcional</span></summary><div></div>';stock.append(adv)}
  const low=$('#v5LowThreshold')?.closest('label');if(low&&!adv.contains(low))$('div',adv)?.append(low);
}
function decorateGeneral(){
  const modal=$('#productModal');if(!modal||!modalOpen())return;modal.classList.add('hm114-editor');
  const mode=currentMode();ensureModeDefault(mode);decorateMode(mode);
  rows().forEach(r=>addRowHead(r,mode));decoratePhotos(mode);decorateStock(mode);
  $('.v6-editor-ribbon')?.classList.add('hm114-field-hidden');$('.v5-editor-head')?.classList.add('hm114-field-hidden');$('.v5-stock-grid')?.classList.add('hm114-field-hidden');$('#v5ProductEditor > .v5-switch')?.classList.add('hm114-field-hidden');$('.v5-presentations-head')?.classList.add('hm114-field-hidden');
  const sort=$('#productSort')?.closest('.field');sort?.classList.add('hm114-field-hidden');
  const statusLabel=$('#productStatus')?.closest('.field')?.querySelector('label');if(statusLabel&&statusLabel.textContent!=='Disponibilidad')statusLabel.textContent='Disponibilidad';
}
function schedule(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;installCategoryGuard();decorateGeneral()})}

/* save_product verification is handled from the direct response by panel-v10.11-core. */

/* Keep UI simple after the legacy layers do their internal work. */
document.addEventListener('click',e=>{
  const edit=e.target.closest?.('[data-edit-product]');
  if(edit){armCategory(edit.dataset.editProduct||'');[35,90,180].forEach(ms=>setTimeout(schedule,ms));return}
  if(e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]')){armCategory('');[35,90,180].forEach(ms=>setTimeout(schedule,ms));return}
  if(e.target.closest?.('#hm111SaleMode [data-m],#v5AddPresentation,.v5-remove-presentation'))[0,30,90].forEach(ms=>setTimeout(schedule,ms));
},true);
document.addEventListener('input',e=>{
  if(e.target?.matches?.('#hm111Packs,#hm111Loose')){const old=$('#v5StockTracking'),track=$('#hm114Track input');if(old&&!old.checked){old.checked=true;old.dispatchEvent(new Event('change',{bubbles:true}));if(track)track.checked=true}setTimeout(schedule,0)}
  if(e.target?.matches?.('[data-p-name],[data-p-units],[data-p-price]'))setTimeout(schedule,0);
},true);
window.addEventListener('hm111:presentations',()=>setTimeout(schedule,0));
const modal=$('#productModal');if(modal)new MutationObserver(()=>schedule()).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
const start=()=>{installCategoryGuard();schedule();document.documentElement.dataset.hmPanelSimple='10.14.0'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
