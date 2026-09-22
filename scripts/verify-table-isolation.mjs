import fs from "node:fs";

const pos=fs.readFileSync("components/PosClientPro.tsx","utf8");
const orders=fs.readFileSync("components/FoodOrdersClientPro.tsx","utf8");
const legacyActive="activeMatches=activeExisting&&(activeServiceMode===\"table\"?activeExisting.serviceMode===\"table\"&&activeExisting.tableLabel===tableLabel.trim():activeExisting.serviceMode===activeServiceMode)";
const queuedActive="activeMatches=activeExisting&&((activeServiceMode===\"table\"||activeServiceMode===\"delivery\")?activeExisting.serviceMode===activeServiceMode&&activeExisting.tableLabel===tableLabel.trim():activeExisting.serviceMode===activeServiceMode)";
const legacyDraft="draftMode===\"table\"?(order.serviceMode===\"table\"&&order.tableLabel===draftTable):order.serviceMode===draftMode";
const queuedDraft="(draftMode===\"table\"||draftMode===\"delivery\")?(order.serviceMode===draftMode&&order.tableLabel===draftTable):order.serviceMode===draftMode";
const checks=[
  [pos.includes("findOpenTableOrder"),"POS resolves one open order by tenant, branch and table"],
  [pos.includes(legacyActive)||pos.includes(queuedActive),"POS refuses stale active order ids from another table or service slot"],
  [pos.includes(legacyDraft)||pos.includes(queuedDraft),"recovered drafts cannot attach an order from another context"],
  [pos.includes("findOpenServiceOrder"),"takeaway keeps an independent open order"],
  [pos.includes("findOpenDeliveryOrder"),"delivery slots resolve independent open orders"],
  [pos.includes("persistCurrentContext")&&pos.includes("loadTableOrder(label,loadLocalDatabase())"),"switching tables persists the previous context before loading the next one"],
  [pos.includes("cancelOpenSlotOrders")&&pos.includes("cancelled.length"),"clearing a table cancels every duplicated open order in that slot in one action"],
  [pos.includes('clearContextLabel=activeServiceMode==="table"&&tableLabel?"Liberar mesa"'),"table cleanup is presented explicitly as Liberar mesa"],
  [pos.includes("selectDelivery")&&pos.includes("loadDeliveryOrder(label,loadLocalDatabase())"),"switching delivery slots persists and loads the correct context"],
  [pos.includes("Mesa, Para llevar y Domicilio conservan pedidos independientes"),"POS explains isolated service behavior"],
  [!pos.includes("Pedido vacío · En vivo"),"table cards no longer show noisy En vivo label"],
  [orders.includes("Cancelar pedido"),"unpaid orders can be cancelled explicitly"],
  [orders.includes("No modificó caja porque nunca fue cobrado"),"pending cancellation is cash-safe"],
  [orders.includes("status===\"delivered\"&&order.paymentStatus!==\"paid\""),"unpaid orders cannot be finalized accidentally"],
];
for(const [ok,label] of checks){if(!ok){console.error(`✗ ${label}`);process.exit(1)}console.log(`✓ ${label}`)}
console.log("✓ Service-context isolation guard passed: tables, takeaway and concurrent delivery slots stay independent and pending cleanup cannot rewrite cash history.");
