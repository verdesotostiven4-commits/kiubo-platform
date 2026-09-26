/* Hakuna Panel 10.11 core — presentation prices are the source of truth + direct-response verification. */
(()=>{
'use strict';
if(window.__hm111Core)return;window.__hm111Core=true;
if(!/^\/(?:panel|master)(?:\/|$)/.test(location.pathname))return;
const C=window.KIUBO_CATALOG_CONFIG||{};if(!C.apiUrl)return;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const baseFetch=window.fetch.bind(window);
let pending=null;
window.__hm111Presentations=window.__hm111Presentations||[];

function toast(msg,type=''){
  const e=document.createElement('div');e.className=`hm111-toast ${type}`;e.textContent=msg;document.body.append(e);
  requestAnimationFrame(()=>e.classList.add('show'));setTimeout(()=>{e.classList.remove('show');setTimeout(()=>e.remove(),180)},2200);
}
function remember(payload){
  if(Array.isArray(payload?.presentations)){
    window.__hm111Presentations=payload.presentations;
    window.dispatchEvent(new CustomEvent('hm111:presentations'));
  }
}
function rowState(r){
  const price=Math.max(0,Number($('[data-p-price]',r)?.value||0));
  const raw=$('[data-hm-promo-price]',r)?.value;
  const promo=raw===''||raw==null?null:Number(raw);
  return{
    id:r.dataset.id||null,
    name:$('[data-p-name]',r)?.value.trim()||'Unidad',
    units:Math.max(1,Math.trunc(Number($('[data-p-units]',r)?.value||1))),
    price,
    visible:$('[data-hm-visible]',r)?.checked!==false,
    promo_active:Boolean($('[data-hm-promo]',r)?.checked)&&promo!==null&&Number.isFinite(promo)&&promo>=0&&promo<price,
    promo_price:promo,
    promo_label:$('[data-hm-promo-label]',r)?.value.trim()||'Oferta',
    is_default:Boolean($('[data-p-default]',r)?.checked)
  };
}
function capture(){
  pending=$$('.v5-presentation-row').map(rowState);
  const rows=$$('.v5-presentation-row');
  const d=rows.find(r=>$('[data-p-default]',r)?.checked)||rows.find(r=>$('[data-hm-visible]',r)?.checked)||rows[0];
  if(d){
    const p=$('[data-p-price]',d),n=$('[data-p-name]',d);
    if($('#productPrice')&&p)$('#productPrice').value=String(Math.max(0,Number(p.value||0)));
    if($('#productUnit')&&n)$('#productUnit').value=n.value.trim()||'Unidad';
    if($('#productComparePrice'))$('#productComparePrice').value='';
  }
}
function validate(){
  if(!pending?.length)return'Debe existir al menos una presentación.';
  if(!pending.some(x=>x.visible))return'Activa al menos una presentación para vender.';
  if(pending.filter(x=>x.visible&&x.is_default).length!==1)return'Elige una sola portada del catálogo.';
  for(let i=0;i<pending.length;i++){
    const r=$$('.v5-presentation-row')[i];
    if($('[data-hm-promo]',r)?.checked&&!pending[i].promo_active)return'El precio de oferta debe ser menor al precio normal.';
  }
  return'';
}
function sameMoney(a,b){return Math.abs(Number(a||0)-Number(b||0))<0.001}
function directSaveMatches(payload,wanted){
  const actual=Array.isArray(payload?.presentations)?payload.presentations:[];
  if(!actual.length||actual.length<wanted.length)return false;
  return wanted.every((desired,index)=>{
    const row=(desired.id&&actual.find(x=>String(x.id)===String(desired.id)))||
      actual.find(x=>String(x.name||'').trim()===desired.name&&Number(x.units_per_presentation||1)===desired.units)||
      actual[index];
    if(!row)return false;
    const promoWanted=desired.promo_active===true;
    const promoOk=Boolean(row.promo_active)===promoWanted&&(!promoWanted||sameMoney(row.promo_price,desired.promo_price));
    return sameMoney(row.price,desired.price)&&Boolean(row.visible)===Boolean(desired.visible)&&Boolean(row.is_default)===Boolean(desired.is_default)&&promoOk;
  });
}

window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input?.url||'';
  let body=null;try{body=url===C.apiUrl&&typeof init?.body==='string'?JSON.parse(init.body):null}catch{}
  if(body?.action==='save_product'&&$('#productModal')&&!$('#productModal').hidden){
    capture();
    const err=validate();
    if(err){
      pending=null;toast(err,'error');
      return new Response(JSON.stringify({error:'invalid_presentations'}),{status:400,headers:{'Content-Type':'application/json'}});
    }
  }
  const res=await baseFetch(input,init);
  if(url===C.apiUrl&&body){
    try{
      const clone=await res.clone().json();
      if(res.ok&&['provider_bootstrap','master_bootstrap','save_product','save_presentations'].includes(String(body.action)))remember(clone);
    }catch{}
  }
  if(url===C.apiUrl&&body?.action==='save_product'&&res.ok&&pending){
    try{
      const payload=await res.clone().json(),wanted=pending;pending=null;
      if(!directSaveMatches(payload,wanted)){
        toast('Algo no quedó guardado. El formulario sigue abierto para revisarlo.','error');
        return new Response(JSON.stringify({error:'save_verification_failed'}),{status:409,headers:{'Content-Type':'application/json'}});
      }
    }catch{
      pending=null;toast('No pudimos verificar el guardado.','error');
      return new Response(JSON.stringify({error:'save_verification_failed'}),{status:409,headers:{'Content-Type':'application/json'}});
    }
  }
  return res;
};
document.addEventListener('click',e=>{if(e.target.closest?.('#saveProductBtn'))capture()},true);
})();