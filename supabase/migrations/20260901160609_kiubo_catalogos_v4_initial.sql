-- KIUBO Catálogos v4 baseline.
-- Sanitized recovery source: tenant credentials and demo seed data are intentionally
-- NOT committed. Provision tenants through a trusted service path after migration.

create table public.catalog_accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  tagline text not null default 'Catálogo mayorista · pedidos fáciles',
  hero_title text not null default 'Tu negocio se abastece más fácil.',
  hero_subtitle text not null default 'Encuentra productos, elige cantidades y prepara tu pedido sin perder tiempo entre mensajes.',
  whatsapp text not null default '',
  logo_path text,
  logo_url text,
  accent text not null default '#f06a3a' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  accent_deep text not null default '#db4d22' check (accent_deep ~ '^#[0-9a-fA-F]{6}$'),
  currency text not null default 'USD' check (char_length(currency) = 3),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  is_open boolean not null default true,
  show_prices boolean not null default true,
  provider_pin_hash text not null,
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  icon text not null default 'box',
  sort_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, name)
);

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  category_id uuid references public.catalog_categories(id) on delete set null,
  sku text,
  name text not null check (char_length(name) between 2 and 120),
  brand text,
  description text,
  unit text,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  status text not null default 'available' check (status in ('available','low','out')),
  visible boolean not null default true,
  featured boolean not null default false,
  image_path text,
  image_url text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  phone text not null,
  business text,
  name text,
  last_address text,
  order_count integer not null default 0,
  total_spent numeric(14,2) not null default 0,
  first_order_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, phone)
);

create table public.catalog_order_counters (
  account_id uuid primary key references public.catalog_accounts(id) on delete cascade,
  next_value bigint not null default 1000
);

create table public.catalog_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  idempotency_key uuid not null,
  order_number text not null,
  customer_business text not null,
  customer_name text,
  customer_phone text not null,
  delivery_method text not null default 'delivery' check (delivery_method in ('delivery','pickup')),
  delivery_address text,
  notes text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'new' check (status in ('new','confirmed','preparing','dispatched','delivered','cancelled')),
  source text not null default 'catalog',
  whatsapp_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key),
  unique (account_id, order_number)
);

create table public.catalog_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.catalog_orders(id) on delete cascade,
  product_id uuid references public.catalog_products(id) on delete set null,
  product_name text not null,
  sku text,
  unit text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 999),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table public.catalog_provider_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  token_hash text not null unique,
  session_version integer not null,
  device_hash text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table public.catalog_pin_attempts (
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  attempt_key text not null,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (account_id, attempt_key)
);

