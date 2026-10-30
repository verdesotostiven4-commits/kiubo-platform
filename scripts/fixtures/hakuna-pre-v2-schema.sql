-- Schema-only capture before Hakuna v2: no production rows, credentials or photos.

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

create table public.tenants(id uuid primary key);

create table public."catalog_accounts"(
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "name" text not null,
  "tagline" text default 'Catálogo mayorista · pedidos fáciles'::text not null,
  "hero_title" text default 'Tu negocio se abastece más fácil.'::text not null,
  "hero_subtitle" text default 'Encuentra productos, elige cantidades y prepara tu pedido sin perder tiempo entre mensajes.'::text not null,
  "whatsapp" text default ''::text not null,
  "logo_path" text,
  "logo_url" text,
  "accent" text default '#f06a3a'::text not null,
  "accent_deep" text default '#db4d22'::text not null,
  "currency" text default 'USD'::text not null,
  "minimum_order" numeric(12,2) default 0 not null,
  "is_open" boolean default true not null,
  "show_prices" boolean default true not null,
  "provider_pin_hash" text not null,
  "session_version" integer default 1 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "tenant_id" uuid,
  "public_base_url" text,
  "allowed_origins" text[] default '{}'::text[] not null,
  "payment_methods" text[] default ARRAY['cash'::text, 'transfer'::text] not null,
  "payment_details" jsonb default '{}'::jsonb not null
);

