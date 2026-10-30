import {money,escapeHTML as esc,uid} from './core.js';

export function editorPresentations(product,presentations){
  const configured=presentations.filter(p=>p.product_id===product.id);
  if(configured.length)return configured.filter(p=>p.visible!==false);
  return [{id:null,product_id:product.id,name:product.unit||'Unidad',units_per_presentation:1,price:product.price}];
}
export function editorPrice(presentation,product){
  const regular=Number(presentation?.price??product?.price??0),promo=Number(presentation?.promo_price);
  return presentation?.promo_active&&Number.isFinite(promo)&&promo>=0&&promo<regular?promo:regular;
}
export function adjustmentPreview(lines,kind){
  return {total:Math.round(lines.reduce((n,l)=>n+Number(l.quantity)*Number(l.unit_price),0)*100)/100,
    returned:kind==='return'?lines.reduce((n,l)=>n+Math.max(0,l.originalQuantity-l.quantity)*Number(l.units_per_presentation||1),0):0,
    count:lines.reduce((n,l)=>n+Number(l.quantity),0)};
}
export function orderEditorItems(lines){
  return lines.map(l=>l.id?{id:l.id,quantity:l.quantity}:{product_id:l.product_id,presentation_id:l.presentation_id||null,quantity:l.quantity,item_note:l.item_note||null});
}
export function orderEditorError(error){
  const code=String(error?.code||error?.message||'');
  if(code.includes('order_conflict'))return 'El pedido cambió en otro dispositivo. Vuelve al detalle, actualízalo y revisa los cambios antes de guardar.';
  if(code.includes('insufficient_stock'))return 'No hay suficientes unidades disponibles para este cambio. Revisa el inventario y las cantidades reservadas.';
  if(code.includes('cancel_order_instead'))return 'Si se devuelve o quita todo, usa Cancelar pedido desde el detalle.';
  if(code.includes('return_has_no_changes'))return 'Indica qué cantidades devolvió el cliente.';
  if(code.includes('order_not_editable'))return 'El estado del pedido cambió y ya no permite esta edición. Actualiza el detalle.';
  if(code.includes('product_unavailable')||code.includes('invalid_presentation'))return 'Una presentación ya no está disponible. Revisa el producto que agregaste.';
  if(code.includes('session')||error?.status===401)return 'La sesión terminó. Ingresa nuevamente al panel.';
  return 'No se pudo confirmar el cambio. Tus cantidades siguen aquí; vuelve a intentarlo con conexión.';
}

