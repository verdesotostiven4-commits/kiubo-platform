import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

function readTSX(path) {
  const source = fs.readFileSync(path, 'utf8');
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0, path + ' has syntax errors');
  const output = ts.transpileModule(source, { fileName: path, reportDiagnostics: true, compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext
  } });
  assert.equal(output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  return source;
}
const command=readTSX('components/OrderPrintClient.tsx'),receipt=readTSX('components/ReceiptClient.tsx');
assert.match(command, /getTenantSettings\(db,ctx\.tenantId\)/);
assert.match(command, /paperWidth:settings\.receiptWidth==="58mm"\?"58mm":"80mm"/);
assert.match(command, /innerWidth=paperWidth==="58mm"\?"50mm":"72mm"/);
assert.match(command, /@page\{size:auto;margin:0\}/);
assert.match(command, /\$\{paperWidth\}!important/);
assert.match(command, /serviceMode==="delivery"/);
assert.match(command, /serviceMode==="takeaway"/);
assert.match(command, /onClick=\{\(\)=>window\.print\(\)\}/);
assert.doesNotMatch(command, /orderPaymentSummary|OrderPaymentSummary|payment-box|Forma de pago|Abonado|SALDO/);
assert.doesNotMatch(command, /saveLocalDatabase|enqueueSaleTransaction|queueFoodOrder/);
assert.match(receipt, /physicalWidth=data\.width==="58mm"\?"58mm":"80mm"/);
assert.match(receipt, /pageWidth=data\.width==="58mm"\?"50mm":"72mm"/);
assert.match(receipt, /@page\{size:auto;margin:0\}/);
assert.match(receipt, /onClick=\{\(\)=>window\.print\(\)\}/);
console.log('OK: CRM-308/80mm, 58mm alternate, kitchen/payment separation, no sale writes.');
