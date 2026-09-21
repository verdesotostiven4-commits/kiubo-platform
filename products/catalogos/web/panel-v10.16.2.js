/* Hakuna Panel 10.16.2 — stable sale-mode intent + quantity-neutral pack editor. */
(()=>{
'use strict';
if(window.__hm1162Panel)return;window.__hm1162Panel=true;
if(!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname))return;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let modeIntent='',openedId='',initTimer=0,raf=0,syncing=false;

const modalOpen=()=>{const m=$('#productModal');return Boolean(m&&!m.hidden&&m.classList.contains('visible'))};
const rows=()=>$$('.v5-presentation-row');
const savedFor=r=>(window.__hm111Presentations||[]).find(p=>String(p.id)===String(r?.dataset?.id||''))||null;
const rawUnits=r=>String($('[data-p-units]',r)?.value??'').trim();
const numericUnits=r=>{const raw=rawUnits(r);if(raw==='')return null;const n=Number(raw);return Number.isFinite(n)?n:null};
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

function setLabel(label,text){
  if(!label)return;
  const n=[...label.childNodes].find(x=>x.nodeType===Node.TEXT_NODE);
  if(n)n.nodeValue=`${text} `;
}
function roleOf(r){
  if(!r)return'';
  if(r.dataset.hm1162Role)return r.dataset.hm1162Role;
  const saved=savedFor(r),n=numericUnits(r),name=norm($('[data-p-name]',r)?.value||saved?.name||'');
  let role='';
  if(Number(saved?.units_per_presentation)>1)role='pack';
  else if(Number(saved?.units_per_presentation)===1)role='unit';
  else if(n!==null&&n>1)role='pack';
  else if(/\b(caja|jaba|pack|paca|paquete|display|bulto|docena)\b/.test(name))role='pack';
  else if(name==='unidad'||n===1)role='unit';
  if(role)r.dataset.hm1162Role=role;
  return role;
}
function markRoles(){
  const rs=rows();
  rs.forEach(roleOf);
  if(rs.length===2){
    const known=rs.find(r=>roleOf(r));
    const unknown=rs.find(r=>!roleOf(r));
    if(known&&unknown)unknown.dataset.hm1162Role=roleOf(known)==='unit'?'pack':'unit';
  }
  if(rs.length===1&&!roleOf(rs[0]))rs[0].dataset.hm1162Role='unit';
}
function visibleFromSaved(r){
  const p=savedFor(r);
  if(p)return p.visible!==false;
  return $('[data-hm-visible]',r)?.checked!==false;
}
function inferMode(){
  markRoles();
  const active=rows().filter(visibleFromSaved);
  const hasUnit=active.some(r=>roleOf(r)==='unit');
  const hasPack=active.some(r=>roleOf(r)==='pack');
  return hasUnit&&hasPack?'both':hasPack?'pack':'unit';
}
function field(r,sel){return $(sel,r)}
function setRowVisible(r,on){
  const v=field(r,'[data-hm-visible]');
  if(v&&v.checked!==on){v.checked=on;v.dispatchEvent(new Event('change',{bubbles:true}))}
}
function addRow(){
  const before=rows().length;
  $('#v5AddPresentation')?.click();
  const rs=rows();
  return rs.length>before?rs.at(-1):null;
}
function ensureUnit(){
  markRoles();
  let r=rows().find(x=>roleOf(x)==='unit');
  if(!r){
    r=addRow();
    if(r){
      r.dataset.hm1162Role='unit';
      const name=field(r,'[data-p-name]'),units=field(r,'[data-p-units]'),unit=field(r,'[data-p-unit]');
      if(name)name.value='Unidad';
      if(units)units.value='1';
      if(unit)unit.value=$('#v5BaseUnit')?.value||'unidad';
    }
  }
  return r;
}
function ensurePack(){
  markRoles();
  let r=rows().find(x=>roleOf(x)==='pack');
  if(!r){
    r=addRow();
    if(r){
      r.dataset.hm1162Role='pack';
      const name=field(r,'[data-p-name]'),units=field(r,'[data-p-units]'),unit=field(r,'[data-p-unit]');
      if(name)name.value='Caja / jaba / pack';
      if(units){units.value='';units.placeholder='Ej. 10, 20, 24, 30…'}
      if(unit)unit.value=$('#v5BaseUnit')?.value||'unidad';
    }
  }
  return r;
}
function setDefaultForMode(){
  const rs=rows(),u=rs.find(r=>roleOf(r)==='unit'),p=rs.find(r=>roleOf(r)==='pack');
  const current=rs.find(r=>field(r,'[data-p-default]')?.checked&&field(r,'[data-hm-visible]')?.checked!==false);
  const wanted=modeIntent==='unit'?u:modeIntent==='pack'?p:(current||p||u);
  const radio=wanted&&field(wanted,'[data-p-default]');
  if(radio&&!radio.checked)radio.checked=true;
}
function polishRow(r){
  const role=roleOf(r);if(!role)return;
  const name=field(r,'[data-p-name]')?.closest('label');
  const units=field(r,'[data-p-units]')?.closest('label');
  const price=field(r,'[data-p-price]')?.closest('label');
  if(role==='pack'){
    setLabel(name,'Cómo se vende');
    setLabel(units,'Unidades que contiene');
    setLabel(price,'Precio de venta');
    const input=field(r,'[data-p-units]');
    if(input&&!input.placeholder)input.placeholder='Ej. 10, 20, 24, 30…';
    const hb=$('.hm114-row-head b',r),hs=$('.hm114-row-head small',r);
    if(hb?.firstChild?.nodeType===Node.TEXT_NODE)hb.firstChild.nodeValue='Venta por caja / jaba / pack';
    if(hs?.firstChild?.nodeType===Node.TEXT_NODE)hs.firstChild.nodeValue='El cliente compra la presentación completa.';
  }else{
    setLabel(price,'Precio por unidad');
  }
}
function validatePackQuantity(){
  const btn=$('#saveProductBtn');let invalid=false;
  if(modeIntent==='pack'||modeIntent==='both'){
    rows().filter(r=>roleOf(r)==='pack'&&field(r,'[data-hm-visible]')?.checked!==false).forEach(r=>{
      const input=field(r,'[data-p-units]'),raw=String(input?.value??'').trim(),n=Number(raw);
      const bad=raw===''||!Number.isInteger(n)||n<2;
      invalid=invalid||bad;
      if(input){
        input.setCustomValidity(bad?'Escribe cuántas unidades contiene esta caja, jaba o pack.':'');
        input.classList.toggle('hm1162-invalid',bad);
        if(bad)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
      }
    });
  }
  if(btn){
    if(invalid&&!btn.disabled){btn.disabled=true;btn.dataset.hm1162Disabled='1'}
    else if(!invalid&&btn.dataset.hm1162Disabled==='1'){btn.disabled=false;delete btn.dataset.hm1162Disabled}
  }
}
function applyIntent(){
  if(!modalOpen()||!modeIntent||syncing)return;
  syncing=true;
  try{
    markRoles();
    if(modeIntent==='unit')ensureUnit();
    else if(modeIntent==='pack')ensurePack();
    else{ensureUnit();ensurePack()}
    markRoles();
    rows().forEach(r=>{
      const role=roleOf(r);
      const on=modeIntent==='both'||role===modeIntent;
      if(role)setRowVisible(r,on);
      polishRow(r);
    });
    setDefaultForMode();
    const box=$('#hm111SaleMode');
    if(box){
      box.dataset.hm1162Mode=modeIntent;
      $$('[data-m]',box).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===modeIntent)));
    }
    validatePackQuantity();
  }finally{
    syncing=false;
  }
}
function initializeMode(force=false){
  if(!modalOpen())return;
  if(!modeIntent||force)modeIntent=inferMode();
  applyIntent();
}
function arm(id=''){
  openedId=String(id||'');
  modeIntent='';
  clearTimeout(initTimer);
  initTimer=setTimeout(()=>initializeMode(true),140);
  setTimeout(()=>{if(!modeIntent)initializeMode(true);else applyIntent()},280);
}
function schedule(){
  if(raf)return;
  raf=requestAnimationFrame(()=>{raf=0;if(modalOpen()){if(modeIntent)applyIntent();}});
}