export function openOrderEditor({host,order,kind,products,presentations,callApi,slug,onCancel,onSaved}){
  const returning=kind==='return',cancelling=kind==='cancel';
  let lines=(order.items||[]).map(item=>({...item,quantity:Number(item.quantity),originalQuantity:Number(item.quantity)}));
  const availableProducts=products.filter(p=>!p.archived_at&&p.visible!==false&&p.status!=='out');
  const attempts=new Map();let saving=false;
  host.innerHTML=`<form class="hm-order-editor" aria-label="${cancelling?'Cancelar pedido':returning?'Registrar devolución':'Editar pedido'}">
    <button type="button" class="hm-editor-back">‹ Volver al pedido</button>
    <h3>${cancelling?'Cancelar pedido':returning?'Registrar devolución':'Editar antes de confirmar'}</h3>
    <p>${cancelling?(order.status==='delivered'?'Confirma esta acción cuando hayas recuperado todos los productos. El inventario recuperará solo lo que sigue entregado.':'Se liberará la reserva de este pedido.'):
      returning?'Indica cuánto se queda el cliente. Registra la devolución cuando hayas recuperado los productos.':'Ajusta cantidades, retira unidades o agrega productos. Los precios guardados se conservan.'}</p>
    <div class="hm-editor-lines"></div>
    ${!returning&&!cancelling?`<section class="hm-editor-add"><label>Agregar producto<input type="search" placeholder="Buscar nombre, marca o código" autocomplete="off" data-product-search></label><label class="hm-editor-select-label">Producto<select data-product-select aria-label="Producto para agregar"><option value="">Elige un producto</option></select></label><div class="hm-editor-add-row"><select data-presentation-select aria-label="Presentación para agregar" disabled></select><button type="button" data-add-line disabled>Agregar</button></div></section>`:''}
    <label class="hm-editor-reason">Motivo del ${cancelling?'cambio':returning?'retorno':'cambio'}<textarea required minlength="3" maxlength="240" rows="2" placeholder="Ej. El cliente pidió retirar las unidades sueltas" data-edit-reason></textarea></label>
    <div class="hm-editor-summary" aria-live="polite"></div>
    <p class="hm-editor-error" role="alert" hidden></p>
    <div class="hm-editor-footer"><button type="button" data-editor-cancel>Volver</button><button type="submit" class="button button--primary">${cancelling?'Confirmar cancelación':returning?'Guardar devolución':'Guardar cambios'}</button></div>
  </form>`;
  const form=host.querySelector('form'),$=s=>form.querySelector(s);
  const renderSummary=()=>{
    const preview=adjustmentPreview(lines,kind);
    $('.hm-editor-summary').innerHTML=`<div><span>Antes</span><b>${money(order.total)}</b></div>${!cancelling?`<div><span>Ahora</span><strong>${money(preview.total)}</strong></div>`:''}
      <small>${cancelling?'La cancelación se guardará en el historial.':returning?'El inventario recuperará las cantidades devueltas.':'El stock físico se descontará al entregar; este cambio actualiza la reserva.'}</small>
      ${Number(order.refund_due)>0||((returning||cancelling)&&['paid','verified'].includes(order.payment_status))?'<small>Si corresponde un reintegro, quedará pendiente de coordinar. Esta acción no realiza transferencias ni devuelve dinero automáticamente.</small>':''}`;
  };
  const renderLines=()=>{
    $('.hm-editor-lines').innerHTML=lines.map((line,index)=>`<article class="hm-editor-line ${line.quantity===0?'is-removed':''}"><div><b>${esc(line.product_name)}</b><small>${esc(line.presentation_name||line.unit||'Unidad')} · ${money(line.unit_price)}</small>
      ${returning?`<small data-return-label="${index}">Entregadas: ${line.originalQuantity} · Devuelve: ${line.originalQuantity-line.quantity}</small>`:''}</div>
      ${cancelling?`<strong>${line.quantity}×</strong>`:`<label>${returning?'Se queda':'Cantidad'}<input type="number" required inputmode="numeric" min="0" max="${returning?line.originalQuantity:999}" step="1" value="${line.quantity}" data-line-index="${index}" aria-label="${returning?'Cantidad que conserva de':'Cantidad de'} ${esc(line.product_name)} ${esc(line.presentation_name||'')}"></label>
      <button type="button" data-remove-line="${index}" aria-label="${returning?'Devolver todo de':'Quitar'} ${esc(line.product_name)}">${returning?'Devuelve todo':'Quitar'}</button>`}</article>`).join('');
    renderSummary();
  };
  const productSelect=$('[data-product-select]'),presentationSelect=$('[data-presentation-select]');
  const renderProducts=()=>{
    if(!productSelect)return;
    const current=productSelect.value,q=($('[data-product-search]').value||'').trim().toLocaleLowerCase('es');
    const filtered=availableProducts.filter(p=>`${p.name} ${p.brand||''} ${p.sku||''}`.toLocaleLowerCase('es').includes(q));
    productSelect.innerHTML='<option value="">Elige un producto</option>'+filtered.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if(filtered.some(p=>p.id===current))productSelect.value=current;
    renderPresentations();
  };
  const renderPresentations=()=>{
    if(!productSelect)return;
    const product=availableProducts.find(p=>p.id===productSelect.value),ps=product?editorPresentations(product,presentations):[];
    presentationSelect.innerHTML=ps.length?ps.map((p,index)=>`<option value="${index}">${esc(p.name)} · ${money(editorPrice(p,product))}</option>`).join(''):'<option>Elige una presentación</option>';
    presentationSelect.disabled=!ps.length;$('[data-add-line]').disabled=!ps.length;
  };
  form.addEventListener('input',event=>{
    const input=event.target;if(saving)return;
    if(input.matches('[data-line-index]')){
      const line=lines[Number(input.dataset.lineIndex)],q=Number(input.value),max=returning?line.originalQuantity:999;
      input.setCustomValidity(!Number.isInteger(q)||q<0||q>max?'Revisa la cantidad':'');
      if(input.validity.valid){line.quantity=q;const label=$(`[data-return-label="${input.dataset.lineIndex}"]`);if(label)label.textContent=`Entregadas: ${line.originalQuantity} · Devuelve: ${line.originalQuantity-q}`;renderSummary()}
    }
    if(input.matches('[data-product-search]'))renderProducts();
  });
  form.addEventListener('change',event=>{if(event.target===productSelect)renderPresentations()});
  form.addEventListener('click',event=>{
    if(saving)return;
    const remove=event.target.closest('[data-remove-line]');
    if(remove){lines[Number(remove.dataset.removeLine)].quantity=0;renderLines()}
    if(event.target.closest('[data-editor-cancel],.hm-editor-back'))onCancel();
    if(event.target.closest('[data-add-line]')){
      const product=availableProducts.find(p=>p.id===productSelect.value);if(!product)return;
      const p=editorPresentations(product,presentations)[Number(presentationSelect.value)];if(!p)return;
      const existing=lines.find(l=>l.product_id===product.id&&(l.presentation_id||null)===(p.id||null));
      if(existing){existing.quantity=Math.min(999,existing.quantity+1)}else lines.push({product_id:product.id,product_name:product.name,
        presentation_id:p.id||null,presentation_name:p.name,quantity:1,originalQuantity:0,
        units_per_presentation:Number(p.units_per_presentation||1),unit_price:editorPrice(p,product)});
      renderLines();
    }
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving||!form.reportValidity())return;
    const payload={slug,order_id:order.id,expected_revision:Number(order.revision||0),reason:$('[data-edit-reason]').value.trim(),
      ...(cancelling?{status:'cancelled'}:{items:orderEditorItems(lines)})};
    if(!cancelling&&!adjustmentPreview(lines,kind).count){$('.hm-editor-error').textContent='Si se quita todo, vuelve al detalle y usa Cancelar pedido.';$('.hm-editor-error').hidden=false;return}
    const fingerprint=JSON.stringify(payload);if(!attempts.has(fingerprint))attempts.set(fingerprint,uid());
    saving=true;$('.hm-editor-error').hidden=true;
    const controls=[...form.querySelectorAll('button,input,textarea,select')],submit=form.querySelector('[type="submit"]'),label=submit.textContent;
    controls.forEach(c=>c.disabled=true);submit.textContent='Guardando…';
    try{
      const result=await callApi(cancelling?'update_order_status':returning?'return_order':'amend_order',{...payload,operation_id:attempts.get(fingerprint)});
      try{await onSaved(result.order)}catch{onCancel();alert('El cambio se guardó. Actualiza la pantalla para ver el resultado.')}
    }catch(error){$('.hm-editor-error').textContent=orderEditorError(error);$('.hm-editor-error').hidden=false}
    finally{saving=false;controls.forEach(c=>c.disabled=false);submit.textContent=label}
  });
  renderLines();renderProducts();
  $('.hm-editor-back').focus({preventScroll:true});
}
