-- Hakuna Matata: presentations (unit/box/case) share one physical stock pool,
-- and reservation must happen atomically at order-creation time so concurrent
-- customers cannot oversell. See conversation 2026-09-18 for the full rule set.

create table if not exists public.catalog_product_presentations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  unit_label text not null default 'unidad' check (char_length(unit_label) between 1 and 40),
  units_per_presentation integer not null default 1 check (units_per_presentation between 1 and 100000),
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  sku text,
  visible boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_product_presentations_product_idx
  on public.catalog_product_presentations (product_id);
create index if not exists catalog_product_presentations_account_idx
  on public.catalog_product_presentations (account_id);

-- Exactly one default presentation per product.
create unique index if not exists catalog_product_presentations_one_default
  on public.catalog_product_presentations (product_id)
  where is_default;

alter table public.catalog_product_presentations enable row level security;
revoke all on public.catalog_product_presentations from anon, authenticated;
grant all on public.catalog_product_presentations to service_role;

drop trigger if exists catalog_product_presentations_touch_updated_at on public.catalog_product_presentations;
create or replace function public.catalog_touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
create trigger catalog_product_presentations_touch_updated_at
before update on public.catalog_product_presentations
for each row execute function public.catalog_touch_updated_at();

-- Order items must record which presentation was purchased and, authoritatively,
-- how many BASE units it consumed (units_per_presentation * quantity), computed
-- server-side and never trusted from the client.
alter table public.catalog_order_items
  add column if not exists presentation_id uuid references public.catalog_product_presentations(id) on delete set null,
  add column if not exists presentation_name text,
  add column if not exists units_per_presentation integer not null default 1,
  add column if not exists base_units integer;

update public.catalog_order_items
  set base_units = quantity * coalesce(units_per_presentation, 1)
  where base_units is null;

alter table public.catalog_order_items
  alter column base_units set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_order_items_base_units_positive'
      and conrelid = 'public.catalog_order_items'::regclass
  ) then
    alter table public.catalog_order_items
      add constraint catalog_order_items_base_units_positive check (base_units >= 1);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_order_items_units_per_presentation_positive'
      and conrelid = 'public.catalog_order_items'::regclass
  ) then
    alter table public.catalog_order_items
      add constraint catalog_order_items_units_per_presentation_positive check (units_per_presentation >= 1);
  end if;
end
$$;

