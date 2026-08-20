-- KIUBO Foundation v2 — SECURITY + SYNC DRAFT
-- Dedicated KIUBO backend only. Assumes SCHEMA_V1.sql.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,active boolean not null default true,created_at timestamptz not null default now()
);
create table if not exists public.tenant_member_branches (
  tenant_member_id uuid not null references public.tenant_members(id) on delete cascade,branch_id uuid not null references public.branches(id) on delete cascade,primary key(tenant_member_id,branch_id)
);
create table if not exists public.sync_receipts (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,client_operation_id text not null,
  entity_type text not null,entity_id text,processed_at timestamptz not null default now(),result jsonb not null default '{}'::jsonb,unique(tenant_id,client_operation_id)
);

alter table public.inventory_movements add column if not exists client_operation_id text;
alter table public.cash_sessions add column if not exists client_operation_id text;
alter table public.credit_movements add column if not exists client_operation_id text;
alter table public.invoice_events add column if not exists client_operation_id text;
create unique index if not exists inventory_movements_client_op_unique on public.inventory_movements(tenant_id,client_operation_id) where client_operation_id is not null;
create unique index if not exists cash_sessions_client_op_unique on public.cash_sessions(tenant_id,client_operation_id) where client_operation_id is not null;
create unique index if not exists credit_movements_client_op_unique on public.credit_movements(tenant_id,client_operation_id) where client_operation_id is not null;
create unique index if not exists invoice_events_client_op_unique on public.invoice_events(tenant_id,client_operation_id) where client_operation_id is not null;

alter table public.platform_admins enable row level security;
alter table public.tenant_member_branches enable row level security;
alter table public.sync_receipts enable row level security;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins p where p.user_id=auth.uid() and p.active=true);
$$;
create or replace function public.has_tenant_access(target_tenant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(select 1 from public.tenant_members tm where tm.tenant_id=target_tenant and tm.user_id=auth.uid() and tm.active=true);
$$;
create or replace function public.has_tenant_role(target_tenant uuid,allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(select 1 from public.tenant_members tm where tm.tenant_id=target_tenant and tm.user_id=auth.uid() and tm.active=true and tm.role=any(allowed_roles));
$$;
create or replace function public.has_branch_access(target_tenant uuid,target_branch uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(
    select 1 from public.tenant_members tm where tm.tenant_id=target_tenant and tm.user_id=auth.uid() and tm.active=true
      and (not exists(select 1 from public.tenant_member_branches x where x.tenant_member_id=tm.id)
        or exists(select 1 from public.tenant_member_branches x where x.tenant_member_id=tm.id and x.branch_id=target_branch))
  );
$$;
revoke all on function public.is_platform_admin() from public;
revoke all on function public.has_tenant_access(uuid) from public;
revoke all on function public.has_tenant_role(uuid,text[]) from public;
revoke all on function public.has_branch_access(uuid,uuid) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_tenant_access(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid,text[]) to authenticated;
grant execute on function public.has_branch_access(uuid,uuid) to authenticated;

-- Remove older policies before creating stricter v2 policies in a dedicated backend.
do $$
declare r record;
begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename=any(array[
    'tenants','tenant_members','branches','tenant_branding','tenant_settings','subscriptions','tenant_feature_overrides','tenant_products','inventory_movements','customers',
    'cash_registers','cash_sessions','sales','sale_items','payments','credit_accounts','credit_movements','tenant_sri_config','invoices','invoice_events','tenant_audit_logs','tenant_member_branches','sync_receipts'
  ]) loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop;
end $$;

create policy tenants_read on public.tenants for select to authenticated using(public.has_tenant_access(id));
create policy tenants_admin_update on public.tenants for update to authenticated using(public.has_tenant_role(id,array['owner','admin'])) with check(public.has_tenant_role(id,array['owner','admin']));
create policy members_read on public.tenant_members for select to authenticated using(user_id=auth.uid() or public.has_tenant_role(tenant_id,array['owner','admin']));
create policy members_manage on public.tenant_members for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin'])) with check(public.has_tenant_role(tenant_id,array['owner','admin']));
create policy branches_read on public.branches for select to authenticated using(public.has_branch_access(tenant_id,id));
create policy branches_manage on public.branches for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','manager']));
create policy products_read on public.tenant_products for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy products_write on public.tenant_products for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory']));
create policy inventory_read on public.inventory_movements for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy inventory_insert on public.inventory_movements for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory','cashier']) and public.has_branch_access(tenant_id,branch_id));
create policy customers_read on public.customers for select to authenticated using(public.has_tenant_access(tenant_id));
create policy customers_write on public.customers for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','manager','cashier'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','cashier']));
create policy sales_read on public.sales for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy sales_insert on public.sales for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','cashier']) and public.has_branch_access(tenant_id,branch_id));
create policy sales_admin_update on public.sales for update to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','manager']));
create policy sale_items_read on public.sale_items for select to authenticated using(public.has_tenant_access(tenant_id));
create policy sale_items_insert on public.sale_items for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','cashier']));
create policy payments_read on public.payments for select to authenticated using(public.has_tenant_access(tenant_id));
create policy payments_insert on public.payments for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','cashier']));
create policy cash_registers_read on public.cash_registers for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy cash_sessions_read on public.cash_sessions for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy credits_read on public.credit_accounts for select to authenticated using(public.has_tenant_access(tenant_id));
create policy credit_moves_read on public.credit_movements for select to authenticated using(public.has_tenant_access(tenant_id));
create policy branding_read on public.tenant_branding for select to authenticated using(public.has_tenant_access(tenant_id));
create policy settings_read on public.tenant_settings for select to authenticated using(public.has_tenant_access(tenant_id));
create policy sri_read on public.tenant_sri_config for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','accounting']));
create policy invoices_read on public.invoices for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy audit_read on public.tenant_audit_logs for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin']));

-- No client policies for sync_receipts/platform_admins and no client write policy for audit logs.
-- Idempotency must be transactional: sync receipt + domain mutation in one backend transaction.
