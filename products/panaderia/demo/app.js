/* KIUBO Panadería: sample-only interactive UI. No persistence, fiscal documents or financial network calls. */
(function () {
  'use strict';
  const view = document.getElementById('app-view');
  const toastBox = document.getElementById('toast');
  const modalRoot = document.getElementById('modal-root');
  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  // Catálogo obtenido de las fotografías y precios compartidos por la clienta.
  // Stock 50: solo disponibilidad FICTICIA de la demo, NO inventario real.
  // Los mismos nombres con distinto precio son presentaciones PENDIENTES de confirmar.
  const seed = [
    ['p01','Biscochito','Envasados',200,50,'envase','🍪'],
    ['p02','Roquistas','Envasados',100,50,'funda','🥯'],
    ['p03','Melvas (envase)','Envasados',200,50,'envase','🥠'],
    ['p04','Suspiros (envase)','Envasados',200,50,'envase','🧁'],
    ['p05','Melvas (unidad)','Repostería',50,50,'unidad','🥠'],
    ['p06','Cabezotes','Repostería',100,50,'unidad','🍰'],
    ['p07','Mini melvas','Repostería',34,50,'unidad','🥠'],
    ['p08','Suspiros (unidad)','Repostería',50,50,'unidad','🧁'],
    ['p09','Chicharrones de piña','Hojaldres',50,50,'unidad','🥐'],
    ['p10','Pañuelos minis','Hojaldres',50,50,'unidad','🥐'],
    ['p11','Galletas','Repostería',50,50,'unidad','🍪'],
    ['p12','Hoy dog de manjar','Hojaldres',100,50,'unidad','🥖'],
    ['p13','Orejitas','Hojaldres',100,50,'unidad','🥨'],
    ['p14','Torta de chocolate ($1)','Tortas y porciones',100,50,'porción','🍫'],
    ['p15','Donas','Repostería',100,50,'unidad','🍩'],
    ['p16','Aplanchados','Hojaldres',25,50,'unidad','🥮'],
    ['p17','Brownie de chocolate','Tortas y porciones',50,50,'unidad','🍫'],
    ['p18','Queso de leche','Tortas y porciones',300,50,'porción','🍮'],
    ['p19','Torta de chocolate ($1.50)','Tortas y porciones',150,50,'porción','🍰']
  ];
  const state = {
    page: 'resumen', search: '', category: 'Todos', method: 'efectivo',
    products: seed.map(function (p) {
      return { id:p[0], name:p[1], category:p[2], price:p[3], stock:p[4], unit:p[5], emoji:p[6] };
    }),
    cart: {}, sales: [], expenses: [], sessions: [], processing: false,
    cash: { open: true, opening: 3000, openedAt: new Date().toISOString(), id: 'demo-turno-1' }
  };

  function esc(v) { return String(v).replace(/[&<>"']/g, function (x) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[x];
  }); }
  function fmt(cents) { return money.format((Number(cents) || 0) / 100); }
  function uuid() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'demo-' + Date.now() + '-' + Math.random().toString(16).slice(2); }
  function parseMoney(text) {
    const raw = String(text == null ? '' : text).trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return NaN;
    const pieces = raw.split('.');
    return Number(pieces[0]) * 100 + Number((pieces[1] || '').padEnd(2, '0'));
  }
  function dateFmt(text) { return new Date(text).toLocaleString('es-EC', { dateStyle:'short', timeStyle:'short' }); }
  function notify(text, error) {
    toastBox.textContent = text;
    toastBox.className = 'toast visible' + (error ? ' error' : '');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(function () { toastBox.className = 'toast'; }, 3500);
  }
  function heading(eyebrow, title, description, action) {
    return '<div class="page-head"><div><div class="eyebrow">' + eyebrow + '</div><h1>' + title + '</h1><p>' + description +
      '</p></div>' + (action || '') + '</div>';
  }
  function metric(label, value, icon, foot) {
    return '<article class="card metric"><span class="metric-label">' + label + '</span><span class="metric-icon">' +
      icon + '</span><strong>' + value + '</strong><small>' + (foot || 'Información de demostración') + '</small></article>';
  }
  function btn(label, action, cls, extra) {
    return '<button type="button" class="btn ' + (cls || '') + '" data-action="' + action + '" ' + (extra || '') + '>' + label + '</button>';
  }
  function sum(rows, field) { return rows.reduce(function (n, row) { return n + (row[field] || 0); }, 0); }
  function cashSales() { return sum(state.sales, 'cashPaid'); }
  function transferSales() { return sum(state.sales, 'transferPaid'); }
  function salesTotal() { return sum(state.sales, 'total'); }
  function salesInSession() { return state.sales.filter(function (s) { return s.sessionId === state.cash.id; }); }
  function expensesInSession() { return state.expenses.filter(function (e) { return e.sessionId === state.cash.id; }); }
  function cashExpected() {
    return state.cash.opening + sum(salesInSession(), 'cashPaid') - sum(expensesInSession(), 'amount');
  }
  function cartRows() { return Object.keys(state.cart).map(function (id) {
    const p = state.products.find(function (item) { return item.id === id; });
    return p ? { product:p, quantity:state.cart[id], subtotal:p.price * state.cart[id] } : null;
  }).filter(Boolean); }
  function cartTotal() { return sum(cartRows(), 'subtotal'); }
  function actionOpenPage(page) {
    state.page = page;
    state.search = '';
    state.category = 'Todos';
    render();
  }
  function demoWarning() {
    return '<div class="warning"><b>Catálogo y precios tomados de las fotos enviadas.</b> Las existencias, ventas y pagos son ficticios. No emite facturas SRI y los cambios desaparecen al actualizar la página. Presentaciones repetidas pendientes de confirmar.</div>';
  }
  function saleTable(rows) {
    if (!rows.length) return '<div class="empty">Todavía no hay ventas de muestra.<br>Registra una desde Punto de venta.</div>';
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Comprobante</th><th>Fecha</th><th>Productos</th><th>Medio</th><th>Total</th></tr></thead><tbody>' +
      rows.map(function (s) {
        return '<tr><td><strong>#' + esc(s.number) + '</strong></td><td>' + dateFmt(s.createdAt) + '</td><td>' +
          s.items.reduce(function (n, item) { return n + item.qty; }, 0) + ' un.</td><td>' +
          esc(s.method) + '</td><td><strong>' + fmt(s.total) + '</strong></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function overview() {
    const best = {};
    state.sales.forEach(function (sale) { sale.items.forEach(function (item) {
      best[item.name] = (best[item.name] || 0) + item.qty;
    }); });
    const top = Object.entries(best).sort(function (a,b) { return b[1]-a[1]; }).slice(0,4);
    return heading('Tu negocio en orden', 'Bienvenida a tu panadería',
      'Un panel sencillo para saber qué vendiste, cuánto cobraste y qué productos tienes disponibles.',
      btn('＋ Nueva venta', 'go-ventas', 'btn-primary')) +
      demoWarning() +
      '<div class="hero"><div><div class="hero-kicker">UNA FORMA MÁS SIMPLE DE VENDER</div><h2>Todo listo para el siguiente cliente.</h2>' +
      '<p>Selecciona los productos, registra el pago y revisa tu caja. Esta experiencia está preparada para personalizarse con el nombre y el logo reales del negocio.</p></div>' +
      btn('Abrir punto de venta  →', 'go-ventas', 'btn-primary') + '</div>' +
      '<section class="metrics">' +
      metric('Ventas en demo', fmt(salesTotal()), '↗', state.sales.length + ' comprobantes de muestra') +
      metric('Efectivo cobrado', fmt(cashSales()), '＄', 'No incluye fondo inicial') +
      metric('Transferencias', fmt(transferSales()), '⇄', 'Dinero recibido en demo') +
      metric('Productos', String(state.products.length), '◈', 'Catálogo inicial de ejemplo') + '</section>' +
      '<div class="split"><section class="card card-pad"><div class="card-title"><h2>Últimas ventas</h2><span>Comprobantes de muestra</span></div>' +
      saleTable(state.sales.slice(0,6)) + '</section>' +
      '<section class="card card-pad"><div class="card-title"><h2>Accesos rápidos</h2><span>Trabajo diario</span></div><div class="quick-actions">' +
      '<button class="quick-action" data-action="go-ventas"><div>◈ Cobrar una venta<small>Carrito, efectivo y transferencia</small></div><span>›</span></button>' +
      '<button class="quick-action" data-action="go-productos"><div>▦ Revisar productos<small>Precios y existencias</small></div><span>›</span></button>' +
      '<button class="quick-action" data-action="go-caja"><div>◉ Revisar la caja<small>Ingresos y egresos del turno</small></div><span>›</span></button>' +
      '</div>' + (top.length ? '<div class="fineprint">Más vendido en esta demo: ' + esc(top[0][0]) + ' · ' + top[0][1] + ' unidades.</div>' : '') +
      '</section></div>';
  }
  function productCard(p) {
    const available = p.stock > 0 && state.cash.open;
    return '<button class="product-card' + (!available ? ' out' : '') + '" data-action="add" data-id="' + esc(p.id) +
      '" ' + (!available ? 'disabled' : '') + '><span class="product-img">' + esc(p.emoji) +
      '</span><b>' + esc(p.name) + '</b><strong>' + fmt(p.price) + '</strong><small>' +
      p.stock + ' ' + esc(p.unit) + '(s) disponibles</small></button>';
  }
  function cartPanel() {
    const rows = cartRows();
    let body = '<div class="card-title"><h2>Carrito actual</h2><span>' + rows.length + ' productos</span></div>';
    if (!rows.length) body += '<div class="empty">Tu carrito está vacío.<br>Selecciona un producto para comenzar. 🥐</div>';
    else body += '<div class="cart-list">' + rows.map(function (r) {
      return '<div class="cart-line"><div class="cart-line-info"><b>' + esc(r.product.name) +
        '</b><small>' + fmt(r.product.price) + ' c/u · ' + fmt(r.subtotal) + '</small></div>' +
        '<div class="qty-controls"><button data-action="minus" data-id="' + esc(r.product.id) + '" aria-label="Quitar unidad">−</button><span>' +
        r.quantity + '</span><button data-action="plus" data-id="' + esc(r.product.id) + '" aria-label="Agregar unidad">+</button></div></div>';
    }).join('') + '</div>';
    body += '<div class="total-line"><strong>Total</strong><b>' + fmt(cartTotal()) + '</b></div>';
    body += '<div class="payment-tabs">' + [['efectivo','Efectivo'],['transferencia','Transferencia'],['mixto','Mixto']].map(function (m) {
      return '<button type="button" data-action="method" data-method="' + m[0] + '" class="pay-tab ' +
        (state.method === m[0] ? 'active' : '') + '">' + m[1] + '</button>';
    }).join('') + '</div>';
    if (rows.length && state.method === 'efectivo') {
      body += '<label class="field">Efectivo recibido<input id="received" class="input" inputmode="decimal" value="' + (cartTotal()/100).toFixed(2) + '"></label>';
    }
    if (rows.length && state.method === 'mixto') {
      body += '<label class="field">Parte en efectivo<input id="cashPart" class="input" inputmode="decimal" value="' +
        (Math.floor(cartTotal()/2)/100).toFixed(2) + '"></label><p class="fineprint">El resto corresponde a transferencia. El total recibido debe cubrir la venta.</p>';
    }
    if (rows.length && state.method !== 'efectivo') {
      body += '<label class="field">Referencia de transferencia (opcional en demo)<input id="transferRef" class="input" maxlength="40" placeholder="Ej. TRANSF-123"></label>';
    }
    body += '<div style="margin-top:16px">' + btn('Confirmar venta de DEMO  →','checkout','btn-primary btn-wide',
      (!rows.length || !state.cash.open || state.processing ? 'disabled' : '')) + '</div>';
    if (!state.cash.open) body += '<p class="hint">La caja está cerrada. Ábrela desde Caja y gastos.</p>';
    else body += '<p class="fineprint">Este botón no cobra dinero real. Solo prueba cómo funcionaría el sistema.</p>';
    return '<aside class="card cart-panel">' + body + '</aside>';
  }
  function pos() {
    const cats = ['Todos'].concat(Array.from(new Set(state.products.map(function (p) { return p.category; }))));
    const match = state.products.filter(function (p) {
      return (state.category === 'Todos' || p.category === state.category) &&
        p.name.toLowerCase().includes(state.search.toLowerCase());
    });
    return heading('Ventas rápidas', 'Punto de venta', 'Usa F2 para buscar rápidamente · Los precios son los proporcionados · Las existencias son ficticias.',
      btn('Limpiar carrito', 'clear-cart', 'btn')) + demoWarning() +
      '<div class="pos-layout"><div><div class="product-tools"><input class="search-input" id="product-search" placeholder="Buscar pan, torta, café…" aria-label="Buscar productos" value="' +
      esc(state.search) + '"></div><div class="category-list">' + cats.map(function (cat) {
        return '<button type="button" class="category-chip ' + (state.category === cat ? 'active' : '') +
          '" data-action="category" data-category="' + esc(cat) + '">' + esc(cat) + '</button>';
      }).join('') + '</div><div class="product-grid">' + (match.length ? match.map(productCard).join('') : '<div class="empty">No encontramos ese producto.</div>') +
      '</div></div>' + cartPanel() + '</div>';
  }
  function products() {
    return heading('Inventario sencillo', 'Productos y precios', 'Administra el catálogo de ejemplo y las existencias de productos terminados.') +
      demoWarning() + '<div class="split"><section class="card card-pad"><div class="card-title"><h2>Catálogo actual</h2><span>' +
      state.products.length + ' productos</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Unidades</th><th>Ajustar</th></tr></thead><tbody>' +
      state.products.map(function (p) {
        return '<tr><td><strong>' + esc(p.emoji) + ' ' + esc(p.name) + '</strong></td><td>' +
          esc(p.category) + '</td><td>' + fmt(p.price) + '</td><td>' + p.stock + '</td><td>' +
          '<button class="btn btn-sm" data-action="stock" data-id="' + esc(p.id) + '">+ Stock</button></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="card card-pad"><div class="card-title"><h2>Nuevo producto</h2><span>Solo demostración</span></div>' +
      '<form id="new-product" class="form-grid">' +
      '<label class="field field-full">Nombre del producto<input class="input" name="name" required maxlength="60" placeholder="Ej. Pan de chocolate"></label>' +
      '<label class="field">Precio en USD<input class="input" name="price" required inputmode="decimal" placeholder="0.50"></label>' +
      '<label class="field">Stock inicial<input class="input" name="stock" required type="number" min="0" max="100000" value="20"></label>' +
      '<label class="field field-full">Categoría<select class="select" name="category"><option>Panes</option><option>Pastelería</option><option>Bebidas</option><option>Otros</option></select></label>' +
      '<button class="btn btn-primary field-full" type="submit">＋ Agregar producto</button></form></section></div>';
  }
  function cash() {
    const sessionSales = salesInSession();
    const cashIncome = sum(sessionSales, 'cashPaid');
    const transferIncome = sum(sessionSales, 'transferPaid');
    const expenses = expensesInSession();
    const closed = state.sessions.length ? state.sessions[0] : null;
    return heading('Control diario', 'Caja y gastos', 'Separa el dinero recibido por efectivo y transferencia; revisa el cierre del turno.') +
      demoWarning() + '<div class="metrics">' +
      metric('Fondo inicial', fmt(state.cash.open ? state.cash.opening : (closed ? closed.opening : 0)), '◎', 'No es ingreso por ventas') +
      metric('Efectivo cobrado', fmt(cashIncome), '＄', 'Solo ventas del turno actual') +
      metric('Transferencias', fmt(transferIncome), '⇄', 'Solo ventas del turno actual') +
      metric('Egresos en efectivo', fmt(sum(expenses, 'amount')), '↘', 'Restados al arqueo') +
      '</div><div class="two-panels"><section class="card card-pad"><div class="card-title"><h2>Estado de caja</h2>' +
      '<span class="badge ' + (state.cash.open ? '' : 'badge-muted') + '">' + (state.cash.open ? 'ABIERTA' : 'CERRADA') + '</span></div>' +
      '<div class="kpi-list"><div class="kpi-row"><span>Efectivo esperado</span><b>' + fmt(state.cash.open ? cashExpected() : 0) + '</b></div>' +
      '<div class="kpi-row"><span>Transferencias del turno</span><b>' + fmt(transferIncome) + '</b></div>' +
      '<div class="kpi-row"><span>Comprobantes registrados</span><b>' + sessionSales.length + '</b></div></div>' +
      (state.cash.open
        ? '<form id="close-cash" style="margin-top:18px"><label class="field">Efectivo contado al cierre<input name="counted" class="input" required inputmode="decimal" value="' + (Math.max(0,cashExpected())/100).toFixed(2) + '"></label><button class="btn btn-primary btn-wide" type="submit" style="margin-top:13px">Cerrar caja de prueba</button></form>'
        : '<div style="margin-top:16px">' + btn('Abrir nueva caja de DEMO', 'open-cash', 'btn-primary btn-wide') + '</div>') +
      (closed ? '<p class="fineprint">Último cierre · ' + dateFmt(closed.closedAt) + ' · diferencia: ' + fmt(closed.difference) + '</p>' : '') +
      '</section><section class="card card-pad"><div class="card-title"><h2>Registrar gasto</h2><span>Solo efectivo de caja</span></div>' +
      '<form id="new-expense" class="form-grid"><label class="field field-full">Motivo<input name="reason" class="input" maxlength="90" placeholder="Ej. Compra de servilletas" required></label>' +
      '<label class="field field-full">Valor en USD<input name="amount" class="input" inputmode="decimal" placeholder="2.50" required></label>' +
      '<button type="submit" class="btn btn-soft field-full" ' + (!state.cash.open ? 'disabled' : '') + '>− Registrar egreso de prueba</button></form>' +
      '<h3 style="font-size:13px;margin-top:22px">Egresos del turno</h3>' +
      (expenses.length ? '<div class="kpi-list">' + expenses.map(function (e) {
        return '<div class="kpi-row"><span>' + esc(e.reason) + '</span><b>−' + fmt(e.amount) + '</b></div>';
      }).join('') + '</div>' : '<div class="empty">Sin gastos registrados.</div>') +
      '</section></div>';
  }
  function reports() {
    const products = {};
    state.sales.forEach(function (sale) {
      sale.items.forEach(function (item) {
        const row = products[item.name] || { name:item.name,qty:0,total:0 };
        row.qty += item.qty; row.total += item.subtotal; products[item.name] = row;
      });
    });
    const ranking = Object.values(products).sort(function (a,b) { return b.qty - a.qty; }).slice(0,8);
    const maxQty = ranking[0] ? ranking[0].qty : 0;
    const expenses = sum(state.expenses, 'amount');
    return heading('Información clara', 'Reportes', 'Cada cifra sale de los comprobantes creados dentro de esta demostración.') +
      demoWarning() + '<section class="metrics">' +
      metric('Total de ventas', fmt(salesTotal()), '↗', state.sales.length + ' tickets ficticios') +
      metric('Efectivo recibido', fmt(cashSales()), '＄', 'Sin contar fondos iniciales') +
      metric('Transferencias recibidas', fmt(transferSales()), '⇄', 'Cobradas en demo') +
      metric('Egresos anotados', fmt(expenses), '↘', 'No equivale a utilidad neta') +
      '</section><div class="split"><section class="card card-pad"><div class="card-title"><h2>Comprobantes de venta</h2><span>Detalles verificables</span></div>' +
      saleTable(state.sales) + '</section><section class="card card-pad"><div class="card-title"><h2>Unidades vendidas por producto</h2><span>Ranking de demo</span></div>' +
      (ranking.length ? ranking.map(function (p) {
        return '<div class="chart-row"><div class="chart-meta"><b>' + esc(p.name) + '</b><span>' + p.qty + ' un. · ' + fmt(p.total) + '</span></div>' +
          '<div class="bar-back"><div class="bar-fill" style="width:' + Math.round(p.qty/maxQty*100) + '%"></div></div></div>';
      }).join('') : '<div class="empty">Registra ventas para visualizar los productos más vendidos.</div>') +
      '</section></div><p class="fineprint">No mostramos “ganancias” ficticias: para calcular utilidad real deben conocerse costos de producto, producción y gastos completos.</p>';
  }
  function render() {
    const pages = { resumen:overview, ventas:pos, productos:products, caja:cash, reportes:reports };
    view.innerHTML = pages[state.page]();
    document.querySelectorAll('[data-page]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.page === state.page);
    });
    document.getElementById('crumb').textContent = {
      resumen:'Resumen',ventas:'Punto de venta',productos:'Productos',caja:'Caja y gastos',reportes:'Reportes'
    }[state.page];
  }
  function add(id, delta) {
    const p = state.products.find(function (row) { return row.id === id; });
    if (!p || !state.cash.open) return notify('Primero abre la caja.', true);
    const next = (state.cart[id] || 0) + delta;
    if (next > p.stock) return notify('Solo quedan ' + p.stock + ' unidades de ' + p.name + '.', true);
    if (next <= 0) delete state.cart[id]; else state.cart[id] = next;
    render();
  }
  function receipt(sale) {
    const lines = sale.items.map(function (x) {
      return '<div class="ticket-row"><span>' + x.qty + ' × ' + esc(x.name) + '</span><span>' + fmt(x.subtotal) + '</span></div>';
    }).join('');
    modalRoot.innerHTML = '<div class="modal-overlay" role="presentation"><div class="modal" role="dialog" aria-modal="true" aria-label="Comprobante demo">' +
      '<div class="eyebrow">COMPROBANTE DE DEMOSTRACIÓN</div><h2>Venta #' + esc(sale.number) + '</h2>' +
      '<p>' + dateFmt(sale.createdAt) + ' · No válido como factura ni comprobante tributario.</p>' +
      '<div class="ticket">' + lines + '<div class="ticket-row"><b>Total</b><b>' + fmt(sale.total) + '</b></div>' +
      '<div class="ticket-row"><span>Efectivo</span><span>' + fmt(sale.cashPaid) + '</span></div>' +
      '<div class="ticket-row"><span>Transferencia</span><span>' + fmt(sale.transferPaid) + '</span></div>' +
      '<div class="ticket-row"><span>Cambio entregado</span><span>' + fmt(sale.change) + '</span></div></div>' +
      '<p>Esta operación existe únicamente en la simulación actual.</p>' +
      '<p class="fineprint">Resumen solo en pantalla. Por ahora no se necesita impresora de tickets.</p>' +
      '<div class="form-actions">' + btn('Aceptar y seguir vendiendo', 'close-modal', 'btn-primary') +
      '</div></div></div>';
  }
  function checkout() {
    if (state.processing) return;
    if (!state.cash.open) return notify('Abre la caja antes de vender.', true);
    const cart = cartRows(); const total = cartTotal();
    if (!cart.length || total <= 0) return notify('Agrega productos al carrito.', true);
    for (const item of cart) {
      if (item.quantity > item.product.stock) return notify('No hay existencias suficientes.', true);
    }
    let cashPaid = 0, transferPaid = 0, change = 0, cashReceived = 0;
    if (state.method === 'efectivo') {
      cashReceived = parseMoney(document.getElementById('received')?.value || '');
      if (!Number.isSafeInteger(cashReceived) || cashReceived < total) return notify('El efectivo recibido debe cubrir el total.', true);
      cashPaid = total; change = cashReceived - total;
    } else if (state.method === 'transferencia') {
      transferPaid = total;
    } else {
      cashPaid = parseMoney(document.getElementById('cashPart')?.value || '');
      if (!Number.isSafeInteger(cashPaid) || cashPaid <= 0 || cashPaid >= total) return notify('Indica una parte en efectivo menor que el total.', true);
      transferPaid = total - cashPaid;
    }
    // Demonstration only; in real production, all these changes must be
    // one atomic, idempotent server-side SQL transaction.
    state.processing = true;
    try {
      const sale = {
        id:uuid(),number:String(state.sales.length + 1).padStart(4,'0'),
        sessionId:state.cash.id,createdAt:new Date().toISOString(),
        method:state.method,total:total,cashPaid:cashPaid,
        transferPaid:transferPaid,cashReceived:cashReceived,
        change:change,reference:document.getElementById('transferRef')?.value?.trim() || '',
        items:cart.map(function (r) {
          return {id:r.product.id,name:r.product.name,qty:r.quantity,
                  price:r.product.price,subtotal:r.subtotal};
        })
      };
      for (const item of cart) item.product.stock -= item.quantity;
      state.sales.unshift(sale);
      state.cart = {};
      receipt(sale);
      notify('Venta ficticia #' + sale.number + ' registrada.');
    } finally {
      state.processing = false;
      render();
    }
  }

  document.querySelectorAll('[data-page]').forEach(function (button) {
    button.addEventListener('click', function () { actionOpenPage(button.dataset.page); });
  });
  view.addEventListener('click', function (e) {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action.startsWith('go-')) return actionOpenPage(action.slice(3));
    if (action === 'add' || action === 'plus') return add(button.dataset.id, 1);
    if (action === 'minus') return add(button.dataset.id, -1);
    if (action === 'category') { state.category = button.dataset.category; return render(); }
    if (action === 'method') { state.method = button.dataset.method; return render(); }
    if (action === 'clear-cart') { state.cart = {}; render(); return notify('Carrito de demo limpiado.'); }
    if (action === 'checkout') return checkout();
    if (action === 'stock') {
      const p = state.products.find(function (row) { return row.id === button.dataset.id; });
      if (!p) return;
      const answer = prompt('¿Cuántas unidades de ' + p.name + ' quieres agregar en la demo?', '10');
      if (answer === null) return;
      if (!/^\d+$/.test(answer.trim()) || Number(answer) <= 0 || Number(answer) > 100000) return notify('Cantidad inválida.', true);
      p.stock += Number(answer);
      render();
      return notify('Existencias ficticias actualizadas.');
    }
    if (action === 'open-cash') {
      if (state.cash.open) return;
      state.cash = { open:true,opening:0,openedAt:new Date().toISOString(),id:uuid() };
      state.cart = {};render();notify('Caja de demostración abierta.');
    }
  });
  view.addEventListener('input', function (e) {
    if (e.target.id !== 'product-search') return;
    const value = e.target.value; const start = e.target.selectionStart;
    state.search = value;render();
    const input = document.getElementById('product-search');
    if (input) { input.focus(); input.setSelectionRange(start,start); }
  });
  view.addEventListener('submit', function (e) {
    e.preventDefault();
    const form = e.target;
    const values = new FormData(form);
    if (form.id === 'new-product') {
      const name = String(values.get('name') || '').trim();
      const price = parseMoney(values.get('price'));
      const stock = Number(values.get('stock'));
      if (name.length < 2 || name.length > 60 || !Number.isSafeInteger(price) || price <= 0 ||
          price > 10000000 || !Number.isInteger(stock) || stock < 0 || stock > 100000) return notify('Revisa el nombre, precio y stock.', true);
      state.products.push({id:uuid(),name,category:String(values.get('category') || 'Otros'),
        price,stock,unit:'unidad',emoji:'🥖'});
      render();notify('Producto de demostración agregado.');
    }
    if (form.id === 'new-expense') {
      if (!state.cash.open) return notify('Primero abre la caja.', true);
      const reason = String(values.get('reason') || '').trim();
      const amount = parseMoney(values.get('amount'));
      if (!reason || !Number.isSafeInteger(amount) || amount <= 0 || amount > Math.max(0,cashExpected())) return notify('Revisa el gasto y el dinero disponible en caja.', true);
      state.expenses.unshift({id:uuid(),sessionId:state.cash.id,amount,reason,createdAt:new Date().toISOString()});
      render();notify('Gasto ficticio anotado.');
    }
    if (form.id === 'close-cash') {
      if (!state.cash.open) return;
      const counted = parseMoney(values.get('counted'));
      if (!Number.isSafeInteger(counted) || counted < 0) return notify('Efectivo contado inválido.', true);
      const expected = cashExpected();
      const closed = {...state.cash,closedAt:new Date().toISOString(),expected,
                      counted,difference:counted-expected};
      state.sessions.unshift(closed);
      state.cash = {...state.cash,open:false};
      state.cart = {};
      render();
      notify('Caja de demo cerrada. Diferencia: ' + fmt(closed.difference));
    }
  });
  modalRoot.addEventListener('click', function (e) {
    const button = e.target.closest('[data-action]');
    if (button?.dataset.action === 'close-modal' || e.target.classList.contains('modal-overlay')) modalRoot.innerHTML = '';

  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') modalRoot.innerHTML = '';
    if (e.key === 'F2') {
      e.preventDefault();
      if (state.page !== 'ventas') actionOpenPage('ventas');
      const field = document.getElementById('product-search');
      if (field) field.focus();
    }
  });
  render();
})();