create table public."catalog_activity_log"(
  "id" bigint generated always as identity not null,
  "account_id" uuid,
  "actor_type" text not null,
  "actor_id" text,
  "action" text not null,
  "entity_type" text,
  "entity_id" text,
  "metadata" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."catalog_categories"(
  "id" uuid default gen_random_uuid() not null,
  "account_id" uuid not null,
  "name" text not null,
  "icon" text default 'box'::text not null,
  "sort_order" integer default 0 not null,
  "visible" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."catalog_customers"(
  "id" uuid default gen_random_uuid() not null,
  "account_id" uuid not null,
  "phone" text not null,
  "business" text,
  "name" text,
  "last_address" text,
  "order_count" integer default 0 not null,
  "total_spent" numeric(14,2) default 0 not null,
  "first_order_at" timestamp with time zone default now(),
  "last_order_at" timestamp with time zone default now(),
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."catalog_order_counters"(
  "account_id" uuid not null,
  "next_value" bigint default 1000 not null
);

create table public."catalog_order_items"(
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid not null,
  "product_id" uuid,
  "product_name" text not null,
  "sku" text,
  "unit" text,
  "unit_price" numeric(12,2) not null,
  "quantity" integer not null,
  "line_total" numeric(12,2) not null,
  "created_at" timestamp with time zone default now() not null,
  "item_note" text,
  "presentation_id" uuid,
  "presentation_name" text,
  "units_per_presentation" integer default 1 not null,
  "base_units" integer not null
);

create table public."catalog_order_rate_limits"(
  "account_id" uuid not null,
  "rate_key" text not null,
  "request_count" integer default 0 not null,
  "window_started_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."catalog_orders"(
  "id" uuid default gen_random_uuid() not null,
  "account_id" uuid not null,
  "public_token" uuid default gen_random_uuid() not null,
  "idempotency_key" uuid not null,
  "order_number" text not null,
  "customer_business" text not null,
  "customer_name" text,
  "customer_phone" text not null,
  "delivery_method" text default 'delivery'::text not null,
  "delivery_address" text,
  "notes" text,
  "subtotal" numeric(12,2) not null,
  "total" numeric(12,2) not null,
  "status" text default 'new'::text not null,
  "source" text default 'catalog'::text not null,
  "whatsapp_opened_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "inventory_committed" boolean default false not null,
  "delivery_lat" numeric(9,6),
  "delivery_lng" numeric(9,6),
  "delivery_location_label" text,
  "payment_method" text,
  "payment_status" text default 'pending'::text not null,
  "payment_reference" text,
  "cancellation_reason" text,
  "cancelled_by" text
);

create table public."catalog_pin_attempts"(
  "account_id" uuid not null,
  "attempt_key" text not null,
  "attempts" integer default 0 not null,
  "window_started_at" timestamp with time zone default now() not null,
  "blocked_until" timestamp with time zone,
  "updated_at" timestamp with time zone default now() not null
);

create table public."catalog_product_presentations"(
  "id" uuid default gen_random_uuid() not null,
  "account_id" uuid not null,
  "product_id" uuid not null,
  "name" text not null,
  "unit_label" text default 'unidad'::text not null,
  "units_per_presentation" integer default 1 not null,
  "price" numeric(12,2) not null,
  "compare_at_price" numeric(12,2),
  "sku" text,
  "visible" boolean default true not null,
  "is_default" boolean default false not null,
  "sort_order" integer default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "cost_total" numeric(12,2),
  "unit_cost" numeric(12,4) generated always as (
CASE
    WHEN ((cost_total IS NULL) OR (units_per_presentation IS NULL) OR (units_per_presentation <= 0)) THEN NULL::numeric
    ELSE round((cost_total / (units_per_presentation)::numeric), 4)
END) stored,
  "unit_sale_value" numeric(12,4) generated always as (
CASE
    WHEN ((price IS NULL) OR (units_per_presentation IS NULL) OR (units_per_presentation <= 0)) THEN NULL::numeric
    ELSE round((price / (units_per_presentation)::numeric), 4)
END) stored,
  "image_url" text,
  "image_path" text,
  "promo_active" boolean default false not null,
  "promo_price" numeric(12,2),
  "promo_label" text
);

create table public."catalog_products"(
  "id" uuid default gen_random_uuid() not null,
  "account_id" uuid not null,
  "category_id" uuid,
  "sku" text,
  "name" text not null,
  "brand" text,
  "description" text,
  "unit" text,
  "price" numeric(12,2) not null,
  "compare_at_price" numeric(12,2),
  "status" text default 'available'::text not null,
  "visible" boolean default true not null,
  "featured" boolean default false not null,
  "image_path" text,
  "image_url" text,
  "sort_order" integer default 0 not null,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "stock_tracking" boolean default false not null,
  "stock_quantity" integer default 0 not null,
  "low_stock_threshold" integer default 5 not null,
  "base_unit" text default 'unidad'::text not null,
  "allow_item_note" boolean default true not null,
  "tax_percent" numeric(5,2) default 0 not null,
  "source_classification" text,
  "source_category_label" text,
  "source_stock_branch" integer,
  "source_reported_at" timestamp with time zone,
  "source_seller" text,
  "stock_initialized" boolean default false not null
);

create table public."catalog_provider_sessions"(
  "id" uuid default gen_random_uuid() not null,
  "account_id" uuid not null,
  "token_hash" text not null,
  "session_version" integer not null,
  "device_hash" text,
  "created_at" timestamp with time zone default now() not null,
  "last_seen_at" timestamp with time zone default now() not null,
  "expires_at" timestamp with time zone not null,
  "revoked_at" timestamp with time zone
);

create table public."catalog_push_config"(
  "account_id" uuid not null,
  "vapid_public_key" text not null,
  "vapid_private_key" text not null,
  "subject" text default 'mailto:soporte@kiubo.app'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

create table public."catalog_push_events"(
  "event_key" text not null,
  "account_id" uuid not null,
  "created_at" timestamp with time zone default now() not null
);

create table public."catalog_push_subscriptions"(
  "id" uuid default gen_random_uuid() not null,
  "account_id" uuid not null,
  "audience" text not null,
  "order_public_token" uuid,
  "endpoint" text not null,
  "p256dh" text not null,
  "auth" text not null,
  "user_agent" text,
  "active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);

alter table public."catalog_accounts" add constraint "catalog_accounts_accent_check" CHECK ((accent ~ '^#[0-9a-fA-F]{6}$'::text));

alter table public."catalog_accounts" add constraint "catalog_accounts_accent_deep_check" CHECK ((accent_deep ~ '^#[0-9a-fA-F]{6}$'::text));

alter table public."catalog_accounts" add constraint "catalog_accounts_currency_check" CHECK ((char_length(currency) = 3));

alter table public."catalog_accounts" add constraint "catalog_accounts_minimum_order_check" CHECK ((minimum_order >= (0)::numeric));

alter table public."catalog_accounts" add constraint "catalog_accounts_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 80)));

alter table public."catalog_accounts" add constraint "catalog_accounts_slug_check" CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text));

alter table public."catalog_activity_log" add constraint "catalog_activity_log_actor_type_check" CHECK ((actor_type = ANY (ARRAY['provider'::text, 'master'::text, 'public'::text, 'system'::text])));

alter table public."catalog_categories" add constraint "catalog_categories_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 60)));

alter table public."catalog_order_items" add constraint "catalog_order_items_base_units_positive" CHECK ((base_units >= 1));

alter table public."catalog_order_items" add constraint "catalog_order_items_item_note_length" CHECK (((item_note IS NULL) OR (char_length(item_note) <= 180)));

alter table public."catalog_order_items" add constraint "catalog_order_items_line_total_check" CHECK ((line_total >= (0)::numeric));

alter table public."catalog_order_items" add constraint "catalog_order_items_quantity_check" CHECK (((quantity >= 1) AND (quantity <= 999)));

alter table public."catalog_order_items" add constraint "catalog_order_items_unit_price_check" CHECK ((unit_price >= (0)::numeric));

alter table public."catalog_order_items" add constraint "catalog_order_items_units_per_presentation_positive" CHECK ((units_per_presentation >= 1));

alter table public."catalog_orders" add constraint "catalog_orders_delivery_lat_range" CHECK (((delivery_lat IS NULL) OR ((delivery_lat >= ('-90'::integer)::numeric) AND (delivery_lat <= (90)::numeric))));

alter table public."catalog_orders" add constraint "catalog_orders_delivery_lng_range" CHECK (((delivery_lng IS NULL) OR ((delivery_lng >= ('-180'::integer)::numeric) AND (delivery_lng <= (180)::numeric))));

alter table public."catalog_orders" add constraint "catalog_orders_delivery_location_pair" CHECK (((delivery_lat IS NULL) = (delivery_lng IS NULL)));

alter table public."catalog_orders" add constraint "catalog_orders_delivery_method_check" CHECK ((delivery_method = ANY (ARRAY['delivery'::text, 'pickup'::text])));

alter table public."catalog_orders" add constraint "catalog_orders_payment_status_check" CHECK ((payment_status = ANY (ARRAY['pending'::text, 'reported'::text, 'verified'::text, 'paid'::text, 'cancelled'::text])));

alter table public."catalog_orders" add constraint "catalog_orders_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'confirmed'::text, 'preparing'::text, 'dispatched'::text, 'delivered'::text, 'cancelled'::text])));

alter table public."catalog_orders" add constraint "catalog_orders_subtotal_check" CHECK ((subtotal >= (0)::numeric));

alter table public."catalog_orders" add constraint "catalog_orders_total_check" CHECK ((total >= (0)::numeric));

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_cost_total_nonnegative" CHECK (((cost_total IS NULL) OR (cost_total >= (0)::numeric)));

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_price_check" CHECK ((price >= (0)::numeric));

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_promo_price_check" CHECK (((promo_price IS NULL) OR (promo_price >= (0)::numeric)));

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_promo_price_nonnegative" CHECK (((promo_price IS NULL) OR (promo_price >= (0)::numeric)));

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_units_per_presentation_check" CHECK (((units_per_presentation > 0) AND (units_per_presentation <= 100000)));

alter table public."catalog_products" add constraint "catalog_products_compare_at_price_check" CHECK (((compare_at_price IS NULL) OR (compare_at_price >= (0)::numeric)));

alter table public."catalog_products" add constraint "catalog_products_low_stock_threshold_nonnegative" CHECK ((low_stock_threshold >= 0));

alter table public."catalog_products" add constraint "catalog_products_name_check" CHECK (((char_length(name) >= 2) AND (char_length(name) <= 120)));

alter table public."catalog_products" add constraint "catalog_products_price_check" CHECK ((price >= (0)::numeric));

alter table public."catalog_products" add constraint "catalog_products_source_stock_branch_nonnegative" CHECK (((source_stock_branch IS NULL) OR (source_stock_branch >= 0)));

alter table public."catalog_products" add constraint "catalog_products_status_check" CHECK ((status = ANY (ARRAY['available'::text, 'low'::text, 'out'::text])));

alter table public."catalog_products" add constraint "catalog_products_stock_quantity_nonnegative" CHECK ((stock_quantity >= 0));

alter table public."catalog_products" add constraint "catalog_products_tax_percent_check" CHECK (((tax_percent >= (0)::numeric) AND (tax_percent <= (100)::numeric)));

alter table public."catalog_push_subscriptions" add constraint "catalog_push_subscriptions_audience_check" CHECK ((audience = ANY (ARRAY['provider'::text, 'customer'::text])));

alter table public."catalog_accounts" add constraint "catalog_accounts_pkey" PRIMARY KEY (id);

alter table public."catalog_activity_log" add constraint "catalog_activity_log_pkey" PRIMARY KEY (id);

alter table public."catalog_categories" add constraint "catalog_categories_pkey" PRIMARY KEY (id);

alter table public."catalog_customers" add constraint "catalog_customers_pkey" PRIMARY KEY (id);

alter table public."catalog_order_counters" add constraint "catalog_order_counters_pkey" PRIMARY KEY (account_id);

alter table public."catalog_order_items" add constraint "catalog_order_items_pkey" PRIMARY KEY (id);

alter table public."catalog_order_rate_limits" add constraint "catalog_order_rate_limits_pkey" PRIMARY KEY (account_id, rate_key);

alter table public."catalog_orders" add constraint "catalog_orders_pkey" PRIMARY KEY (id);

alter table public."catalog_pin_attempts" add constraint "catalog_pin_attempts_pkey" PRIMARY KEY (account_id, attempt_key);

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_pkey" PRIMARY KEY (id);

alter table public."catalog_products" add constraint "catalog_products_pkey" PRIMARY KEY (id);

alter table public."catalog_provider_sessions" add constraint "catalog_provider_sessions_pkey" PRIMARY KEY (id);

alter table public."catalog_push_config" add constraint "catalog_push_config_pkey" PRIMARY KEY (account_id);

alter table public."catalog_push_events" add constraint "catalog_push_events_pkey" PRIMARY KEY (event_key);

alter table public."catalog_push_subscriptions" add constraint "catalog_push_subscriptions_pkey" PRIMARY KEY (id);

alter table public."catalog_accounts" add constraint "catalog_accounts_slug_key" UNIQUE (slug);

alter table public."catalog_categories" add constraint "catalog_categories_account_id_name_key" UNIQUE (account_id, name);

alter table public."catalog_customers" add constraint "catalog_customers_account_id_phone_key" UNIQUE (account_id, phone);

alter table public."catalog_orders" add constraint "catalog_orders_account_id_idempotency_key_key" UNIQUE (account_id, idempotency_key);

alter table public."catalog_orders" add constraint "catalog_orders_account_id_order_number_key" UNIQUE (account_id, order_number);

alter table public."catalog_orders" add constraint "catalog_orders_public_token_key" UNIQUE (public_token);

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_product_id_name_key" UNIQUE (product_id, name);

alter table public."catalog_provider_sessions" add constraint "catalog_provider_sessions_token_hash_key" UNIQUE (token_hash);

alter table public."catalog_push_subscriptions" add constraint "catalog_push_subscriptions_account_id_endpoint_key" UNIQUE (account_id, endpoint);

alter table public."catalog_accounts" add constraint "catalog_accounts_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

alter table public."catalog_activity_log" add constraint "catalog_activity_log_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE SET NULL;

alter table public."catalog_categories" add constraint "catalog_categories_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_customers" add constraint "catalog_customers_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_order_counters" add constraint "catalog_order_counters_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_order_items" add constraint "catalog_order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES catalog_orders(id) ON DELETE CASCADE;

alter table public."catalog_order_items" add constraint "catalog_order_items_presentation_id_fkey" FOREIGN KEY (presentation_id) REFERENCES catalog_product_presentations(id) ON DELETE SET NULL;

alter table public."catalog_order_items" add constraint "catalog_order_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE SET NULL;

alter table public."catalog_order_rate_limits" add constraint "catalog_order_rate_limits_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_orders" add constraint "catalog_orders_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_pin_attempts" add constraint "catalog_pin_attempts_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_product_presentations" add constraint "catalog_product_presentations_product_id_fkey" FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE;

alter table public."catalog_products" add constraint "catalog_products_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_products" add constraint "catalog_products_category_id_fkey" FOREIGN KEY (category_id) REFERENCES catalog_categories(id) ON DELETE SET NULL;

alter table public."catalog_provider_sessions" add constraint "catalog_provider_sessions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_push_config" add constraint "catalog_push_config_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_push_events" add constraint "catalog_push_events_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

alter table public."catalog_push_subscriptions" add constraint "catalog_push_subscriptions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES catalog_accounts(id) ON DELETE CASCADE;

CREATE INDEX catalog_sessions_account_idx ON public.catalog_provider_sessions USING btree (account_id, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX catalog_activity_account_idx ON public.catalog_activity_log USING btree (account_id, created_at DESC);

CREATE UNIQUE INDEX catalog_accounts_tenant_unique_idx ON public.catalog_accounts USING btree (tenant_id) WHERE (tenant_id IS NOT NULL);

CREATE INDEX catalog_products_account_display_idx ON public.catalog_products USING btree (account_id, archived_at, visible, sort_order, name);

CREATE INDEX catalog_products_category_idx ON public.catalog_products USING btree (account_id, category_id) WHERE (archived_at IS NULL);

CREATE INDEX catalog_products_category_fk_idx ON public.catalog_products USING btree (category_id);

CREATE INDEX catalog_order_items_order_idx ON public.catalog_order_items USING btree (order_id);

CREATE INDEX catalog_order_items_product_fk_idx ON public.catalog_order_items USING btree (product_id);

CREATE INDEX catalog_order_items_presentation_idx ON public.catalog_order_items USING btree (presentation_id);

CREATE INDEX catalog_order_rate_limits_updated_idx ON public.catalog_order_rate_limits USING btree (updated_at);

CREATE INDEX catalog_product_presentations_account_idx ON public.catalog_product_presentations USING btree (account_id, product_id, sort_order);

CREATE INDEX catalog_product_presentations_active_promo_idx ON public.catalog_product_presentations USING btree (account_id, product_id) WHERE (promo_active = true);

CREATE INDEX catalog_product_presentations_product_idx ON public.catalog_product_presentations USING btree (product_id);

CREATE UNIQUE INDEX catalog_product_presentations_one_default ON public.catalog_product_presentations USING btree (product_id) WHERE is_default;

CREATE INDEX catalog_push_subscriptions_provider_idx ON public.catalog_push_subscriptions USING btree (account_id, audience, active);

CREATE INDEX catalog_push_subscriptions_order_idx ON public.catalog_push_subscriptions USING btree (account_id, order_public_token, active) WHERE (order_public_token IS NOT NULL);

CREATE INDEX catalog_orders_account_created_idx ON public.catalog_orders USING btree (account_id, created_at DESC);

CREATE INDEX catalog_orders_account_status_idx ON public.catalog_orders USING btree (account_id, status, created_at DESC);

CREATE INDEX catalog_orders_payment_method_idx ON public.catalog_orders USING btree (account_id, payment_method);

CREATE INDEX catalog_push_events_account_id_idx ON public.catalog_push_events USING btree (account_id);

CREATE OR REPLACE FUNCTION public.catalog_check_order_rate(p_slug text, p_rate_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account_id uuid;
  v_limit public.catalog_order_rate_limits%rowtype;
begin
  if p_rate_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select id into v_account_id
  from public.catalog_accounts
  where slug = p_slug;

  if v_account_id is null then
    raise exception 'account_not_found';
  end if;

  insert into public.catalog_order_rate_limits (account_id, rate_key, request_count)
  values (v_account_id, p_rate_key, 0)
  on conflict (account_id, rate_key) do nothing;

  select * into v_limit
  from public.catalog_order_rate_limits
  where account_id = v_account_id and rate_key = p_rate_key
  for update;

  if v_limit.window_started_at < now() - interval '10 minutes' then
    update public.catalog_order_rate_limits
    set request_count = 1, window_started_at = now(), updated_at = now()
    where account_id = v_account_id and rate_key = p_rate_key;
    return true;
  end if;

  if v_limit.request_count >= 30 then
    update public.catalog_order_rate_limits
    set updated_at = now()
    where account_id = v_account_id and rate_key = p_rate_key;
    return false;
  end if;

  update public.catalog_order_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where account_id = v_account_id and rate_key = p_rate_key;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_check_pin(p_slug text, p_pin text, p_attempt_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account public.catalog_accounts%rowtype;
  v_attempt public.catalog_pin_attempts%rowtype;
  v_global public.catalog_pin_attempts%rowtype;
  v_attempts integer;
  v_global_attempts integer;
  v_blocked_until timestamptz;
  v_global_blocked_until timestamptz;
  v_key text := left(p_attempt_key, 160);
  v_global_key constant text := '__account_global__';
begin
  if p_pin !~ '^[0-9]{4}$' or char_length(p_attempt_key) < 16 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_account
  from public.catalog_accounts
  where slug = p_slug;

  if not found then
    perform pg_sleep(0.18);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Account-wide throttle prevents bypassing the per-client limit by rotating
  -- user-agent/device identifiers against a 4-digit provider PIN.
  insert into public.catalog_pin_attempts (account_id, attempt_key)
  values (v_account.id, v_global_key)
  on conflict (account_id, attempt_key) do nothing;

  select * into v_global
  from public.catalog_pin_attempts
  where account_id = v_account.id and attempt_key = v_global_key
  for update;

  if v_global.window_started_at < now() - interval '15 minutes' then
    update public.catalog_pin_attempts
    set attempts = 0, window_started_at = now(), blocked_until = null, updated_at = now()
    where account_id = v_account.id and attempt_key = v_global_key;
    v_global.attempts := 0;
    v_global.blocked_until := null;
  end if;

  if v_global.blocked_until is not null and v_global.blocked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'reason', 'blocked',
      'retry_after', extract(epoch from (v_global.blocked_until - now()))::integer
    );
  end if;

  insert into public.catalog_pin_attempts (account_id, attempt_key)
  values (v_account.id, v_key)
  on conflict (account_id, attempt_key) do nothing;

  select * into v_attempt
  from public.catalog_pin_attempts
  where account_id = v_account.id and attempt_key = v_key
  for update;

  if v_attempt.blocked_until is not null and v_attempt.blocked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'reason', 'blocked',
      'retry_after', extract(epoch from (v_attempt.blocked_until - now()))::integer
    );
  end if;

  if v_attempt.window_started_at < now() - interval '15 minutes' then
    update public.catalog_pin_attempts
    set attempts = 0, window_started_at = now(), blocked_until = null, updated_at = now()
    where account_id = v_account.id and attempt_key = v_key;
    v_attempt.attempts := 0;
  end if;

  if extensions.crypt(p_pin, v_account.provider_pin_hash) = v_account.provider_pin_hash then
    delete from public.catalog_pin_attempts
    where account_id = v_account.id and attempt_key in (v_key, v_global_key);

    return jsonb_build_object(
      'ok', true,
      'account_id', v_account.id,
      'session_version', v_account.session_version
    );
  end if;

  v_attempts := v_attempt.attempts + 1;
  v_blocked_until := case when v_attempts >= 5 then now() + interval '15 minutes' else null end;

  update public.catalog_pin_attempts
  set attempts = v_attempts, blocked_until = v_blocked_until, updated_at = now()
  where account_id = v_account.id and attempt_key = v_key;

  v_global_attempts := v_global.attempts + 1;
  v_global_blocked_until := case when v_global_attempts >= 30 then now() + interval '15 minutes' else null end;

  update public.catalog_pin_attempts
  set attempts = v_global_attempts, blocked_until = v_global_blocked_until, updated_at = now()
  where account_id = v_account.id and attempt_key = v_global_key;

  perform pg_sleep(0.18);

  return jsonb_build_object(
    'ok', false,
    'reason', case when v_blocked_until is not null or v_global_blocked_until is not null then 'blocked' else 'invalid' end,
    'remaining', greatest(0, 5 - v_attempts)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_create_order(p_slug text, p_idempotency_key uuid, p_customer jsonb, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account public.catalog_accounts%rowtype;
  v_existing public.catalog_orders%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_counter bigint;
  v_number text;
  v_subtotal numeric(12,2) := 0;
  v_item jsonb;
  v_product public.catalog_products%rowtype;
  v_presentation public.catalog_product_presentations%rowtype;
  v_product_id uuid;
  v_presentation_id uuid;
  v_quantity integer;
  v_item_note text;
  v_units_per integer;
  v_base_units integer;
  v_effective_price numeric(12,2);
  v_needed_by_product jsonb := '{}'::jsonb;
  v_product_ids uuid[];
  v_resolved_items jsonb := '[]'::jsonb;
  v_business text := trim(coalesce(p_customer->>'customer_business',''));
  v_name text := nullif(trim(coalesce(p_customer->>'customer_name','')),'');
  v_phone text := regexp_replace(coalesce(p_customer->>'customer_phone',''),'[^0-9]','','g');
  v_delivery text := coalesce(p_customer->>'delivery_method','delivery');
  v_address text := nullif(left(trim(coalesce(p_customer->>'delivery_address','')),160),'');
  v_notes text := nullif(left(trim(coalesce(p_customer->>'notes','')),400),'');
  v_payment_method text := nullif(trim(coalesce(p_customer->>'payment_method','')),'');
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
  if v_payment_method is not null and v_payment_method not in ('cash','transfer','card','credit','other') then raise exception 'invalid_request'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>80 then raise exception 'invalid_items'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) value
    where coalesce(value->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then raise exception 'invalid_items'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) value
    where coalesce(value->>'quantity','') !~ '^[1-9][0-9]{0,2}$'
  ) then raise exception 'invalid_quantity'; end if;

  select array_agg(distinct (value->>'product_id')::uuid order by (value->>'product_id')::uuid)
  into v_product_ids
  from jsonb_array_elements(p_items) as value
  where value->>'product_id' is not null;

  if v_product_ids is null or array_length(v_product_ids,1) is null then raise exception 'invalid_items'; end if;

  perform 1 from public.catalog_products
  where id=any(v_product_ids) and account_id=v_account.id
  order by id
  for update;

  -- Re-check now before validating stock: a duplicate request may have waited
  -- on the same product lock while the winning request committed.
  select * into v_existing from public.catalog_orders
  where account_id=v_account.id and idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('id',v_existing.id,'public_token',v_existing.public_token,'order_number',v_existing.order_number,'total',v_existing.total,'whatsapp',v_account.whatsapp,'duplicate',true);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity<1 or v_quantity>999 then raise exception 'invalid_quantity'; end if;

    v_product_id := (v_item->>'product_id')::uuid;
    select * into v_product from public.catalog_products
    where id=v_product_id and account_id=v_account.id
      and archived_at is null and visible=true and status<>'out';
    if not found then raise exception 'product_unavailable'; end if;

    v_presentation_id := null;
    if nullif(v_item->>'presentation_id','') is not null
       and left(v_item->>'presentation_id',7)<>'legacy-' then
      begin
        v_presentation_id := (v_item->>'presentation_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid_presentation';
      end;
    end if;

    if v_presentation_id is not null then
      select * into v_presentation
      from public.catalog_product_presentations
      where id=v_presentation_id and product_id=v_product_id and account_id=v_account.id and visible=true
      for share;
      if not found then raise exception 'invalid_presentation'; end if;
    else
      select * into v_presentation
      from public.catalog_product_presentations
      where product_id=v_product_id and account_id=v_account.id and visible=true
      order by is_default desc,sort_order,id
      limit 1
      for share;
      if not found then
        if exists (
          select 1 from public.catalog_product_presentations
          where product_id=v_product_id and account_id=v_account.id
        ) then
          raise exception 'product_unavailable';
        end if;
        v_presentation := null;
      end if;
    end if;

    v_units_per := coalesce(v_presentation.units_per_presentation,1);
    v_effective_price := coalesce(v_presentation.price,v_product.price);
    if coalesce(v_presentation.promo_active,false)
       and v_presentation.promo_price is not null
       and v_presentation.promo_price>=0
       and v_presentation.promo_price<v_effective_price then
      v_effective_price := v_presentation.promo_price;
    end if;

    v_base_units := v_quantity*v_units_per;
    v_item_note := nullif(left(trim(coalesce(v_item->>'item_note','')),180),'');
    if not coalesce(v_product.allow_item_note,true) then v_item_note := null; end if;

    v_needed_by_product := jsonb_set(
      v_needed_by_product,array[v_product_id::text],
      to_jsonb(coalesce((v_needed_by_product->>(v_product_id::text))::integer,0)+v_base_units)
    );

    v_resolved_items := v_resolved_items || jsonb_build_array(jsonb_build_object(
      'product_id',v_product.id,'product_name',v_product.name,'sku',v_product.sku,'unit',v_product.unit,
      'unit_price',v_effective_price,'quantity',v_quantity,'line_total',v_effective_price*v_quantity,
      'item_note',v_item_note,'presentation_id',v_presentation.id,
      'presentation_name',coalesce(v_presentation.name,v_product.unit),
      'units_per_presentation',v_units_per,'base_units',v_base_units
    ));
    v_subtotal := v_subtotal+(v_effective_price*v_quantity);
  end loop;

  for v_product_id in select jsonb_object_keys(v_needed_by_product)::uuid
  loop
    select * into v_product from public.catalog_products where id=v_product_id and account_id=v_account.id;
    if v_product.stock_tracking and (v_needed_by_product->>(v_product_id::text))::integer>v_product.stock_quantity then
      raise exception 'insufficient_stock:%',v_product.name using errcode='P0001';
    end if;
  end loop;

  if v_subtotal<v_account.minimum_order then raise exception 'minimum_order'; end if;

  insert into public.catalog_order_counters(account_id,next_value) values(v_account.id,1001)
  on conflict(account_id) do update set next_value=public.catalog_order_counters.next_value+1
  returning next_value into v_counter;

  v_number := 'PED-'||to_char(now() at time zone 'America/Guayaquil','YYMMDD')||'-'||lpad(v_counter::text,5,'0');

  begin
    insert into public.catalog_orders(
      id,account_id,idempotency_key,order_number,customer_business,customer_name,
      customer_phone,delivery_method,delivery_address,notes,subtotal,total,
      inventory_committed,payment_method
    ) values(
      v_order_id,v_account.id,p_idempotency_key,v_number,v_business,v_name,
      v_phone,v_delivery,v_address,v_notes,v_subtotal,v_subtotal,true,v_payment_method
    );
  exception when unique_violation then
    select * into v_existing from public.catalog_orders
    where account_id=v_account.id and idempotency_key=p_idempotency_key;
    if found then
      return jsonb_build_object('id',v_existing.id,'public_token',v_existing.public_token,'order_number',v_existing.order_number,'total',v_existing.total,'whatsapp',v_account.whatsapp,'duplicate',true);
    end if;
    raise;
  end;

  for v_item in select value from jsonb_array_elements(v_resolved_items)
  loop
    insert into public.catalog_order_items(
      order_id,product_id,product_name,sku,unit,unit_price,quantity,line_total,item_note,
      presentation_id,presentation_name,units_per_presentation,base_units
    ) values(
      v_order_id,(v_item->>'product_id')::uuid,v_item->>'product_name',nullif(v_item->>'sku',''),nullif(v_item->>'unit',''),
      (v_item->>'unit_price')::numeric,(v_item->>'quantity')::integer,(v_item->>'line_total')::numeric,
      nullif(v_item->>'item_note',''),
      case when nullif(v_item->>'presentation_id','') is null then null else (v_item->>'presentation_id')::uuid end,
      nullif(v_item->>'presentation_name',''),(v_item->>'units_per_presentation')::integer,(v_item->>'base_units')::integer
    );
  end loop;

  for v_product_id in select jsonb_object_keys(v_needed_by_product)::uuid
  loop
    update public.catalog_products
    set stock_quantity=stock_quantity-(v_needed_by_product->>(v_product_id::text))::integer,
        updated_at=now()
    where id=v_product_id and account_id=v_account.id and stock_tracking=true;
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

  return jsonb_build_object(
    'id',v_order_id,'public_token',(select public_token from public.catalog_orders where id=v_order_id),
    'order_number',v_number,'total',v_subtotal,'whatsapp',v_account.whatsapp,
    'payment_method',v_payment_method,'duplicate',false
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_order_inventory_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item record;
  v_product public.catalog_products%rowtype;
  v_old_committed boolean := coalesce(old.inventory_committed, false);
  v_new_committed boolean := new.status <> 'cancelled';
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  if not public.catalog_valid_order_transition(old.status, new.status) then
    raise exception 'invalid_status_transition:%->%', old.status, new.status using errcode = 'P0001';
  end if;

  if v_old_committed and not v_new_committed then
    -- Cancelling: restore exactly the base units this order had reserved.
    for v_item in
      select product_id, sum(base_units)::bigint as base_units
      from public.catalog_order_items
      where order_id = new.id and product_id is not null
      group by product_id
    loop
      update public.catalog_products
      set stock_quantity = stock_quantity + v_item.base_units,
          updated_at = now()
      where id = v_item.product_id
        and account_id = new.account_id
        and stock_tracking = true;
    end loop;
    new.inventory_committed := false;

  elsif not v_old_committed and v_new_committed then
    -- Re-opening a cancelled order: re-validate and re-reserve atomically,
    -- locking product rows first so this can't oversell against fresh orders
    -- created while this one was cancelled.
    for v_item in
      select product_id, sum(base_units)::bigint as base_units
      from public.catalog_order_items
      where order_id = new.id and product_id is not null
      group by product_id
      order by product_id
    loop
      select * into v_product
      from public.catalog_products
      where id = v_item.product_id and account_id = new.account_id
      for update;

      if found and v_product.stock_tracking then
        if v_product.stock_quantity < v_item.base_units then
          raise exception 'insufficient_stock:%', v_product.name using errcode = 'P0001';
        end if;
        update public.catalog_products
        set stock_quantity = stock_quantity - v_item.base_units,
            updated_at = now()
        where id = v_product.id;
      end if;
    end loop;
    new.inventory_committed := true;
  else
    new.inventory_committed := v_old_committed;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_recalculate_customer_stats(p_account_id uuid, p_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_count integer;
  v_total numeric(12,2);
  v_first timestamptz;
  v_last timestamptz;
begin
  select
    count(*)::integer,
    coalesce(sum(o.total), 0)::numeric(12,2),
    min(o.created_at),
    max(o.created_at)
  into v_count, v_total, v_first, v_last
  from public.catalog_orders o
  where o.account_id = p_account_id
    and o.customer_phone = p_phone
    and o.status <> 'cancelled';

  update public.catalog_customers c
  set order_count = coalesce(v_count, 0),
      total_spent = coalesce(v_total, 0),
      first_order_at = v_first,
      last_order_at = v_last,
      updated_at = now()
  where c.account_id = p_account_id
    and c.phone = p_phone;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_replace_presentations(p_account_id uuid, p_product_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row jsonb;
  v_requested_id uuid;
  v_written_id uuid;
  v_seen uuid[] := array[]::uuid[];
  v_first_id uuid;
  v_default_id uuid;
  v_index integer := 0;
  v_name text;
  v_unit_label text;
  v_units integer;
  v_price numeric(12,2);
  v_compare numeric(12,2);
  v_cost_total numeric(12,2);
  v_visible boolean;
  v_promo_active boolean;
  v_promo_price numeric(12,2);
  v_promo_label text;
begin
  perform 1 from public.catalog_products
  where id = p_product_id and account_id = p_account_id and archived_at is null
  for update;
  if not found then raise exception 'product_not_found'; end if;

  if jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1
     or jsonb_array_length(p_rows) > 40 then
    raise exception 'invalid_presentations';
  end if;

  update public.catalog_product_presentations
  set is_default = false
  where product_id = p_product_id and account_id = p_account_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    v_requested_id := null;
    if nullif(v_row->>'id','') is not null then
      begin
        v_requested_id := (v_row->>'id')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid_presentations';
      end;
    end if;

    v_name := trim(coalesce(v_row->>'name',''));
    v_unit_label := left(trim(coalesce(v_row->>'unit_label','unidad')),40);
    v_units := (v_row->>'units_per_presentation')::integer;
    v_price := (v_row->>'price')::numeric;
    v_compare := case when nullif(v_row->>'compare_at_price','') is null then null else (v_row->>'compare_at_price')::numeric end;
    v_cost_total := case when nullif(v_row->>'cost_total','') is null then null else (v_row->>'cost_total')::numeric end;
    v_visible := case when jsonb_typeof(v_row->'visible')='boolean' then (v_row->>'visible')::boolean else true end;
    v_promo_active := case when jsonb_typeof(v_row->'promo_active')='boolean' then (v_row->>'promo_active')::boolean else false end;
    v_promo_price := case when nullif(v_row->>'promo_price','') is null then null else (v_row->>'promo_price')::numeric end;
    v_promo_label := nullif(left(trim(coalesce(v_row->>'promo_label','Oferta')),40),'');

    if char_length(v_name)<1 or char_length(v_name)>80
       or v_units is null or v_units<1 or v_units>100000
       or v_price is null or v_price<0
       or (v_compare is not null and v_compare<0)
       or (v_cost_total is not null and v_cost_total<0)
       or (v_promo_price is not null and v_promo_price<0)
       or (v_promo_active and (v_promo_price is null or v_promo_price>=v_price)) then
      raise exception 'invalid_presentations';
    end if;

    if v_requested_id is not null and exists (
      select 1 from public.catalog_product_presentations
      where id=v_requested_id and product_id=p_product_id and account_id=p_account_id
    ) then
      update public.catalog_product_presentations
      set name=v_name,
          unit_label=coalesce(nullif(v_unit_label,''),'unidad'),
          units_per_presentation=v_units,
          price=v_price,
          compare_at_price=v_compare,
          cost_total=v_cost_total,
          sku=nullif(left(trim(coalesce(v_row->>'sku','')),60),''),
          visible=v_visible,
          promo_active=v_promo_active,
          promo_price=v_promo_price,
          promo_label=v_promo_label,
          is_default=false,
          sort_order=v_index-1,
          updated_at=now()
      where id=v_requested_id
      returning id into v_written_id;
    else
      insert into public.catalog_product_presentations(
        account_id,product_id,name,unit_label,units_per_presentation,price,
        compare_at_price,cost_total,sku,visible,promo_active,promo_price,promo_label,
        is_default,sort_order,image_path,image_url
      ) values(
        p_account_id,p_product_id,v_name,coalesce(nullif(v_unit_label,''),'unidad'),v_units,v_price,
        v_compare,v_cost_total,nullif(left(trim(coalesce(v_row->>'sku','')),60),''),v_visible,
        v_promo_active,v_promo_price,v_promo_label,false,v_index-1,
        nullif(left(trim(coalesce(v_row->>'image_path','')),500),''),
        nullif(left(trim(coalesce(v_row->>'image_url','')),1000),'')
      )
      returning id into v_written_id;
    end if;

    v_seen := array_append(v_seen,v_written_id);
    if v_first_id is null then v_first_id := v_written_id; end if;
    if v_default_id is null
       and jsonb_typeof(v_row->'is_default')='boolean'
       and (v_row->>'is_default')::boolean then
      v_default_id := v_written_id;
    end if;
  end loop;

  delete from public.catalog_product_presentations
  where product_id=p_product_id and account_id=p_account_id
    and not (id=any(v_seen));

  if not exists (
    select 1 from public.catalog_product_presentations
    where product_id=p_product_id and account_id=p_account_id and visible=true
  ) then
    raise exception 'invalid_presentations';
  end if;

  update public.catalog_product_presentations
  set is_default=true
  where id=coalesce(v_default_id,v_first_id)
    and product_id=p_product_id and account_id=p_account_id;

  return (
    select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order,p.name),'[]'::jsonb)
    from public.catalog_product_presentations p
    where p.product_id=p_product_id and p.account_id=p_account_id
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid_presentations';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_restore_inventory_on_order_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_item record;
begin
  if coalesce(old.inventory_committed,false) then
    for v_item in
      select oi.product_id,
             sum(oi.base_units)::bigint as base_units
      from public.catalog_order_items oi
      where oi.order_id=old.id
        and oi.product_id is not null
      group by oi.product_id
    loop
      update public.catalog_products p
      set stock_quantity=p.stock_quantity+greatest(0,coalesce(v_item.base_units,0)),
          status=case
            when not p.stock_tracking then p.status
            when p.stock_quantity+greatest(0,coalesce(v_item.base_units,0))<=0 then 'out'
            when p.stock_quantity+greatest(0,coalesce(v_item.base_units,0))<=coalesce(p.low_stock_threshold,0) then 'low'
            else 'available'
          end,
          updated_at=now()
      where p.id=v_item.product_id
        and p.account_id=old.account_id
        and p.stock_tracking=true;
    end loop;
  end if;
  return old;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_set_pin(p_account_id uuid, p_pin text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin_must_be_4_digits'; end if;
  update public.catalog_accounts set provider_pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),session_version=session_version+1 where id=p_account_id;
  if not found then raise exception 'account_not_found'; end if;
  update public.catalog_provider_sessions set revoked_at=now() where account_id=p_account_id and revoked_at is null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_sync_customer_stats_on_order_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    perform public.catalog_recalculate_customer_stats(old.account_id, old.customer_phone);
    return old;
  end if;

  if old.account_id is distinct from new.account_id
     or old.customer_phone is distinct from new.customer_phone then
    perform public.catalog_recalculate_customer_stats(old.account_id, old.customer_phone);
  end if;

  perform public.catalog_recalculate_customer_stats(new.account_id, new.customer_phone);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_sync_stock_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.stock_tracking then
    if new.stock_quantity <= 0 then
      new.status := 'out';
    elsif new.stock_quantity <= new.low_stock_threshold then
      new.status := 'low';
    else
      new.status := 'available';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_update_presentation_settings(p_account_id uuid, p_product_id uuid, p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row jsonb;
  v_id uuid;
  v_price numeric(12,2);
  v_visible boolean;
  v_promo_active boolean;
  v_promo_price numeric(12,2);
  v_promo_label text;
begin
  perform 1 from public.catalog_products
  where id=p_product_id and account_id=p_account_id and archived_at is null
  for update;
  if not found then raise exception 'product_not_found'; end if;
  if jsonb_typeof(p_settings)<>'array' or jsonb_array_length(p_settings)>40 then
    raise exception 'invalid_presentations';
  end if;

  for v_row in select value from jsonb_array_elements(p_settings)
  loop
    begin
      v_id := (v_row->>'id')::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid_presentations';
    end;

    select price into v_price
    from public.catalog_product_presentations
    where id=v_id and product_id=p_product_id and account_id=p_account_id
    for update;
    if not found then raise exception 'invalid_presentations'; end if;

    v_visible := case when jsonb_typeof(v_row->'visible')='boolean' then (v_row->>'visible')::boolean else true end;
    v_promo_active := case when jsonb_typeof(v_row->'promo_active')='boolean' then (v_row->>'promo_active')::boolean else false end;
    v_promo_price := case when nullif(v_row->>'promo_price','') is null then null else (v_row->>'promo_price')::numeric end;
    v_promo_label := nullif(left(trim(coalesce(v_row->>'promo_label','Oferta')),40),'');

    if v_promo_price is not null and v_promo_price<0 then raise exception 'invalid_presentations'; end if;
    if v_promo_active and (v_promo_price is null or v_promo_price>=v_price) then raise exception 'invalid_presentations'; end if;

    update public.catalog_product_presentations
    set visible=v_visible,promo_active=v_promo_active,promo_price=v_promo_price,promo_label=v_promo_label,updated_at=now()
    where id=v_id;
  end loop;

  if not exists (
    select 1 from public.catalog_product_presentations
    where product_id=p_product_id and account_id=p_account_id and visible=true
  ) then raise exception 'invalid_presentations'; end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order,p.name),'[]'::jsonb)
    from public.catalog_product_presentations p
    where p.product_id=p_product_id and p.account_id=p_account_id
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'invalid_presentations';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.catalog_valid_order_transition(p_from text, p_to text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_from = p_to then true
    when p_from = 'new' and p_to in ('confirmed','cancelled') then true
    when p_from = 'confirmed' and p_to in ('preparing','cancelled') then true
    when p_from = 'preparing' and p_to in ('dispatched','cancelled') then true
    when p_from = 'dispatched' and p_to in ('delivered','cancelled') then true
    when p_from = 'cancelled' and p_to = 'new' then true
    else false
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.preserve_catalog_presentation_image()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if (old.image_url is not null or old.image_path is not null)
     and new.image_url is null and new.image_path is null then
    new.image_url := old.image_url;
    new.image_path := old.image_path;
  end if;
  return new;
end;
$function$
;

CREATE TRIGGER catalog_accounts_touch BEFORE UPDATE ON public.catalog_accounts FOR EACH ROW EXECUTE FUNCTION catalog_touch_updated_at();

CREATE TRIGGER catalog_categories_touch BEFORE UPDATE ON public.catalog_categories FOR EACH ROW EXECUTE FUNCTION catalog_touch_updated_at();

CREATE TRIGGER catalog_products_sync_stock_status BEFORE INSERT OR UPDATE ON public.catalog_products FOR EACH ROW EXECUTE FUNCTION catalog_sync_stock_status();

CREATE TRIGGER catalog_products_touch BEFORE UPDATE ON public.catalog_products FOR EACH ROW EXECUTE FUNCTION catalog_touch_updated_at();

CREATE TRIGGER catalog_customers_touch BEFORE UPDATE ON public.catalog_customers FOR EACH ROW EXECUTE FUNCTION catalog_touch_updated_at();

CREATE TRIGGER catalog_product_presentations_preserve_image BEFORE UPDATE ON public.catalog_product_presentations FOR EACH ROW EXECUTE FUNCTION preserve_catalog_presentation_image();

CREATE TRIGGER catalog_product_presentations_touch_updated_at BEFORE UPDATE ON public.catalog_product_presentations FOR EACH ROW EXECUTE FUNCTION catalog_touch_updated_at();

CREATE TRIGGER trg_preserve_catalog_presentation_image BEFORE UPDATE ON public.catalog_product_presentations FOR EACH ROW EXECUTE FUNCTION preserve_catalog_presentation_image();

CREATE TRIGGER catalog_orders_customer_stats_sync AFTER DELETE OR UPDATE OF status, total, customer_phone ON public.catalog_orders FOR EACH ROW EXECUTE FUNCTION catalog_sync_customer_stats_on_order_change();

CREATE TRIGGER catalog_orders_inventory_guard BEFORE UPDATE OF status ON public.catalog_orders FOR EACH ROW EXECUTE FUNCTION catalog_order_inventory_guard();

CREATE TRIGGER catalog_orders_inventory_restore_delete BEFORE DELETE ON public.catalog_orders FOR EACH ROW EXECUTE FUNCTION catalog_restore_inventory_on_order_delete();

CREATE TRIGGER catalog_orders_touch BEFORE UPDATE ON public.catalog_orders FOR EACH ROW EXECUTE FUNCTION catalog_touch_updated_at();

alter table public."catalog_accounts" enable row level security;

revoke all on public."catalog_accounts" from public,anon,authenticated;

grant all on public."catalog_accounts" to service_role;

alter table public."catalog_activity_log" enable row level security;

revoke all on public."catalog_activity_log" from public,anon,authenticated;

grant all on public."catalog_activity_log" to service_role;

alter table public."catalog_categories" enable row level security;

revoke all on public."catalog_categories" from public,anon,authenticated;

grant all on public."catalog_categories" to service_role;

alter table public."catalog_customers" enable row level security;

revoke all on public."catalog_customers" from public,anon,authenticated;

grant all on public."catalog_customers" to service_role;

alter table public."catalog_order_counters" enable row level security;

revoke all on public."catalog_order_counters" from public,anon,authenticated;

grant all on public."catalog_order_counters" to service_role;

alter table public."catalog_order_items" enable row level security;

revoke all on public."catalog_order_items" from public,anon,authenticated;

grant all on public."catalog_order_items" to service_role;

alter table public."catalog_order_rate_limits" enable row level security;

revoke all on public."catalog_order_rate_limits" from public,anon,authenticated;

grant all on public."catalog_order_rate_limits" to service_role;

alter table public."catalog_orders" enable row level security;

revoke all on public."catalog_orders" from public,anon,authenticated;

grant all on public."catalog_orders" to service_role;

alter table public."catalog_pin_attempts" enable row level security;

revoke all on public."catalog_pin_attempts" from public,anon,authenticated;

grant all on public."catalog_pin_attempts" to service_role;

alter table public."catalog_product_presentations" enable row level security;

revoke all on public."catalog_product_presentations" from public,anon,authenticated;

grant all on public."catalog_product_presentations" to service_role;

alter table public."catalog_products" enable row level security;

revoke all on public."catalog_products" from public,anon,authenticated;

grant all on public."catalog_products" to service_role;

alter table public."catalog_provider_sessions" enable row level security;

revoke all on public."catalog_provider_sessions" from public,anon,authenticated;

grant all on public."catalog_provider_sessions" to service_role;

alter table public."catalog_push_config" enable row level security;

revoke all on public."catalog_push_config" from public,anon,authenticated;

grant all on public."catalog_push_config" to service_role;

alter table public."catalog_push_events" enable row level security;

revoke all on public."catalog_push_events" from public,anon,authenticated;

grant all on public."catalog_push_events" to service_role;

alter table public."catalog_push_subscriptions" enable row level security;

revoke all on public."catalog_push_subscriptions" from public,anon,authenticated;

grant all on public."catalog_push_subscriptions" to service_role;

grant usage, select on all sequences in schema public to service_role;

revoke all on function public."catalog_check_order_rate"(p_slug text, p_rate_key text) from public,anon,authenticated;

grant execute on function public."catalog_check_order_rate"(p_slug text, p_rate_key text) to service_role;

revoke all on function public."catalog_check_pin"(p_slug text, p_pin text, p_attempt_key text) from public,anon,authenticated;

grant execute on function public."catalog_check_pin"(p_slug text, p_pin text, p_attempt_key text) to service_role;

revoke all on function public."catalog_create_order"(p_slug text, p_idempotency_key uuid, p_customer jsonb, p_items jsonb) from public,anon,authenticated;

grant execute on function public."catalog_create_order"(p_slug text, p_idempotency_key uuid, p_customer jsonb, p_items jsonb) to service_role;

revoke all on function public."catalog_order_inventory_guard"() from public,anon,authenticated;

grant execute on function public."catalog_order_inventory_guard"() to service_role;

revoke all on function public."catalog_recalculate_customer_stats"(p_account_id uuid, p_phone text) from public,anon,authenticated;

grant execute on function public."catalog_recalculate_customer_stats"(p_account_id uuid, p_phone text) to service_role;

revoke all on function public."catalog_replace_presentations"(p_account_id uuid, p_product_id uuid, p_rows jsonb) from public,anon,authenticated;

grant execute on function public."catalog_replace_presentations"(p_account_id uuid, p_product_id uuid, p_rows jsonb) to service_role;

revoke all on function public."catalog_restore_inventory_on_order_delete"() from public,anon,authenticated;

grant execute on function public."catalog_restore_inventory_on_order_delete"() to service_role;

revoke all on function public."catalog_set_pin"(p_account_id uuid, p_pin text) from public,anon,authenticated;

grant execute on function public."catalog_set_pin"(p_account_id uuid, p_pin text) to service_role;

revoke all on function public."catalog_sync_customer_stats_on_order_change"() from public,anon,authenticated;

grant execute on function public."catalog_sync_customer_stats_on_order_change"() to service_role;

revoke all on function public."catalog_sync_stock_status"() from public,anon,authenticated;

grant execute on function public."catalog_sync_stock_status"() to service_role;

revoke all on function public."catalog_touch_updated_at"() from public,anon,authenticated;

grant execute on function public."catalog_touch_updated_at"() to service_role;

revoke all on function public."catalog_update_presentation_settings"(p_account_id uuid, p_product_id uuid, p_settings jsonb) from public,anon,authenticated;

grant execute on function public."catalog_update_presentation_settings"(p_account_id uuid, p_product_id uuid, p_settings jsonb) to service_role;

revoke all on function public."catalog_valid_order_transition"(p_from text, p_to text) from public,anon,authenticated;

grant execute on function public."catalog_valid_order_transition"(p_from text, p_to text) to service_role;

revoke all on function public."preserve_catalog_presentation_image"() from public,anon,authenticated;

grant execute on function public."preserve_catalog_presentation_image"() to service_role;
