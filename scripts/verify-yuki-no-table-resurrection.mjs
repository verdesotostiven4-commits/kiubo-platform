import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const pos=readFileSync("components/PosClientPro.tsx","utf8");
const need=[
  "linkedDraftWasClosed",
  'linkedDraftOrder.paymentStatus==="paid"',
  'linkedDraftOrder.status==="cancelled"',
  'linkedDraftOrder.status==="delivered"',
  "if(linkedDraftWasClosed){",
  'if(order.paymentStatus==="paid"||order.status==="cancelled"||order.status==="delivered")',
  "if(checkoutInProgressRef.current||Boolean(lastSaleId))",
  "setLastSaleId(\"\");const cartKey",
  "!checkoutInProgressRef.current&&!lastSaleId&&foodService",
  'if(linked&&(linked.paymentStatus==="paid"||linked.status==="delivered"||linked.status==="cancelled"))',
  "enqueueSaleTransaction(next",
  "saveLocalDatabase(next,{trackChanges:false})"
];
for(const item of need) assert.ok(pos.includes(item), "Missing paid-table protection: "+item);
const restored=pos.indexOf("if(linkedDraftWasClosed){");
const cartHydration=pos.indexOf("setCart(lines);setQuery");
assert.ok(restored>=0&&restored<cartHydration,"Check closed draft before restoring its products");
const guard=pos.indexOf("if(checkoutInProgressRef.current||Boolean(lastSaleId))");
const draftWriter=pos.indexOf("window.localStorage.setItem(key,JSON.stringify(draft))");
assert.ok(guard>=0&&guard<draftWriter,"Do not rewrite a completed payment as an open draft");
console.log("YUKI: closed paid tables cannot be restored or auto-saved as unpaid drafts");
