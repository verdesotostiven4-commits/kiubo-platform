alter table public.catalog_products
  add column if not exists stock_tracking boolean not null default false,
  add column if not exists stock_quantity integer not null default 0,
  add column if not exists low_stock_threshold integer not null default 5;

alter table public.catalog_orders
  add column if not exists inventory_committed boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_products_stock_quantity_nonnegative'
      and conrelid = 'public.catalog_products'::regclass
  ) then
    alter table public.catalog_products
      add constraint catalog_products_stock_quantity_nonnegative check (stock_quantity >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_products_low_stock_threshold_nonnegative'
      and conrelid = 'public.catalog_products'::regclass
  ) then
    alter table public.catalog_products
      add constraint catalog_products_low_stock_threshold_nonnegative check (low_stock_threshold >= 0);
  end if;
end
$$;

create or replace function public.catalog_sync_stock_status()
returns trigger
language plpgsql
set search_path to ''
as $function$
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
$function$;

drop trigger if exists catalog_products_sync_stock_status on public.catalog_products;
create trigger catalog_products_sync_stock_status
before insert or update on public.catalog_products
for each row execute function public.catalog_sync_stock_status();

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
  v_new_committed boolean := new.status in ('confirmed','preparing','dispatched','delivered');
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  if not v_old_committed and v_new_committed then
    for v_item in
      select product_id, product_name, quantity
      from public.catalog_order_items
      where order_id = new.id
      order by created_at, id
    loop
      if v_item.product_id is null then continue; end if;

      select * into v_product
      from public.catalog_products
      where id = v_item.product_id and account_id = new.account_id
      for update;

      if found and v_product.stock_tracking then
        if v_product.stock_quantity < v_item.quantity then
          raise exception 'insufficient_stock:%', v_item.product_name using errcode = 'P0001';
        end if;

        update public.catalog_products
        set stock_quantity = stock_quantity - v_item.quantity,
            updated_at = now()
        where id = v_product.id;
      end if;
    end loop;
    new.inventory_committed := true;

  elsif v_old_committed and not v_new_committed then
    for v_item in
      select product_id, quantity
      from public.catalog_order_items
      where order_id = new.id
      order by created_at, id
    loop
      if v_item.product_id is null then continue; end if;

      update public.catalog_products
      set stock_quantity = stock_quantity + v_item.quantity,
          updated_at = now()
      where id = v_item.product_id
        and account_id = new.account_id
        and stock_tracking = true;
    end loop;
    new.inventory_committed := false;
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
  v_quantity integer;
  v_item_note text;
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

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 999 then raise exception 'invalid_quantity'; end if;

    select * into v_product
    from public.catalog_products
    where id = (v_item->>'product_id')::uuid
      and account_id = v_account.id
      and archived_at is null
      and visible = true
      and status <> 'out';

    if not found then raise exception 'product_unavailable'; end if;
    if v_product.stock_tracking and v_quantity > v_product.stock_quantity then
      raise exception 'insufficient_stock:%', v_product.name using errcode = 'P0001';
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if v_subtotal < v_account.minimum_order then raise exception 'minimum_order'; end if;

  insert into public.catalog_order_counters(account_id,next_value) values(v_account.id,1001)
  on conflict(account_id) do update set next_value = public.catalog_order_counters.next_value + 1 returning next_value into v_counter;

  v_number := 'PED-' || to_char(now() at time zone 'America/Guayaquil','YYMMDD') || '-' || lpad(v_counter::text,5,'0');

  insert into public.catalog_orders(id,account_id,idempotency_key,order_number,customer_business,customer_name,customer_phone,delivery_method,delivery_address,notes,subtotal,total)
  values(v_order_id,v_account.id,p_idempotency_key,v_number,v_business,v_name,v_phone,v_delivery,v_address,v_notes,v_subtotal,v_subtotal);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_item_note := nullif(left(trim(coalesce(v_item->>'item_note','')),180),'');
    select * into v_product from public.catalog_products where id = (v_item->>'product_id')::uuid and account_id = v_account.id;
    insert into public.catalog_order_items(order_id,product_id,product_name,sku,unit,unit_price,quantity,line_total,item_note)
    values(v_order_id,v_product.id,v_product.name,v_product.sku,v_product.unit,v_product.price,v_quantity,v_product.price*v_quantity,v_item_note);
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
