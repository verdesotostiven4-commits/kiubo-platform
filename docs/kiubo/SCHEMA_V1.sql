-- KIUBO Foundation v1 — draft only
-- IMPORTANT: NOT applied to Barrio MAX production.
-- Reference schema for the future dedicated KIUBO backend.

create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(), slug text not null unique, legal_name text, display_name text not null,
  status text not null default 'trial' check (status in ('trial','active','grace','suspended','cancelled')),
  country_code text not null default 'EC', timezone text not null default 'America/Guayaquil',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','cashier','inventory','accounting')),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (tenant_id,user_id)
);
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, code text not null, address text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,code)
);
create table if not exists public.tenant_branding (
  tenant_id uuid primary key references public.tenants(id) on delete cascade, logo_url text, icon_url text,
  primary_color text, secondary_color text, accent_color text, business_name_override text, updated_at timestamptz not null default now()
);
create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade, settings jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null, enabled boolean not null default true, limits jsonb not null default '{}'::jsonb, unique(plan_id,feature_key)
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id), status text not null check(status in ('trial','active','grace','suspended','cancelled')),
  trial_ends_at timestamptz,current_period_starts_at timestamptz,current_period_ends_at timestamptz,grace_ends_at timestamptz,suspended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists one_current_subscription_per_tenant on public.subscriptions(tenant_id) where status in ('trial','active','grace','suspended');
create table if not exists public.tenant_feature_overrides (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,feature_key text not null,
  enabled boolean not null,limits jsonb not null default '{}'::jsonb,reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,feature_key)
);

create table if not exists public.master_products (
  id uuid primary key default gen_random_uuid(), barcode text unique, canonical_name text not null, brand text, presentation text, category text,
  primary_image_url text, verified boolean not null default false, tax_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tenant_products (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,master_product_id uuid references public.master_products(id),barcode text,local_name text,
  cost numeric(14,4) check(cost is null or cost>=0),price numeric(14,4) not null check(price>=0),stock numeric(14,4) not null default 0,
  minimum_stock numeric(14,4) not null default 0,active boolean not null default true,tax_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists tenant_product_barcode_unique on public.tenant_products(tenant_id,branch_id,barcode) where barcode is not null;
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,tenant_product_id uuid not null references public.tenant_products(id),
  kind text not null check(kind in ('initial','purchase','sale','return','adjustment','transfer_in','transfer_out','waste')),
  quantity numeric(14,4) not null,reference_id uuid,note text,created_by uuid references auth.users(id),created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,id_type text,identification text,
  tax_name text,display_name text,email text,phone text,address text,metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists tenant_customer_identification_unique on public.customers(tenant_id,id_type,identification) where identification is not null;

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,name text not null,active boolean not null default true,created_at timestamptz not null default now()
);
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,cash_register_id uuid not null references public.cash_registers(id),
  opened_by uuid not null references auth.users(id),closed_by uuid references auth.users(id),opening_balance numeric(14,2) not null default 0,
  expected_closing_balance numeric(14,2),real_closing_balance numeric(14,2),difference numeric(14,2),status text not null default 'open' check(status in ('open','closed')),
  opened_at timestamptz not null default now(),closed_at timestamptz
);
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,cash_session_id uuid references public.cash_sessions(id),customer_id uuid references public.customers(id),
  sold_by uuid not null references auth.users(id),client_operation_id text not null,subtotal numeric(14,2) not null default 0,discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,total numeric(14,2) not null check(total>=0),status text not null default 'completed' check(status in ('pending','completed','voided')),
  metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,client_operation_id)
);
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,sale_id uuid not null references public.sales(id) on delete cascade,
  tenant_product_id uuid references public.tenant_products(id),product_name text not null,quantity numeric(14,4) not null check(quantity>0),unit_price numeric(14,4) not null check(unit_price>=0),
  unit_cost numeric(14,4),tax_rate numeric(8,4) not null default 0,tax_amount numeric(14,2) not null default 0,subtotal numeric(14,2) not null,total numeric(14,2) not null,snapshot jsonb not null default '{}'::jsonb
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,sale_id uuid not null references public.sales(id) on delete cascade,
  method text not null check(method in ('cash','transfer','card','credit','other')),amount numeric(14,2) not null check(amount>=0),metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

create table if not exists public.credit_accounts (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,customer_id uuid not null references public.customers(id) on delete cascade,
  balance numeric(14,2) not null default 0,status text not null default 'active' check(status in ('active','blocked','closed')),updated_at timestamptz not null default now(),unique(tenant_id,customer_id)
);
create table if not exists public.credit_movements (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,credit_account_id uuid not null references public.credit_accounts(id) on delete cascade,
  sale_id uuid references public.sales(id),kind text not null check(kind in ('charge','payment','adjustment')),amount numeric(14,2) not null,note text,created_by uuid references auth.users(id),created_at timestamptz not null default now()
);

create table if not exists public.tenant_sri_config (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,ruc text,legal_name text,establishment_code text,emission_point_code text,
  environment text check(environment in ('test','production')),settings jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now()
);
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,branch_id uuid not null references public.branches(id) on delete cascade,
  sale_id uuid references public.sales(id),customer_id uuid references public.customers(id),document_type text not null,establishment_code text not null,emission_point_code text not null,
  sequential text not null,access_key text,status text not null default 'draft' check(status in ('draft','signed','sent','authorized','rejected','cancelled')),
  xml_storage_path text,ride_storage_path text,authorization_metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(tenant_id,document_type,establishment_code,emission_point_code,sequential)
);
create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_type text not null,payload jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create table if not exists public.tenant_audit_logs (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,actor_user_id uuid references auth.users(id),
  action text not null,entity_type text,entity_id uuid,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.branches enable row level security;
alter table public.tenant_branding enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tenant_feature_overrides enable row level security;
alter table public.tenant_products enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.customers enable row level security;
alter table public.cash_registers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.payments enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_movements enable row level security;
alter table public.tenant_sri_config enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_events enable row level security;
alter table public.tenant_audit_logs enable row level security;

create or replace function public.has_tenant_access(target_tenant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.tenant_members tm where tm.tenant_id=target_tenant and tm.user_id=auth.uid() and tm.active=true);
$$;
revoke all on function public.has_tenant_access(uuid) from public;
grant execute on function public.has_tenant_access(uuid) to authenticated;

create policy tenants_select_member on public.tenants for select to authenticated using(public.has_tenant_access(id));
create policy branches_member_all on public.branches for all to authenticated using(public.has_tenant_access(tenant_id)) with check(public.has_tenant_access(tenant_id));
create policy tenant_products_member_all on public.tenant_products for all to authenticated using(public.has_tenant_access(tenant_id)) with check(public.has_tenant_access(tenant_id));
create policy customers_member_all on public.customers for all to authenticated using(public.has_tenant_access(tenant_id)) with check(public.has_tenant_access(tenant_id));
create policy sales_member_all on public.sales for all to authenticated using(public.has_tenant_access(tenant_id)) with check(public.has_tenant_access(tenant_id));

-- Production policies must be stricter than simple membership checks and enforce role/action permissions.
-- Global tables such as master_products and plans need their own read/write model.
