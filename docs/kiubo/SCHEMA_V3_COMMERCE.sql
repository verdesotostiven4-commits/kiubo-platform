-- KIUBO Foundation v3 — PURCHASES / PAYABLES / BRANDING
-- Dedicated KIUBO backend only. Requires V1 + V2.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  identification text,legal_name text not null,email text,phone text,address text,active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_tenant_identification_unique on public.suppliers(tenant_id,identification) where identification is not null and identification<>'';
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),client_operation_id text not null,document_type text not null default 'invoice' check(document_type in ('invoice','note','receipt','other')),
  document_number text,document_date date not null,due_date date,subtotal numeric(14,2) not null default 0,tax_amount numeric(14,2) not null default 0,total numeric(14,2) not null check(total>=0),
  paid_amount numeric(14,2) not null default 0 check(paid_amount>=0),payment_status text not null default 'pending' check(payment_status in ('pending','partial','paid')),
  status text not null default 'received' check(status in ('received','cancelled')),notes text,created_by uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,client_operation_id)
);
create index if not exists purchases_tenant_branch_date_idx on public.purchases(tenant_id,branch_id,document_date desc);
create index if not exists purchases_due_open_idx on public.purchases(tenant_id,due_date) where payment_status<>'paid' and status='received';
create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,purchase_id uuid not null references public.purchases(id) on delete cascade,
  tenant_product_id uuid not null references public.tenant_products(id),product_name text not null,quantity numeric(14,4) not null check(quantity>0),unit_cost numeric(14,4) not null check(unit_cost>=0),subtotal numeric(14,2) not null check(subtotal>=0),snapshot jsonb not null default '{}'::jsonb
);
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),purchase_id uuid not null references public.purchases(id) on delete cascade,client_operation_id text not null,
  amount numeric(14,2) not null check(amount>0),method text not null check(method in ('cash','transfer','card','other')),note text,paid_by uuid references auth.users(id),created_at timestamptz not null default now(),unique(tenant_id,client_operation_id)
);
alter table public.tenant_branding add column if not exists receipt_tagline text;
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_payments enable row level security;

create policy suppliers_read on public.suppliers for select to authenticated using(public.has_tenant_access(tenant_id));
create policy suppliers_manage on public.suppliers for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory']));
create policy purchases_read on public.purchases for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy purchases_write on public.purchases for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory']) and public.has_branch_access(tenant_id,branch_id));
create policy purchase_items_read on public.purchase_items for select to authenticated using(public.has_tenant_access(tenant_id));
create policy supplier_payments_read on public.supplier_payments for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
-- Production: purchase+inventory+cost and payment+balance must be transactional/idempotent.