-- Rule: unlimited sale when a product does not track stock; when it does,
-- reservation happens atomically at order-creation time (not at confirmation),
-- locking every referenced product row (in a stable order, to avoid deadlocks
-- between concurrent carts touching the same products) before validating.
-- Presentation price/units are resolved from the DB only, never from the client.
create or replace function public.catalog_create_order(
  p_slug text,
  p_idempotency_key uuid,
  p_customer jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_needed_by_product jsonb := '{}'::jsonb;
  v_product_ids uuid[];
  v_business text := trim(coalesce(p_customer->>'customer_business',''));
  v_name text := nullif(trim(coalesce(p_customer->>'customer_name','')),'');
  v_phone text := regexp_replace(coalesce(p_customer->>'customer_phone',''),'[^0-9]','','g');
  v_delivery text := coalesce(p_customer->>'delivery_method','delivery');
  v_address text := nullif(left(trim(coalesce(p_customer->>'delivery_address','')),160),'');
  v_notes text := nullif(left(trim(coalesce(p_customer->>'notes','')),400),'');
begin
  select * into v_account from public.catalog_accounts where slug = p_slug for share;
  if not found then raise exception 'account_not_found'; end if;
  if not v_account.is_open then raise exception 'catalog_closed'; end if;

  select * into v_existing from public.catalog_orders where account_id = v_account.id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id',v_existing.id,'public_token',v_existing.public_token,'order_number',v_existing.order_number,'total',v_existing.total,'whatsapp',v_account.whatsapp,'duplicate',true);
  end if;

  if char_length(v_business) < 2 or char_length(v_business) > 80 then raise exception 'invalid_customer'; end if;
  if char_length(v_phone) < 11 or char_length(v_phone) > 15 then raise exception 'invalid_phone'; end if;
  if v_delivery not in ('delivery','pickup') then raise exception 'invalid_delivery'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 80 then raise exception 'invalid_items'; end if;

  -- Collect the distinct product ids referenced by this cart, sorted, and lock
  -- them all up front in a stable order. Locking every product row before doing
  -- any read-then-decide logic is what makes two concurrent checkouts for the
  -- same product serialize instead of both reading a stale stock_quantity.
  select array_agg(distinct (value->>'product_id')::uuid order by (value->>'product_id')::uuid)
  into v_product_ids
  from jsonb_array_elements(p_items) as value
  where value->>'product_id' is not null;

  if v_product_ids is null or array_length(v_product_ids,1) is null then
    raise exception 'invalid_items';
  end if;

  perform 1 from public.catalog_products
  where id = any(v_product_ids) and account_id = v_account.id
  order by id
  for update;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 999 then raise exception 'invalid_quantity'; end if;

    v_product_id := (v_item->>'product_id')::uuid;

    select * into v_product
    from public.catalog_products
    where id = v_product_id
      and account_id = v_account.id
      and archived_at is null
      and visible = true
      and status <> 'out';
    if not found then raise exception 'product_unavailable'; end if;

    -- Resolve the presentation strictly from the DB (never trust client-sent
    -- units_per_presentation/price). Fall back to the product's own base
    -- price/unit for legacy carts with no real presentation row yet.
    v_presentation_id := null;
    if v_item->>'presentation_id' is not null and left(v_item->>'presentation_id',7) <> 'legacy-' then
      begin
        v_presentation_id := (v_item->>'presentation_id')::uuid;
      exception when invalid_text_representation then
        v_presentation_id := null;
      end;
    end if;

    if v_presentation_id is not null then
      select * into v_presentation
      from public.catalog_product_presentations
      where id = v_presentation_id and product_id = v_product_id and account_id = v_account.id and visible = true;
      if not found then raise exception 'product_unavailable'; end if;
      v_units_per := v_presentation.units_per_presentation;
    else
      v_presentation := null;
      v_units_per := 1;
    end if;

    v_base_units := v_quantity * v_units_per;

    v_needed_by_product := jsonb_set(
      v_needed_by_product,
      array[v_product_id::text],
      to_jsonb(coalesce((v_needed_by_product->>(v_product_id::text))::integer,0) + v_base_units)
    );

    v_subtotal := v_subtotal + (coalesce(v_presentation.price, v_product.price) * v_quantity);
  end loop;

  -- All presentations of the same product share one physical stock pool:
  -- validate the aggregated base-unit demand per product, not per cart line.
  for v_product_id in select distinct (value->>'product_id')::uuid from jsonb_array_elements(p_items) as value
  loop
    select * into v_product from public.catalog_products where id = v_product_id and account_id = v_account.id;
    if v_product.stock_tracking and (v_needed_by_product->>(v_product_id::text))::integer > v_product.stock_quantity then
      raise exception 'insufficient_stock:%', v_product.name using errcode = 'P0001';
    end if;
  end loop;

  if v_subtotal < v_account.minimum_order then raise exception 'minimum_order'; end if;

  insert into public.catalog_order_counters(account_id,next_value) values(v_account.id,1001)
  on conflict(account_id) do update set next_value = public.catalog_order_counters.next_value + 1 returning next_value into v_counter;

  v_number := 'PED-' || to_char(now() at time zone 'America/Guayaquil','YYMMDD') || '-' || lpad(v_counter::text,5,'0');

  begin
    insert into public.catalog_orders(id,account_id,idempotency_key,order_number,customer_business,customer_name,customer_phone,delivery_method,delivery_address,notes,subtotal,total,inventory_committed)
    values(v_order_id,v_account.id,p_idempotency_key,v_number,v_business,v_name,v_phone,v_delivery,v_address,v_notes,v_subtotal,v_subtotal,true);
  exception when unique_violation then
    -- Two requests raced on the same idempotency key: whichever lost the
    -- insert just returns the winner's order instead of erroring out.
    select * into v_existing from public.catalog_orders where account_id = v_account.id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('id',v_existing.id,'public_token',v_existing.public_token,'order_number',v_existing.order_number,'total',v_existing.total,'whatsapp',v_account.whatsapp,'duplicate',true);
    end if;
    raise;
  end;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_item_note := nullif(left(trim(coalesce(v_item->>'item_note','')),180),'');
    v_product_id := (v_item->>'product_id')::uuid;

    v_presentation_id := null;
    if v_item->>'presentation_id' is not null and left(v_item->>'presentation_id',7) <> 'legacy-' then
      begin
        v_presentation_id := (v_item->>'presentation_id')::uuid;
      exception when invalid_text_representation then
        v_presentation_id := null;
      end;
    end if;

    select * into v_product from public.catalog_products where id = v_product_id and account_id = v_account.id;

    if v_presentation_id is not null then
      select * into v_presentation from public.catalog_product_presentations where id = v_presentation_id and product_id = v_product_id and account_id = v_account.id;
    else
      v_presentation := null;
    end if;

    v_units_per := coalesce(v_presentation.units_per_presentation, 1);

    insert into public.catalog_order_items(
      order_id,product_id,product_name,sku,unit,unit_price,quantity,line_total,item_note,
      presentation_id,presentation_name,units_per_presentation,base_units
    )
    values(
      v_order_id,v_product.id,v_product.name,v_product.sku,v_product.unit,
      coalesce(v_presentation.price, v_product.price),v_quantity,
      coalesce(v_presentation.price, v_product.price)*v_quantity,v_item_note,
      v_presentation.id,coalesce(v_presentation.name, v_product.unit),v_units_per,v_quantity*v_units_per
    );
  end loop;

  -- Reservation happens now: decrement the shared stock pool per product by
  -- the aggregated base units, atomically, inside this same transaction.
  for v_product_id in select jsonb_object_keys(v_needed_by_product)::uuid
  loop
    update public.catalog_products
    set stock_quantity = stock_quantity - (v_needed_by_product->>(v_product_id::text))::integer,
        updated_at = now()
    where id = v_product_id
      and account_id = v_account.id
      and stock_tracking = true;
  end loop;

  insert into public.catalog_customers(account_id,phone,business,name,last_address,order_count,total_spent)
  values(v_account.id,v_phone,v_business,v_name,v_address,1,v_subtotal)
  on conflict(account_id,phone) do update set
    business=excluded.business,
    name=coalesce(excluded.name,public.catalog_customers.name),
    last_address=coalesce(excluded.last_address,public.catalog_customers.last_address),
    order_count=public.catalog_customers.order_count+1,
    total_spent=public.catalog_customers.total_spent+excluded.total_spent,
    last_order_at=now(),
    updated_at=now();

  insert into public.catalog_activity_log(account_id,actor_type,action,entity_type,entity_id,metadata)
  values(v_account.id,'public','order.created','order',v_order_id::text,jsonb_build_object('order_number',v_number,'total',v_subtotal));

  return jsonb_build_object('id',v_order_id,'public_token',(select public_token from public.catalog_orders where id=v_order_id),'order_number',v_number,'total',v_subtotal,'whatsapp',v_account.whatsapp,'duplicate',false);
end;
$function$;

revoke all on function public.catalog_create_order(text,uuid,jsonb,jsonb) from public;
revoke all on function public.catalog_create_order(text,uuid,jsonb,jsonb) from anon;
revoke all on function public.catalog_create_order(text,uuid,jsonb,jsonb) from authenticated;

-- Order status is now a plain fulfillment label: stock was already reserved
-- (inventory_committed=true) the moment the order was created. confirmed ->
-- preparing -> dispatched -> delivered must never touch stock again — only a
-- transition into/out of 'cancelled' does, and it must restore/re-reserve
-- exactly the aggregated base units per product, atomically.
create or replace function public.catalog_valid_order_transition(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_from = p_to then true
    when p_from = 'new' and p_to in ('confirmed','cancelled') then true
    when p_from = 'confirmed' and p_to in ('preparing','cancelled') then true
    when p_from = 'preparing' and p_to in ('dispatched','cancelled') then true
    when p_from = 'dispatched' and p_to in ('delivered','cancelled') then true
    when p_from = 'cancelled' and p_to = 'new' then true
    else false
  end;
$function$;

create or replace function public.catalog_order_inventory_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
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
$function$;

drop trigger if exists catalog_orders_inventory_guard on public.catalog_orders;
create trigger catalog_orders_inventory_guard
before update of status on public.catalog_orders
for each row execute function public.catalog_order_inventory_guard();

-- Fix a pre-existing bug: this trigger referenced catalog_order_items.base_units
-- before that column existed (via coalesce(oi.base_units, oi.quantity, 0)),
-- which would fail as soon as it ran. base_units is now real and authoritative.
create or replace function public.catalog_restore_inventory_on_order_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function public.catalog_valid_order_transition(text,text) from public, anon, authenticated;
grant execute on function public.catalog_valid_order_transition(text,text) to service_role;
