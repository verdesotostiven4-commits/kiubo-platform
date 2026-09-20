-- Hakuna Matata catalog integrity hardening.
-- Forward-only follow-up to the shared-stock migration.

alter table public.catalog_products
  add column if not exists base_unit text not null default 'unidad',
  add column if not exists allow_item_note boolean not null default true,
  add column if not exists stock_initialized boolean not null default false;

update public.catalog_products
set stock_initialized = true
where stock_tracking = true
  and stock_initialized is distinct from true;

alter table public.catalog_accounts
  add column if not exists payment_methods text[] not null default array['cash','transfer']::text[],
  add column if not exists payment_details jsonb not null default '{}'::jsonb;

alter table public.catalog_product_presentations
  add column if not exists cost_total numeric(12,2),
  add column if not exists image_path text,
  add column if not exists image_url text,
  add column if not exists promo_active boolean not null default false,
  add column if not exists promo_price numeric(12,2),
  add column if not exists promo_label text;

alter table public.catalog_orders
  add column if not exists payment_method text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_product_presentations_promo_price_nonnegative'
      and conrelid = 'public.catalog_product_presentations'::regclass
  ) then
    alter table public.catalog_product_presentations
      add constraint catalog_product_presentations_promo_price_nonnegative
      check (promo_price is null or promo_price >= 0);
  end if;
end
$$;

create or replace function public.preserve_catalog_presentation_image()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if (old.image_url is not null or old.image_path is not null)
     and new.image_url is null and new.image_path is null then
    new.image_url := old.image_url;
    new.image_path := old.image_path;
  end if;
  return new;
end;
$function$;

drop trigger if exists catalog_product_presentations_preserve_image on public.catalog_product_presentations;
create trigger catalog_product_presentations_preserve_image
before update on public.catalog_product_presentations
for each row execute function public.preserve_catalog_presentation_image();

create or replace function public.catalog_replace_presentations(
  p_account_id uuid,
  p_product_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

create or replace function public.catalog_update_presentation_settings(
  p_account_id uuid,
  p_product_id uuid,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function public.catalog_replace_presentations(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.catalog_update_presentation_settings(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.catalog_replace_presentations(uuid,uuid,jsonb) to service_role;
grant execute on function public.catalog_update_presentation_settings(uuid,uuid,jsonb) to service_role;

create or replace function public.catalog_create_order(
  p_slug text,
  p_idempotency_key uuid,
  p_customer jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
      if not found then v_presentation := null; end if;
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
$function$;

revoke all on function public.catalog_create_order(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.catalog_create_order(text,uuid,jsonb,jsonb) to service_role;
