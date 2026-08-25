import { readFileSync,existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root=process.cwd();
function text(path){const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")}
function requireText(path,needles){const source=text(path);for(const needle of needles)assert.ok(source.includes(needle),`${path} missing Pilot Readiness guard: ${needle}`);console.log(`✓ ${path}`)}

requireText("lib/permissions.ts",["if(permission===\"control\"||permission===\"leads\")return platformAdmin","cashier:[\"dashboard\",\"upgrade\",\"pos\",\"cash\"","if(path.startsWith(\"/orders\")||path.startsWith(\"/order-print\")||path.startsWith(\"/receipt\"))return\"pos\"","if(path.startsWith(\"/cash\"))return\"cash\""]);
requireText("components/SessionEnforcer.tsx",["canAccess(user.role,permission,Boolean(user.platformAdmin))","session.role!==user.role","b.tenantId===tenantId&&b.active"]);
requireText("components/Sidebar.tsx",["platformOnly:true","canAccess(user.role,item.permission,Boolean(user.platformAdmin))","href:\"/orders\"","businessTypes:[\"food_service\"]","href:\"/cash\"","label:\"Administración\""]);
requireText("components/MobileNav.tsx",["platformOnly:true","canAccess(user.role,item.permission,Boolean(user.platformAdmin))","href:\"/orders\"","businessTypes:[\"food_service\"]","href:\"/cash\""]);
requireText("app/cash/page.tsx",["CashClient","Sidebar"]);
requireText("components/CashClient.tsx",["enqueueCashTransaction","enqueueCreditPaymentTransaction","Caja y fiados, sin perder el control.","reconcileCashSession","CUADRADA"]);
requireText("components/PosClient.tsx",['const paymentOptions:Payment[]=["cash","transfer","credit"]','if(payment==="mixed")']);
requireText("app/operations/page.tsx",["NEXT_PUBLIC_KIUBO_AUTH_MODE===\"supabase\"","BusinessAdminClient","TeamAdminClient","OperationsClient"]);
requireText("components/BusinessAdminClient.tsx",["Reglas generales del negocio","saveLocalDatabase(next)","Exigir caja abierta"]);
requireText("components/TeamAdminClient.tsx",["Usuarios, roles y sucursales","inviteCloudTeamMember","updateCloudTeamMember","Todas las sucursales disponibles","Solo un propietario puede modificar propietarios o administradores."]);
requireText("lib/team-cloud.ts",["tenant_invite_preflight_v1","signInWithOtp","upsert_tenant_member_by_email_v1","update_tenant_member_v1"]);
requireText("lib/cloud-auth.ts",["purgeRevokedCloudData","allowedBranchIds","db.tenantProducts=db.tenantProducts.filter","db.orders=db.orders.filter","db.syncQueue=db.syncQueue.filter","db.auditLogs=db.auditLogs.filter","clearTenantCursors(tenantId)","clearDurabilityShadow()","Tu usuario no tiene una sucursal activa asignada en KIUBO"]);
requireText("supabase/migrations/0004_security_guardrails.sql",["guard_last_active_owner","branch does not belong to member tenant","can_assign_tenant_role"]);
requireText("supabase/migrations/0013_pilot_readiness_branch_scope.sql",["guard_sync_entity_branch_scope","sync branch belongs to another tenant","branch is inactive","open'","closed'","branch_can_operate"]);
requireText("supabase/migrations/0014_team_management_v1.sql",["list_tenant_team_v1","tenant_invite_preflight_v1","upsert_tenant_member_by_email_v1","update_tenant_member_v1","admin cannot modify owner or admin access","cannot modify your own access here"]);
requireText("supabase/migrations/0015_purchase_transaction_v2.sql",["apply_purchase_transactions_v2","v_new_stock=v_stock+v_qty","v_new_cost","supplier payment exceeds purchase balance"]);
requireText("supabase/migrations/0017_supplier_cash_outflow_v1.sql",["apply_purchase_transactions_v3","cash supplier payment requires register movement","cash session is not open"]);
requireText("supabase/migrations/0019_payment_idempotency_v1.sql",["apply_finance_transactions_v2_legacy","apply_purchase_transactions_v3_legacy","duplicatePayment","duplicateSupplierPayment","duplicatePurchase","duplicateOpen","duplicateMovement","duplicateClose"]);
requireText("components/PurchasesClient.tsx",["enqueuePurchaseTransaction","enqueueSupplierPaymentTransaction","trackChanges:false","costo promedio","getOpenCashSession","salida de caja"]);
requireText("supabase/migrations/0016_inventory_adjustment_v2.sql",["apply_inventory_adjustments_v2","v_new_stock=v_stock+v_delta","insufficient stock for adjustment"]);
requireText("components/InventoryClient.tsx",["enqueueInventoryAdjustment","Ir a Compras","un solo flujo oficial","trackChanges:false"]);
requireText("supabase/migrations/0018_sale_reversal_v1.sql",["apply_sale_reversals_v1","sale reversal window expired","array['owner','admin']","cash refund must equal sale total","v_new_stock:=v_stock+v_qty","status','voided'"]);
requireText("lib/sale-reversal.ts",["reverseSaleLocally","saleReversalTransactions","Solo propietario o administrador","24*60*60*1000","sales.reversal_queued"]);
const provider=text("lib/data-provider.ts");
for(const needle of ["atomicOnlyCommand","apply_sale_transactions_v2","apply_sale_reversals_v1","apply_finance_transactions_v2","apply_purchase_transactions_v3","apply_inventory_adjustments_v2","Motor Cloud de ventas pendiente de activación","Motor Cloud de caja y fiados pendiente de activación","Motor Cloud de compras y pagos pendiente de activación","Motor Cloud de ajustes de inventario pendiente de activación"])assert.ok(provider.includes(needle),`lib/data-provider.ts missing Pilot Readiness atomic guard: ${needle}`);
for(const forbidden of ["fallbackSaleOperations","fallbackSaleReversalOperations","fallbackFinanceOperations","fallbackPurchaseOperations","fallbackInventoryAdjustmentOperations"])assert.ok(!provider.includes(forbidden),`Pilot transaction path must not use unsafe compatibility fallback: ${forbidden}`);
assert.ok(!provider.includes("apply_finance_transactions_v2_legacy"),"Client must not bypass finance payment idempotency wrapper");
assert.ok(!provider.includes("apply_purchase_transactions_v3_legacy"),"Client must not bypass purchase payment idempotency wrapper");
requireText("components/ReportsClient.tsx",["saleLifecycle(s)===\"completed\"","Confirmar anulación","Solo propietario o administrador","Cuadre esperado vs. contado","Ventas anuladas"]);
requireText("lib/cash-reconciliation.ts",["reconcileCashSession","session.openingAmount+cashSales+manualIncome-cashOut"]);
requireText("lib/sync-engine.ts",["isActiveQueueItem(item,activeTenantId)","recoverRejectedCommand","navigator.locks"]);
requireText("lib/offline-durability.ts",["recoverInterruptedSyncQueue","snapshotOfflineDatabase","navigator.storage?.persist"]);
const vercel=JSON.parse(text("vercel.json"));
assert.equal(vercel?.git?.deploymentEnabled?.main,true,"vercel.json must allow production deployments from main");
assert.equal(vercel?.git?.deploymentEnabled?.["*"],false,"vercel.json must keep feature branch deployments disabled");
console.log("✓ vercel.json production-only deployment policy");

console.log("✓ Pilot Readiness V12 passed: coupled money/stock commands stay atomic-only, Food Service private routes remain protected, revoked order data is purged, and only main can deploy to Vercel.");
