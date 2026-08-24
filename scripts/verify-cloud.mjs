import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [
  ["supabase/migrations/0001_core_multitenant.sql", ["platform_admins", "tenant_members", "subscriptions", "enable row level security"]],
  ["supabase/migrations/0002_sync_substrate.sql", ["apply_sync_operations", "pull_sync_changes", "can_sync_entity", "sync_receipts"]],
  ["supabase/migrations/0003_platform_provisioning.sql", ["platform_provision_tenant", "platform_set_tenant_plan", "platform_set_tenant_status"]],
  ["supabase/migrations/0004_security_guardrails.sql", ["guard_last_active_owner", "branch_belongs_to_tenant", "can_assign_tenant_role"]],
  ["supabase/migrations/0005_sync_payload_guardrails.sql", ["normalize_sync_payload", "payload tenant mismatch", "branch does not belong to tenant", "sync payload too large"]],
  ["supabase/migrations/0006_email_owner_provisioning.sql", ["platform_provision_tenant_by_email", "platform admin required", "owner auth user not found"]],
  ["supabase/migrations/0007_auth_security_performance_hardening.sql", ["revoke execute on all functions", "subscriptions_plan_code_idx", "tenant_members_user_id_idx"]],
  ["supabase/migrations/0008_product_payload_validation.sql", ["sync_tenant_products_payload_sane", "between 1 and 160", "between 1 and 96", "payload->>'barcode'"]],
  ["supabase/migrations/0009_sync_revision_cursor.sql", ["sync_entity_revision_seq", "pull_sync_changes_v2", "revision>v_after", "hasMore"]],
  ["supabase/migrations/0010_sales_stock_transaction_v2.sql", ["apply_sale_transactions_v2", "pg_advisory_xact_lock", "for update", "v_new_stock=v_stock-v_qty", "sync_receipts"]],
  ["supabase/migrations/0011_finance_transaction_v2.sql", ["apply_finance_transactions_v2", "cashTransactions", "creditPaymentTransactions", "sync_tenant_products_stock_nonnegative"]],
  ["supabase/migrations/0012_stock_conflict_guard.sql", ["sync_tenant_products_stock_nonnegative", "sync_nonnegative_number", "not valid"]],
  ["supabase/migrations/0013_pilot_readiness_branch_scope.sql", ["guard_sync_entity_branch_scope", "sync branch belongs to another tenant", "branch is inactive", "branch_can_operate"]],
  ["supabase/migrations/0014_team_management_v1.sql", ["list_tenant_team_v1", "tenant_invite_preflight_v1", "upsert_tenant_member_by_email_v1", "update_tenant_member_v1", "auth.users", "admin cannot modify owner or admin access"]],
  ["supabase/migrations/0015_purchase_transaction_v2.sql", ["apply_purchase_transactions_v2", "purchaseTransactions", "supplierPaymentTransactions", "v_new_cost", "supplier payment exceeds purchase balance", "sync_receipts"]],
  ["supabase/migrations/0016_inventory_adjustment_v2.sql", ["apply_inventory_adjustments_v2", "inventoryAdjustmentTransactions", "for update", "insufficient stock for adjustment", "sync_receipts"]],
  ["supabase/migrations/0017_supplier_cash_outflow_v1.sql", ["apply_purchase_transactions_v3", "cash supplier payment requires register movement", "cash session is not open", "cashMovements", "type','out'"]],
  ["supabase/migrations/0018_sale_reversal_v1.sql", ["apply_sale_reversals_v1", "saleReversalTransactions", "cash refund must equal sale total", "v_new_stock:=v_stock+v_qty", "status','voided'", "sync_receipts"]],
  ["lib/cloud-control.ts", ["signInWithOtp", "platform_provision_tenant_by_email", "/set-password"]],
  ["lib/team-cloud.ts", ["list_tenant_team_v1", "tenant_invite_preflight_v1", "signInWithOtp", "upsert_tenant_member_by_email_v1", "update_tenant_member_v1"]],
  ["components/SetPasswordClient.tsx", ["updateUser", "new-password", "Guardar y entrar"]],
  ["app/api/health/route.ts", ["auth/v1/health", "next_public_kiubo_auth_mode", "next_public_kiubo_data_mode"]],
];

let failed = false;
for (const [relative, needles] of checks) {
  const path = join(root, relative);
  if (!existsSync(path)) {console.error(`✗ Missing ${relative}`);failed = true;continue}
  const text = readFileSync(path, "utf8").toLowerCase();let fileFailed = false;
  for (const needle of needles) {if (!text.includes(String(needle).toLowerCase())) {console.error(`✗ ${relative} missing guard: ${needle}`);fileFailed = true;failed = true}}
  if (!fileFailed) console.log(`✓ ${relative}`);
}
const env = readFileSync(join(root, ".env.example"), "utf8");
for (const key of ["NEXT_PUBLIC_KIUBO_AUTH_MODE","NEXT_PUBLIC_KIUBO_DATA_MODE","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {if (!env.includes(key)) {console.error(`✗ .env.example missing ${key}`);failed = true}}
if (failed) {console.error("KIUBO cloud verification failed.");process.exit(1)}
console.log("✓ KIUBO cloud foundation verification passed.");
