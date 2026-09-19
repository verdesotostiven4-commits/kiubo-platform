(()=>{
  'use strict';

  const C=window.KIUBO_CATALOG_CONFIG||{};
  const slug=(new URLSearchParams(location.search).get('slug')||C.defaultSlug||'hakuna-matata')
    .toLowerCase().replace(/[^a-z0-9-]/g,'');
  const CART_KEY=`kiubo-v10-cart:${slug}`;
  const NOTES_KEY=`kiubo-v10-item-notes:${slug}`;
  const MAX_NOTE=180;

  const read=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const clean=value=>String(value??'').slice(0,MAX_NOTE);
  const cartNow=()=>read(CART_KEY,{})||{};
  const normalizedPresentation=value=>value==null||String(value).startsWith('legacy-')?'':String(value);

  let notes=read(NOTES_KEY,{})||{};
  let scheduled=false;

  function persistNotes(){write(NOTES_KEY,notes)}

  function seedMissingFromCart(){
    const cart=cartNow();
    let changed=false;
    for(const [key,item] of Object.entries(cart)){
      if(!(key in notes)){
        notes[key]=clean(item?.item_note||'');
        changed=true;
      }
    }
    for(const key of Object.keys(notes)){
      if(!(key in cart)){
        delete notes[key];
        changed=true;
      }
    }
    if(changed)persistNotes();
    return cart;
  }

  function applyNotesToCart(){
    const cart=cartNow();
    let cartChanged=false;
    let notesChanged=false;
    for(const [key,item] of Object.entries(cart)){
      if(!(key in notes)){
        notes[key]=clean(item?.item_note||'');
        notesChanged=true;
      }
      const note=clean(notes[key]);
      if(clean(item?.item_note||'')!==note){
        cart[key]={...item,item_note:note};
        cartChanged=true;
      }
    }
    for(const key of Object.keys(notes)){
      if(!(key in cart)){
        delete notes[key];
        notesChanged=true;
      }
    }
    if(cartChanged)write(CART_KEY,cart);
    if(notesChanged)persistNotes();
    return cart;
  }

  function saveNote(key,value){
    const note=clean(value);
    notes[key]=note;
    persistNotes();
    const cart=cartNow();
    if(cart[key]){
      cart[key]={...cart[key],item_note:note};
      write(CART_KEY,cart);
    }
  }

  function cartKeyForLine(line){
    const control=line.querySelector('[data-cart-minus],[data-cart-plus]');
    return control?.dataset.cartMinus||control?.dataset.cartPlus||'';
  }

  function updateCounter(textarea){
    const count=textarea.closest('.hm-v117-note')?.querySelector('.hm-v117-note__count');
    if(count){const value=`${textarea.value.length}/${MAX_NOTE}`;if(count.textContent!==value)count.textContent=value;}
  }

  function mountCartEditors(cart){
    document.querySelectorAll('.v10-cart-line').forEach(line=>{
      const key=cartKeyForLine(line);
      const item=cart[key];
      if(!key||!item)return;

      const copy=line.children?.[1];
      if(!copy)return;

      for(const child of [...copy.children]){
        if(child.tagName==='SMALL'&&!child.classList.contains('hm-v117-note__count'))child.remove();
      }

      let host=copy.querySelector('.hm-v117-note');
      if(!host){
        host=document.createElement('label');
        host.className='hm-v117-note';

        const title=document.createElement('span');
        title.className='hm-v117-note__label';
        title.textContent='Observación del producto';

        const textarea=document.createElement('textarea');
        textarea.rows=2;
        textarea.maxLength=MAX_NOTE;
        textarea.placeholder='Ej. sabor, color, variedad o indicación especial';
        textarea.setAttribute('aria-label',`Observación para ${item.product_name||'este producto'}`);
        textarea.dataset.hmV117ItemNote=key;

        const count=document.createElement('small');
        count.className='hm-v117-note__count';

        host.append(title,textarea,count);
        copy.append(host);
      }

      const textarea=host.querySelector('textarea[data-hm-v117-item-note]');
      if(!textarea)return;
      textarea.dataset.hmV117ItemNote=key;
      const desired=clean(notes[key]??item.item_note??'');
      if(document.activeElement!==textarea&&textarea.value!==desired)textarea.value=desired;
      updateCounter(textarea);
    });
  }

  function patchReview(cart){
    const entries=Object.entries(cart).filter(([,item])=>Number(item?.quantity||0)>0);
    const rows=[...document.querySelectorAll('.v10-review-items > div')];
    rows.forEach((row,index)=>{
      const pair=entries[index];
      if(!pair)return;
      const [key,item]=pair;
      const small=row.querySelector('small');
      if(!small)return;
      const note=clean(notes[key]??item.item_note??'').trim();
      const desired=`${item.presentation_name||''}${note?` · ${note}`:''}`;
      if(small.textContent!==desired)small.textContent=desired;
    });
  }

  function sync(){
    scheduled=false;
    const cart=applyNotesToCart();
    mountCartEditors(cart);
    patchReview(cart);
  }

  function scheduleSync(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(sync);
  }

  seedMissingFromCart();

  document.addEventListener('input',event=>{
    const textarea=event.target?.closest?.('textarea[data-hm-v117-item-note]');
    if(!textarea)return;
    const key=textarea.dataset.hmV117ItemNote;
    if(!key)return;
    const value=clean(textarea.value);
    if(textarea.value!==value)textarea.value=value;
    saveNote(key,value);
    updateCounter(textarea);
  },true);

  document.addEventListener('click',event=>{
    const target=event.target;
    if(!(target instanceof Element))return;

    if(target.closest('#detailAdd')){
      const before=cartNow();
      setTimeout(()=>{
        const cart=cartNow();
        let changed=false;
        for(const [key,item] of Object.entries(cart)){
          const nextNote=clean(item?.item_note||'');
          if(!(key in before)){
            notes[key]=nextNote;
            changed=true;
            continue;
          }
          const previousNote=clean(before[key]?.item_note||'');
          if(nextNote!==previousNote&&clean(notes[key]??previousNote)===previousNote){
            notes[key]=nextNote;
            changed=true;
          }
        }
        if(changed)persistNotes();
        scheduleSync();
      },0);
      return;
    }

    if(target.closest('[data-cart-minus],[data-cart-plus],#confirmClear,#checkoutStart,#checkoutBack,#reviewOrder,#reviewBack,#submitOrder')){
      setTimeout(scheduleSync,0);
    }
  },true);

  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    let nextInit=init;
    try{
      if(init&&typeof init.body==='string'){
        const payload=JSON.parse(init.body);
        if(payload?.action==='create_order'&&Array.isArray(payload.items)){
          const cart=applyNotesToCart();
          const entries=Object.entries(cart);
          payload.items=payload.items.map(item=>{
            const match=entries.find(([,cartItem])=>
              String(cartItem?.product_id)===String(item?.product_id)&&
              normalizedPresentation(cartItem?.presentation_id)===normalizedPresentation(item?.presentation_id)
            );
            if(!match)return item;
            const [key,cartItem]=match;
            const note=clean(notes[key]??cartItem?.item_note??'').trim();
            return {...item,item_note:note||null};
          });
          nextInit={...init,body:JSON.stringify(payload)};
        }
      }
    }catch{}
    return originalFetch(input,nextInit);
  };

  const observer=new MutationObserver(scheduleSync);
  const start=()=>{
    observer.observe(document.body,{childList:true,subtree:true});
    scheduleSync();
  };
  if(document.body)start();
  else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
