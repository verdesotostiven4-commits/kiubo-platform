import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import { join } from "node:path";

const root=process.cwd();
const text=path=>{const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")};

const store=text("lib/local-store.ts");
assert.ok(store.includes('FoodOrderPaymentStatus = "unpaid"|"partial"|"paid"'),"orders must support partial payment state");

const pos=text("components/PosClientPro.tsx");
for(const needle of ["creditInitialPayment","creditInitialMethod","enqueueCreditPaymentTransaction","creditPaymentCashMovementReason","saldo ${money(creditRemaining)}"]){assert.ok(pos.includes(needle),`POS partial payment flow missing: ${needle}`)}

const orders=text("components/FoodOrdersClientPro.tsx");
for(const needle of ["registerPayment","orderPaymentSummary","Guardar abono","paymentStatus:remaining<=.001?\"paid\":\"partial\""]){assert.ok(orders.includes(needle),`Order balance flow missing: ${needle}`)}

const print=text("components/OrderPrintClient.tsx");
for(const needle of ["Forma de pago","Abonado","SALDO","orderPaymentSummary"]){assert.ok(print.includes(needle),`Order print payment detail missing: ${needle}`)}

const cash=text("lib/cash-reconciliation.ts");
for(const needle of ["creditCollections","isCreditPaymentCashMovement","cashSales+creditCollections+manualIncome-cashOut"]){assert.ok(cash.includes(needle),`Cash reconciliation partial-payment guard missing: ${needle}`)}

const recovery=text("lib/command-recovery.ts");
assert.ok(recovery.includes('error.toLowerCase().includes("cash session not found")'),"stale local cash sessions must be removable when Cloud confirms they do not exist");
assert.ok(pos.includes("cashSessionStale")&&pos.includes("lleva abierta más de 24 horas"),"POS must block new cash against a stale multi-day session");

console.log("✓ Order Partial Payments V1 passed: balances, payment methods, print detail and cash classification are wired.");
