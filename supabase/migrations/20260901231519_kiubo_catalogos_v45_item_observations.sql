alter table public.catalog_order_items
  add column if not exists item_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'catalog_order_items_item_note_length'
      and conrelid = 'public.catalog_order_items'::regclass
  ) then
    alter table public.catalog_order_items
      add constraint catalog_order_items_item_note_length
      check (item_note is null or char_length(item_note) <= 180);
  end if;
end
$$;

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
    where id = (v_item->>'product_id')::uuid and account_id = v_account.id and archived_at is null and visible = true and status <> 'out';
    if not found then raise exception 'product_unavailable'; end if;
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
