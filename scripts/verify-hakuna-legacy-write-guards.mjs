import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the actual legacy API branches without network or production data.
// Delivery-time stock must be changed through the atomic save_product RPC,
// never through older separate save_presentations / save_stock requests.
const source = readFileSync('supabase/functions/catalog-api/index.ts', 'utf8');
let writes = 0;
const db = {
  from() {
    writes++;
    const row = { id: 'product', stock_quantity: 20, stock_tracking: true, stock_initialized: true };
    const query = {
      update() { return query; }, eq() { return query; }, is() { return query; },
      select() { return query; }, async maybeSingle() { return { data: row, error: null }; }
    };
    return query;
  }
};
const context = {
  db, Date, Math, Number, Object,
  actor: { type: 'provider' },
  validUuid: () => true,
  cleanText: value => String(value ?? ''),
  validatePresentationsInput: () => {},
  savePresentations: async () => { writes++; return [{ id: 'presentation' }]; },
  logActivity: async () => {}
};
function branch(action) {
  const begin = source.indexOf(`  if (action === "${action}")`);
  assert.ok(begin > 0, `Missing ${action} handler`);
  const end = source.indexOf('\n  if (action === "', begin + 10);
  assert.ok(end > begin, `Missing boundary for ${action}`);
  const snippet = source.slice(begin, end).replaceAll(' as Json[]', '');
  return vm.runInNewContext(`async function run(action, account, body, accountId) {\n${snippet}\n}\nrun`, context);
}
const oldPresentations = branch('save_presentations');
const oldStock = branch('save_stock');
const body = { product_id: 'product', presentations: [{ name: 'Unidad', price: 1 }],
  stock_tracking: true, stock_quantity: 20, low_stock_threshold: 3, base_unit: 'unidad' };
for (const [action, run] of [['save_presentations', oldPresentations], ['save_stock', oldStock]]) {
  const before = writes;
  await assert.rejects(
    () => run(action, { inventory_policy: 'delivered' }, body, 'account'),
    error => error.message === 'client_update_required' && error.status === 409,
    `Legacy ${action} must request an update instead of touching delivered-inventory data`
  );
  assert.equal(writes, before, `Legacy ${action} must not write any row`);
}
const oldResult = await oldPresentations('save_presentations', { inventory_policy: 'created' }, body, 'account');
assert.equal(oldResult.presentations.length, 1, 'Other catalog policies keep their presentation editor');
const stockResult = await oldStock('save_stock', { inventory_policy: 'created' }, body, 'account');
assert.equal(stockResult.product.stock_quantity, 20, 'Other catalog policies keep their stock editor');
console.log('✓ Legacy separate presentation/stock writes are rejected for delivery inventory (409, zero writes); other businesses retain their existing routes.');
