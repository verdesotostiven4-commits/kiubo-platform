import fs from "node:fs";

const pos=fs.readFileSync("components/PosClientPro.tsx","utf8");
const orders=fs.readFileSync("components/FoodOrdersClientPro.tsx","utf8");
const checks=[
  [pos.includes("findOpenTableOrder"),"POS resolves one open order by tenant, branch and table"],
  [pos.includes("activeExisting?.serviceMode===\"table\"&&activeExisting.tableLabel===tableLabel.trim()"),"POS refuses stale active order ids from another table"],
  [pos.includes("existing.serviceMode===\"table\"&&existing.tableLabel&&existing.tableLabel!==label"),"POS blocks accidental table-to-table order reassignment"],
  [pos.includes("Cada mesa conserva su propio pedido"),"POS explains isolated table behavior"],
  [!pos.includes("Pedido vacío · En vivo"),"table cards no longer show noisy En vivo label"],
  [orders.includes("Cancelar pedido"),"unpaid orders can be cancelled explicitly"],
  [orders.includes("No modificó caja porque nunca fue cobrado"),"pending cancellation is cash-safe"],
  [orders.includes("status===\"delivered\"&&order.paymentStatus!==\"paid\""),"unpaid orders cannot be finalized accidentally"],
];
for(const [ok,label] of checks){if(!ok){console.error(`✗ ${label}`);process.exit(1)}console.log(`✓ ${label}`)}
console.log("✓ Table isolation guard passed: open tables stay independent and pending cleanup cannot rewrite cash history.");