/* Capture the mode buttons before the legacy 10.11 handler can inject a hard-coded Caja x 12. */
document.addEventListener('click',e=>{
  const mode=e.target.closest?.('#hm111SaleMode [data-m]');
  if(mode){
    e.preventDefault();e.stopImmediatePropagation();
    modeIntent=mode.dataset.m||'unit';
    applyIntent();
    requestAnimationFrame(applyIntent);
    setTimeout(applyIntent,40);
    return;
  }
  const edit=e.target.closest?.('[data-edit-product]');
  if(edit){arm(edit.dataset.editProduct||'');return}
  if(e.target.closest?.('#newProductBtn,#mobileCreateBtn,[data-quick="new-product"]')){arm('');return}
},true);

document.addEventListener('input',e=>{
  const input=e.target;
  if(!modalOpen())return;
  if(input?.matches?.('[data-p-units]')){
    const row=input.closest('.v5-presentation-row');
    if(row&&!row.dataset.hm1162Role){
      const n=Number(input.value);
      row.dataset.hm1162Role=Number.isFinite(n)&&n>1?'pack':'unit';
    }
    queueMicrotask(applyIntent);setTimeout(applyIntent,0);setTimeout(applyIntent,40);
  }
},true);

window.addEventListener('hm111:presentations',()=>{if(modalOpen()){if(!modeIntent)setTimeout(()=>initializeMode(true),80);else setTimeout(applyIntent,0)}});
const modal=$('#productModal');
if(modal)new MutationObserver(()=>{
  if(modalOpen()){
    if(!modeIntent){clearTimeout(initTimer);initTimer=setTimeout(()=>initializeMode(true),120)}
    else schedule();
  }else{
    modeIntent='';openedId='';
  }
}).observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});

new MutationObserver(()=>{if(modalOpen()&&modeIntent)schedule()}).observe(document.documentElement,{childList:true,subtree:true});
const start=()=>{document.documentElement.dataset.hmPanelSaleMode='10.16.2';if(modalOpen())arm(openedId)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
