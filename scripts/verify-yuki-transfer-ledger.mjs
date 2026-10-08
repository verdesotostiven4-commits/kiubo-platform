import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const code=ts.transpileModule(readFileSync("lib/transfer-events.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function("module","exports",code)(module,module.exports);
const {transferPaymentEvents,totalValidTransfers}=module.exports;
const tenantId="yuki",otherTenant="other",branchId="main";
const at="2026-10-07T23:00:00Z";
const sale=(id,payment,total,extra={})=>({id,tenantId,branchId,createdAt:at,payment,total,items:[],...extra});
const credit=(id,saleId,kind)=>({id,tenantId,branchId,saleId,kind,originalAmount:40,balance:20,status:"open"});
const payment=(id,creditId,amount,method)=>({id,tenantId,branchId,creditId,amount,method,createdAt:at});
const db={
  sales:[
    sale("direct","transfer",20),
    sale("mixed","mixed",30,{paymentBreakdown:{cash:10,transfer:20}}),
    sale("mixed-legacy","mixed",10),
    sale("partial","partial",40),
    sale("fiado","credit",50),
    sale("void","transfer",15,{status:"voided"}),
    sale("invalid","mixed",20,{paymentBreakdown:{cash:-2,transfer:22}}),
    sale("direct","transfer",20,{clientOperationId:"different"}),
    {...sale("direct","transfer",100),tenantId:otherTenant},
  ],
  orders:[],
  credits:[credit("cp","partial","partial"),credit("cf","fiado","fiado")],
  creditPayments:[payment("p1","cp",10,"transfer"),payment("p2","cp",5,"cash"),payment("p3","cf",8,"transfer"),payment("p3","cf",8,"transfer")],
  cashMovements:[{tenantId,branchId,type:"in",reason:"Pago mixto · venta mixed-legacy",amount:4}],
};
const rows=transferPaymentEvents(db,tenantId,branchId);
assert.equal(rows.length,7,"must include six unique sales + two distinct abonos, excluding other tenant");
assert.equal(rows.filter(x=>x.status==="registrada").length,5);
assert.equal(rows.find(x=>x.saleId==="invalid")?.status,"revisar");
assert.equal(rows.find(x=>x.saleId==="void")?.status,"anulada");
assert.equal(rows.find(x=>x.saleId==="mixed-legacy")?.amount,6);
assert.equal(rows.find(x=>x.saleId==="mixed")?.amount,20);
assert.equal(rows.filter(x=>x.id.endsWith(":p3")).length,1,"duplicate payment must not double count");
assert.equal(totalValidTransfers(rows),64,"20 direct + 20 mixed + 6 legacy + 10 partial + 8 fiado");
assert.equal(totalValidTransfers(rows.filter(r=>r.at==="2026-10-07T23:00:00Z")),64);
const cash=readFileSync("components/CashClient.tsx","utf8"),reports=readFileSync("components/ReportsClientPro.tsx","utf8");
assert.ok(cash.includes("transferPaymentEvents(db,ctx.tenantId,ctx.branchId)"));
assert.ok(cash.includes("totalValidTransfers(visibleTransfers)"));
assert.ok(cash.includes("Detalle de transacciones por transferencia"));
assert.ok(reports.includes('href="#total-productos-vendidos"'));
assert.ok(reports.includes('id="total-productos-vendidos"'));
assert.ok(reports.includes('parseOperationalItemName(item.name)'));
assert.ok(reports.includes('productKind(p)'));
assert.ok(!reports.includes('sales.filter(s=>s.payment===method)'),"report must not count nominal sale totals as cash receipts");
console.log("✓ YUKI transfer events: direct/mixed/legacy/partial/fiado/void/invalid/duplicates/tenant isolation PASS");
console.log("✓ Cash details, complete product table and received-payments summary integration PASS");
