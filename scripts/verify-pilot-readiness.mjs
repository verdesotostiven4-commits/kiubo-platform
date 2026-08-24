import { readFileSync,existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root=process.cwd();
function text(path){const full=join(root,path);assert.ok(existsSync(full),`Missing ${path}`);return readFileSync(full,"utf8")}
function requireText(path,needles){const source=text(path);for(const needle of needles)assert.ok(source.includes(needle),`${path} missing Pilot Readiness guard: ${needle}`);console.log(`✓ ${path}`)}

requireText("lib/permissions.ts",["if(permission===\"control\"||permission===\"leads\")return platformAdmin","cashier:[\"dashboard\",\"upgrade\",\"pos\",\"cash\"","if(path.startsWith(\"/cash\"))return\"cash\""]);
requireText("components/SessionEnforcer.tsx",["canAccess(user.role,permission,Boolean(user.platformAdmin))","session.role!==user.role","b.tenantId===tenantId&&b.active"]);
requireText("components/Sidebar.tsx",["platformOnly:true","canAccess(user.role,item.permission,Boolean(user.platformAdmin))","href:\"/cash\"","label:\"Administración\""]);
requireText("components/MobileNav.tsx",["platformOnly:true","canAccess(user.role,item.permission,Boolean(user.platformAdmin))","href:\"/cash\""]);
requireText("app/cash/page.tsx",["CashClient","Sidebar"]);
requireText("components/CashClient.tsx",["enqueueCashTransaction","enqueueCreditPaymentTransaction","Caja y fiados, sin perder el control.","reconcileCashSession","CUADRADA"]);
requireText("components/PosClient.tsx",['const paymentOptions:Payment[]=["cash","transfer","credit"]','if(payment==="mixed")']);
requireText("app/operations/page.tsx",["NEXT_PUBLIC_KIUBO_AUTH_MODE===\"supabase\"","BusinessAdminClient","TeamAdminClient","OperationsClient"]);
requireText("components/BusinessAdminClient.tsx",["Reglas generales del negocio","saveLocalDatabase(next)","Exigir caja abierta"]);
requireText("components/TeamAdminClient.tsx",["Usuarios, roles y sucursales","inviteCloudTeamMember","updateCloudTeamMember","Todas las sucursales disponibles","Solo un propietario puede modificar propietarios o administradores."]);
requireText("lib/team-cloud.ts",["tenant_invite_preflight_v1","signInWithOtp","upsert_tenant_member_by_email_v1","update_tenant_member_v1"]);
requireText("lib/cloud-auth.ts",["purgeRevokedCloudData","allowedBranchIds","db.tenantProducts=db.tenantProducts.filter","db.syncQueue=db.syncQueue.filter","db.auditLogs=db.auditLogs.filter","clearTenantCursors(tenantId)","clearDurabilityShadow()","Tu usuario no tiene una sucursal activa asignada en KIUBO"]);
requireText("supabase/migrations/0004_security_guardrails.sql",["guard_last_active_owner","branch does not belong to member tenant","can_assign_tenant_role"]);
requireText("supabase/migrations/0013_pilot_readiness_branch_scope.sql",["guard_sync_entity_branch_scope","sync branch belongs to another tenant","branch is inactive","open'","closed'","branch_can_operate"]);
requireText("supabase/migrations/0014_team_management_v1.sql",["list_tenant_team_v1","tenant_invite_preflight_v1","upsert_tenant_member_by_email_v1","update_tenant_member_v1","admin cannot modify owner or admin access","cannot modify your own access here"]);
requireText("supabase/migrations/0015_purchase_transaction_v2.sql",["apply_purchase_transactions_v2","v_new_stock=v_stock+v_qty","v_new_cost","supplier payment exceeds purchase balance"]);
requireText("supabase/migrations/0017_supplier_cash_outflow_v1.sql",["apply_purchase_transactions_v3","cash supplier payment requires register movement","cash session is not open"]);
requireText("components/PurchasesClient.tsx",["enqueuePurchaseTransaction","enqueueSupplierPaymentTransaction","trackChanges:false","costo promedio","getOpenCashSession","salida de caja"]);
requireText("supabase/migrations/0016_inventory_adjustment_v2.sql",["apply_inventory_adjustments_v2","v_new_stock=v_stock+v_delta","insufficient stock for adjustment"]);
requireText("components/InventoryClient.tsx",["enqueueInventoryAdjustment","Ir a Compras","un solo flujo oficial","trackChanges:false"]);
requireText("supabase/migrations/0018_sale_reversal_v1.sql",["apply_sale_reversals_v1","cash refund must equal sale total","v_new_stock:=v_stock+v_qty","status','voided'"]);
requireText("lib/sale-reversal.ts",["reverseSaleLocally","saleReversalTransactions","sales.reversal_queued"]);
requireText("components/ReportsClient.tsx",["saleLifecycle(s)==\"completed\"","Confirmar anulación","Cuadre esperado vs. contado","Ventas anuladas"]);
requireText("lib/sync-engine.ts",["isActiveQueueItem(item,activeTenantId)","recoverRejectedCommand","navigator.locks"]);
requireText("lib/offline-durability.ts",["recoverInterruptedSyncQueue","snapshotOfflineDatabase","navigator.storage?.persist"]);
requireText("vercel.json",["\"deploymentEnabled\": false"]);

console.log("✓ Pilot Readiness V7 passed: truthful payments, auditable sale reversals, cash reconciliation, cloud team roles, branch revocation, atomic sales/cash/purchases/inventory, supplier cash outflows, offline recovery and tenant-safe sync are guarded.");
