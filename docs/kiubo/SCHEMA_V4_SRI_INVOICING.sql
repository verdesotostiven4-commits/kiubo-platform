-- KIUBO Foundation v4 — ECUADOR SRI ELECTRONIC INVOICING
-- DRAFT ONLY. Dedicated KIUBO backend only.

create table if not exists public.sri_document_sequences (
  tenant_id uuid not null references public.tenants(id) on delete cascade,branch_id uuid not null references public.branches(id) on delete cascade,
  document_type text not null,establishment_code text not null check(establishment_code ~ '^[0-9]{3}$'),emission_point_code text not null check(emission_point_code ~ '^[0-9]{3}$'),
  next_value bigint not null default 1 check(next_value between 1 and 999999999),updated_at timestamptz not null default now(),
  primary key(tenant_id,branch_id,document_type,establishment_code,emission_point_code)
);
create table if not exists public.tenant_product_tax_profiles (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,master_product_id uuid references public.master_products(id) on delete cascade,
  local_product_key text,tax_code text not null default '2',percentage_code text not null,rate numeric(8,4) not null default 0,tax_kind text not null check(tax_kind in ('vat','no_object','exempt')),
  verified boolean not null default false,verified_by uuid references auth.users(id),verified_at timestamptz,updated_at timestamptz not null default now(),check(master_product_id is not null or local_product_key is not null)
);
create unique index if not exists tax_profile_master_unique on public.tenant_product_tax_profiles(tenant_id,master_product_id) where master_product_id is not null;
create unique index if not exists tax_profile_local_unique on public.tenant_product_tax_profiles(tenant_id,local_product_key) where local_product_key is not null;

alter table public.tenant_sri_config add column if not exists invoice_version text not null default '2.1.0';
alter table public.tenant_sri_config add column if not exists matrix_address text;
alter table public.tenant_sri_config add column if not exists establishment_address text;
alter table public.tenant_sri_config add column if not exists accounting_required boolean not null default false;
alter table public.tenant_sri_config add column if not exists rimpe_mode text not null default 'none' check(rimpe_mode in ('none','entrepreneur','popular'));
alter table public.tenant_sri_config add column if not exists certificate_label text;
alter table public.tenant_sri_config add column if not exists certificate_expires_at date;
alter table public.tenant_sri_config add column if not exists certificate_status text not null default 'unconfigured' check(certificate_status in ('unconfigured','metadata_only','server_ready'));
-- Never store P12/PFX bytes or certificate passwords in browser storage or plaintext DB columns.

alter table public.invoices add column if not exists client_operation_id text;
alter table public.invoices add column if not exists environment text check(environment in ('test','production'));
alter table public.invoices add column if not exists invoice_version text;
alter table public.invoices add column if not exists numeric_code text;
alter table public.invoices add column if not exists issuer_snapshot jsonb not null default '{}'::jsonb;
alter table public.invoices add column if not exists buyer_snapshot jsonb not null default '{}'::jsonb;
alter table public.invoices add column if not exists items_snapshot jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists tax_snapshot jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists payment_snapshot jsonb not null default '{}'::jsonb;
alter table public.invoices add column if not exists total_without_tax numeric(14,2);
alter table public.invoices add column if not exists tax_amount numeric(14,2);
alter table public.invoices add column if not exists total numeric(14,2);
alter table public.invoices add column if not exists last_error text;
create unique index if not exists invoices_access_key_unique on public.invoices(access_key) where access_key is not null;
create unique index if not exists invoice_client_operation_unique on public.invoices(tenant_id,client_operation_id) where client_operation_id is not null;
create unique index if not exists invoice_sale_unique on public.invoices(tenant_id,sale_id) where sale_id is not null and status<>'cancelled';

create table if not exists public.sri_transmission_attempts (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,invoice_id uuid not null references public.invoices(id) on delete cascade,
  stage text not null check(stage in ('sign','receive','authorize','notify')),attempt integer not null check(attempt>0),status text not null check(status in ('pending','ok','error')),
  response_code text,message text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),unique(invoice_id,stage,attempt)
);
alter table public.sri_document_sequences enable row level security;
alter table public.tenant_product_tax_profiles enable row level security;
alter table public.sri_transmission_attempts enable row level security;
create policy sri_sequences_read on public.sri_document_sequences for select to authenticated using(public.has_branch_access(tenant_id,branch_id));
create policy tax_profiles_read on public.tenant_product_tax_profiles for select to authenticated using(public.has_tenant_access(tenant_id));
create policy tax_profiles_manage on public.tenant_product_tax_profiles for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory','accounting'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','manager','inventory','accounting']));
create policy sri_attempts_read on public.sri_transmission_attempts for select to authenticated using(public.has_tenant_access(tenant_id));

create or replace function public.reserve_sri_sequence(p_tenant uuid,p_branch uuid,p_document_type text,p_establishment text,p_emission_point text)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_reserved bigint;
begin
  if not public.has_branch_access(p_tenant,p_branch) or not public.has_tenant_role(p_tenant,array['owner','admin','manager','cashier','accounting']) then raise exception 'not authorized'; end if;
  if p_establishment !~ '^[0-9]{3}$' or p_emission_point !~ '^[0-9]{3}$' then raise exception 'invalid establishment/emission point'; end if;
  insert into public.sri_document_sequences(tenant_id,branch_id,document_type,establishment_code,emission_point_code,next_value)
  values(p_tenant,p_branch,p_document_type,p_establishment,p_emission_point,2)
  on conflict(tenant_id,branch_id,document_type,establishment_code,emission_point_code)
  do update set next_value=public.sri_document_sequences.next_value+1,updated_at=now()
  returning next_value-1 into v_reserved;
  if v_reserved>999999999 then raise exception 'sequence exhausted'; end if;
  return v_reserved;
end $$;
revoke all on function public.reserve_sri_sequence(uuid,uuid,text,text,text) from public;
grant execute on function public.reserve_sri_sequence(uuid,uuid,text,text,text) to authenticated;

-- Trusted backend flow: reserve sequential -> freeze snapshot/access key -> build/validate XML -> sign server-side -> receive SRI -> authorize with retry -> store XML/RIDE privately -> notify/audit.
