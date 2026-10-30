/* Injected only into the isolated preview: no requests or writes reach Hakuna. */
(()=>{'use strict';
const KEY='hakuna-synthetic-preview-v1',ACCOUNT='11111111-1111-4111-8111-111111111111',PRODUCT='22222222-2222-4222-8222-222222222222',UNIT='33333333-3333-4333-8333-333333333333',BOX='77777777-7777-4777-8777-777777777777',ORDER='44444444-4444-4444-8444-444444444444',TOKEN='55555555-5555-4555-8555-555555555555';
const account={id:ACCOUNT,slug:'hakuna-matata',name:'Hakuna Matata · DEMO',currency:'USD',accent:'#f06a3a',is_open:true,show_prices:true,minimum_order:0,payment_methods:['cash','transfer','credit'],inventory_policy:'delivered',logo_url:'/assets/hakuna-logo-192.png'};
const product={id:PRODUCT,name:'Cola de ejemplo',brand:'Demo',price:2,unit:'Unidad',base_unit:'unidad',status:'available',visible:true,stock_tracking:true,stock_initialized:true,stock_quantity:45,low_stock_threshold:2,allow_item_note:true};
const presentations=[{id:BOX,product_id:PRODUCT,name:'Jaba × 9',units_per_presentation:9,price:18,visible:true,is_default:true},{id:UNIT,product_id:PRODUCT,name:'Unidad',units_per_presentation:1,price:2,visible:true,is_default:false}];
const item=(id,pres,q)=>({id,product_id:PRODUCT,product_name:product.name,presentation_id:pres.id,presentation_name:pres.name,unit:'unidad',units_per_presentation:pres.units_per_presentation,base_units:q*pres.units_per_presentation,quantity:q,unit_price:pres.price,line_total:q*pres.price});
const initial=()=>({stock:45,history:[],orders:[{id:ORDER,public_token:TOKEN,order_number:'DEMO-1',customer_business:'Tienda de prueba',customer_name:'Cliente ficticio',customer_phone:'593999999999',status:'new',inventory_policy:'delivered',payment_method:'credit',payment_status:'pending',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),total:42,subtotal:42,revision:0,items:[item('66666666-6666-4666-8666-666666666666',presentations[0],2),item('88888888-8888-4888-8888-888888888888',presentations[1],3)]}]});
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||initial()}catch{return initial()}};
const save=x=>localStorage.setItem(KEY,JSON.stringify(x));
const uid=()=>crypto.randomUUID(),units=o=>o.items.reduce((sum,i)=>sum+i.quantity*i.units_per_presentation,0);
const reserved=db=>db.orders.filter(o=>['new','confirmed','preparing','dispatched'].includes(o.status)).reduce((sum,o)=>sum+units(o),0);
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
async function handle(b){
 const db=load(),available=Math.max(0,db.stock-reserved(db)),p={...product,stock_quantity:db.stock,reserved_quantity:reserved(db),available_stock:available};
 if(b.action==='public_key')return response({public_key:null});
 if(b.action==='catalog_identity')return response({account});
 if(b.action==='catalog_bootstrap')return response({account,categories:[],products:[{...p,stock_quantity:available}],presentations});
 if(b.action==='provider_login')return b.pin==='1234'?response({session_token:'fixture-session-not-a-real-credential'}):response({error:'invalid_pin'},401);
 if(b.action==='provider_bootstrap')return response({account,categories:[],products:[p],presentations,orders:db.orders,customers:[]});
 if(b.action==='order_status'){const order=db.orders.find(o=>o.public_token===b.public_token);return order?response({order,account}):response({error:'order_not_found'},404)}
 if(b.action==='order_history')return response({history:db.history.filter(h=>h.order_id===b.order_id)});
 if(b.action==='product_snapshot')return response({product:p,presentations});
 if(b.action==='create_order'){
  const duplicate=db.orders.find(o=>o.idempotency_key===b.idempotency_key);if(duplicate)return response({order:duplicate});
  const lines=(b.items||[]).map(line=>{const pres=presentations.find(x=>x.id===line.presentation_id)||presentations[0];return item(uid(),pres,Number(line.quantity))});
  const need=lines.reduce((n,l)=>n+l.base_units,0);if(need>available)return response({error:'insufficient_stock'},409);
  const order={id:uid(),public_token:uid(),idempotency_key:b.idempotency_key,order_number:`DEMO-${db.orders.length+1}`,customer_business:b.customer?.customer_business||'Cliente ficticio',customer_name:b.customer?.customer_name||'',customer_phone:b.customer?.customer_phone||'',delivery_method:b.customer?.delivery_method,delivery_address:b.customer?.delivery_address,payment_method:b.payment_method,payment_status:'pending',status:'new',inventory_policy:'delivered',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),revision:0,items:lines,total:lines.reduce((n,l)=>n+l.line_total,0)};
  db.orders.unshift(order);save(db);return response({order,whatsapp_url:''});
 }
 const order=db.orders.find(o=>o.id===b.order_id);if(!order)return response({error:'order_not_found'},404);
 if(b.action==='record_refund'){
  if(Number(b.expected_revision)!==order.revision)return response({error:'order_conflict'},409);
  const amount=Number(b.amount);if(!(amount>0)||amount>Number(order.refund_due||0))return response({error:'invalid_refund_amount'},409);
  order.refund_due=Math.round((Number(order.refund_due)-amount)*100)/100;order.revision++;save(db);return response({order});
 }
 if(['amend_order','return_order','update_order_status'].includes(b.action)){
  if(Number(b.expected_revision)!==order.revision)return response({error:'order_conflict'},409);
  const before=order.total,oldUnits=units(order);
  if(b.action==='update_order_status'){
   if(b.status==='delivered'){if(oldUnits>db.stock-(reserved(db)-oldUnits))return response({error:'insufficient_stock'},409);db.stock-=oldUnits}
   if(b.status==='cancelled'&&order.status==='delivered')db.stock+=oldUnits;
   order.status=b.status;
  }else{
   const lines=(b.items||[]).map(line=>{const existing=order.items.find(i=>i.id===line.id);if(existing)return item(existing.id,presentations.find(x=>x.id===existing.presentation_id),Number(line.quantity));const pres=presentations.find(x=>x.id===line.presentation_id)||presentations[0];return item(uid(),pres,Number(line.quantity))}).filter(i=>i.quantity>0);
   if(!lines.length)return response({error:'cancel_order_instead'},409);
   const nextUnits=lines.reduce((n,l)=>n+l.base_units,0);
   if(b.action==='return_order'){if(nextUnits>oldUnits)return response({error:'return_quantity_exceeded'},409);db.stock+=oldUnits-nextUnits}
   else if(nextUnits>db.stock-(reserved(db)-oldUnits))return response({error:'insufficient_stock'},409);
   order.items=lines;order.total=lines.reduce((n,l)=>n+l.line_total,0);order.subtotal=order.total;
  }
  order.revision++;order.updated_at=new Date().toISOString();db.history.unshift({order_id:order.id,kind:b.action==='return_order'?'return':b.action==='amend_order'?'edit':'status',reason:b.reason,created_at:order.updated_at,previous_total:before,total:order.total});save(db);return response({order,id:order.id,status:order.status});
 }
 return response({ok:true});
}
window.__hakunaSyntheticPreview=true;
const upstream=window.fetch.bind(window);window.fetch=(input,init={})=>{const url=typeof input==='string'?input:input?.url||'';if(url.startsWith('https://fixture.invalid/')){let b={};try{b=JSON.parse(init.body||'{}')}catch{}return handle(b)}return upstream(input,init)};
const show=()=>{const banner=document.createElement('div');banner.setAttribute('role','status');banner.textContent='VISTA DE PRUEBA · DATOS FICTICIOS · PIN 1234 · NO ENVÍA AVISOS REALES';banner.style.cssText='position:fixed;z-index:2147483647;top:0;left:0;right:0;padding:8px 12px;background:#6b3c00;color:#fff;text-align:center;font:700 12px/1.3 system-ui';document.body.prepend(banner);document.body.style.paddingTop='34px'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
})();