create table public.catalog_activity_log (
  id bigint generated always as identity primary key,
  account_id uuid references public.catalog_accounts(id) on delete set null,
  actor_type text not null check (actor_type in ('provider','master','public','system')),
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index catalog_products_account_display_idx on public.catalog_products (account_id, archived_at, visible, sort_order, name);
create index catalog_products_category_idx on public.catalog_products (account_id, category_id) where archived_at is null;
create index catalog_orders_account_created_idx on public.catalog_orders (account_id, created_at desc);
create index catalog_orders_account_status_idx on public.catalog_orders (account_id, status, created_at desc);
create index catalog_order_items_order_idx on public.catalog_order_items (order_id);
create index catalog_sessions_account_idx on public.catalog_provider_sessions (account_id, expires_at) where revoked_at is null;
create index catalog_activity_account_idx on public.catalog_activity_log (account_id, created_at desc);

create or replace function public.catalog_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger catalog_accounts_touch before update on public.catalog_accounts for each row execute function public.catalog_touch_updated_at();
create trigger catalog_categories_touch before update on public.catalog_categories for each row execute function public.catalog_touch_updated_at();
create trigger catalog_products_touch before update on public.catalog_products for each row execute function public.catalog_touch_updated_at();
create trigger catalog_customers_touch before update on public.catalog_customers for each row execute function public.catalog_touch_updated_at();
create trigger catalog_orders_touch before update on public.catalog_orders for each row execute function public.catalog_touch_updated_at();

create or replace function public.catalog_check_pin(p_slug text, p_pin text, p_attempt_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_account public.catalog_accounts%rowtype;
  v_attempt public.catalog_pin_attempts%rowtype;
  v_attempts integer;
  v_blocked_until timestamptz;
begin
  if p_pin !~ '^[0-9]{4}$' or char_length(p_attempt_key) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into v_account from public.catalog_accounts where slug = p_slug;
  if not found then
    perform pg_sleep(0.18);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into public.catalog_pin_attempts (account_id, attempt_key)
  values (v_account.id, left(p_attempt_key,160))
  on conflict (account_id, attempt_key) do nothing;
  select * into v_attempt from public.catalog_pin_attempts
  where account_id=v_account.id and attempt_key=left(p_attempt_key,160) for update;
  if v_attempt.blocked_until is not null and v_attempt.blocked_until > now() then
    return jsonb_build_object('ok',false,'reason','blocked','retry_after',extract(epoch from (v_attempt.blocked_until-now()))::integer);
  end if;
  if v_attempt.window_started_at < now()-interval '15 minutes' then
    update public.catalog_pin_attempts set attempts=0,window_started_at=now(),blocked_until=null,updated_at=now()
    where account_id=v_account.id and attempt_key=left(p_attempt_key,160);
    v_attempt.attempts:=0;
  end if;
  if extensions.crypt(p_pin,v_account.provider_pin_hash)=v_account.provider_pin_hash then
    delete from public.catalog_pin_attempts where account_id=v_account.id and attempt_key=left(p_attempt_key,160);
    return jsonb_build_object('ok',true,'account_id',v_account.id,'session_version',v_account.session_version);
  end if;
  v_attempts:=v_attempt.attempts+1;
  v_blocked_until:=case when v_attempts>=5 then now()+interval '15 minutes' else null end;
  update public.catalog_pin_attempts set attempts=v_attempts,blocked_until=v_blocked_until,updated_at=now()
  where account_id=v_account.id and attempt_key=left(p_attempt_key,160);
  perform pg_sleep(0.18);
  return jsonb_build_object('ok',false,'reason',case when v_blocked_until is null then 'invalid' else 'blocked' end,'remaining',greatest(0,5-v_attempts));
end;
$$;

create or replace function public.catalog_set_pin(p_account_id uuid,p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin_must_be_4_digits'; end if;
  update public.catalog_accounts
  set provider_pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),session_version=session_version+1
  where id=p_account_id;
  if not found then raise exception 'account_not_found'; end if;
  update public.catalog_provider_sessions set revoked_at=now()
  where account_id=p_account_id and revoked_at is null;
end;
$$;

create or replace function public.catalog_create_order(p_slug text,p_idempotency_key uuid,p_customer jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_account public.catalog_accounts%rowtype;
  v_existing public.catalog_orders%rowtype;
  v_order_id uuid:=gen_random_uuid();
  v_counter bigint;
  v_number text;
  v_subtotal numeric(12,2):=0;
  v_item jsonb;
  v_product public.catalog_products%rowtype;
  v_quantity integer;
  v_business text:=trim(coalesce(p_customer->>'customer_business',''));
  v_name text:=nullif(trim(coalesce(p_customer->>'customer_name','')),'');
  v_phone text:=regexp_replace(coalesce(p_customer->>'customer_phone',''),'[^0-9]','','g');
  v_delivery text:=coalesce(p_customer->>'delivery_method','delivery');
  v_address text:=nullif(left(trim(coalesce(p_customer->>'delivery_address','')),160),'');
  v_notes text:=nullif(left(trim(coalesce(p_customer->>'notes','')),400),'');
begin
  select * into v_account from public.catalog_accounts where slug=p_slug for share;
  if not found then raise exception 'account_not_found'; end if;
  if not v_account.is_open then raise exception 'catalog_closed'; end if;
  select * into v_existing from public.catalog_orders
  where account_id=v_account.id and idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('id',v_existing.id,'public_token',v_existing.public_token,'order_number',v_existing.order_number,'total',v_existing.total,'whatsapp',v_account.whatsapp,'duplicate',true);
  end if;
  if char_length(v_business)<2 or char_length(v_business)>80 then raise exception 'invalid_customer'; end if;
  if char_length(v_phone)<11 or char_length(v_phone)>15 then raise exception 'invalid_phone'; end if;
  if v_delivery not in ('delivery','pickup') then raise exception 'invalid_delivery'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>80 then raise exception 'invalid_items'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity:=(v_item->>'quantity')::integer;
    if v_quantity<1 or v_quantity>999 then raise exception 'invalid_quantity'; end if;
    select * into v_product from public.catalog_products
    where id=(v_item->>'product_id')::uuid and account_id=v_account.id and archived_at is null and visible=true and status<>'out';
    if not found then raise exception 'product_unavailable'; end if;
    v_subtotal:=v_subtotal+(v_product.price*v_quantity);
  end loop;
  if v_subtotal<v_account.minimum_order then raise exception 'minimum_order'; end if;
  insert into public.catalog_order_counters(account_id,next_value) values(v_account.id,1001)
  on conflict(account_id) do update set next_value=public.catalog_order_counters.next_value+1
  returning next_value into v_counter;
  v_number:='PED-'||to_char(now() at time zone 'America/Guayaquil','YYMMDD')||'-'||lpad(v_counter::text,5,'0');
  insert into public.catalog_orders(id,account_id,idempotency_key,order_number,customer_business,customer_name,customer_phone,delivery_method,delivery_address,notes,subtotal,total)
  values(v_order_id,v_account.id,p_idempotency_key,v_number,v_business,v_name,v_phone,v_delivery,v_address,v_notes,v_subtotal,v_subtotal);
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity:=(v_item->>'quantity')::integer;
    select * into v_product from public.catalog_products
    where id=(v_item->>'product_id')::uuid and account_id=v_account.id;
    insert into public.catalog_order_items(order_id,product_id,product_name,sku,unit,unit_price,quantity,line_total)
    values(v_order_id,v_product.id,v_product.name,v_product.sku,v_product.unit,v_product.price,v_quantity,v_product.price*v_quantity);
  end loop;
  insert into public.catalog_customers(account_id,phone,business,name,last_address,order_count,total_spent)
  values(v_account.id,v_phone,v_business,v_name,v_address,1,v_subtotal)
  on conflict(account_id,phone) do update set
    business=excluded.business,
    name=coalesce(excluded.name,public.catalog_customers.name),
    last_address=coalesce(excluded.last_address,public.catalog_customers.last_address),
    order_count=public.catalog_customers.order_count+1,
    total_spent=public.catalog_customers.total_spent+excluded.total_spent,
    last_order_at=now(),updated_at=now();
  insert into public.catalog_activity_log(account_id,actor_type,action,entity_type,entity_id,metadata)
  values(v_account.id,'public','order.created','order',v_order_id::text,jsonb_build_object('order_number',v_number,'total',v_subtotal));
  return jsonb_build_object('id',v_order_id,'public_token',(select public_token from public.catalog_orders where id=v_order_id),'order_number',v_number,'total',v_subtotal,'whatsapp',v_account.whatsapp,'duplicate',false);
end;
$$;

alter table public.catalog_accounts enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_customers enable row level security;
alter table public.catalog_order_counters enable row level security;
alter table public.catalog_orders enable row level security;
alter table public.catalog_order_items enable row level security;
alter table public.catalog_provider_sessions enable row level security;
alter table public.catalog_pin_attempts enable row level security;
alter table public.catalog_activity_log enable row level security;

revoke all on public.catalog_accounts,public.catalog_categories,public.catalog_products,public.catalog_customers,public.catalog_order_counters,public.catalog_orders,public.catalog_order_items,public.catalog_provider_sessions,public.catalog_pin_attempts,public.catalog_activity_log from anon,authenticated;
grant all on public.catalog_accounts,public.catalog_categories,public.catalog_products,public.catalog_customers,public.catalog_order_counters,public.catalog_orders,public.catalog_order_items,public.catalog_provider_sessions,public.catalog_pin_attempts,public.catalog_activity_log to service_role;
grant usage,select on sequence public.catalog_activity_log_id_seq to service_role;

revoke all on function public.catalog_touch_updated_at() from public,anon,authenticated;
revoke all on function public.catalog_check_pin(text,text,text) from public,anon,authenticated;
revoke all on function public.catalog_set_pin(uuid,text) from public,anon,authenticated;
revoke all on function public.catalog_create_order(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.catalog_touch_updated_at() to service_role;
grant execute on function public.catalog_check_pin(text,text,text) to service_role;
grant execute on function public.catalog_set_pin(uuid,text) to service_role;
grant execute on function public.catalog_create_order(text,uuid,jsonb,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('catalog-assets-v4','catalog-assets-v4',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update
set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- No tenant/account rows are inserted here on purpose. A trusted provisioning path
-- must create the account with a non-public provider_pin_hash and then manage PIN
-- changes through public.catalog_set_pin().
