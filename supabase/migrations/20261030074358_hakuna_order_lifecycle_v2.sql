-- Hakuna: physical stock leaves on delivery; pending orders reserve availability.
-- Private RPCs are called only after catalog-api validates the provider session.
alter table public.catalog_accounts add column if not exists inventory_policy text not null default 'created'
  check (inventory_policy in ('created','delivered'));
alter table public.catalog_orders
  add column if not exists inventory_policy text not null default 'created' check (inventory_policy in ('created','delivered')),
  add column if not exists revision bigint not null default 0,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by text,
  add column if not exists refund_due numeric(12,2) not null default 0 check (refund_due>=0);

create table if not exists public.catalog_order_stock_balances (
  account_id uuid not null references public.catalog_accounts(id),
  order_id uuid not null references public.catalog_orders(id) on delete cascade,
  product_id uuid not null references public.catalog_products(id),
  debited_units bigint not null default 0 check (debited_units>=0),
  primary key(order_id,product_id)
);
create index if not exists catalog_order_stock_balances_account_idx on public.catalog_order_stock_balances(account_id);
create table if not exists public.catalog_order_revisions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id),
  order_id uuid not null references public.catalog_orders(id) on delete cascade,
  revision bigint not null,
  operation_id uuid not null,
  kind text not null,
  reason text,
  actor jsonb not null default '{}'::jsonb,
  request jsonb not null default '{}'::jsonb,
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now(),
  unique(account_id,operation_id), unique(order_id,revision)
);
create index if not exists catalog_order_revisions_account_idx on public.catalog_order_revisions(account_id,created_at desc);
create index if not exists catalog_orders_pending_stock_idx on public.catalog_orders(account_id,id)
  where inventory_policy='delivered' and inventory_committed=false and status in ('new','confirmed','preparing','dispatched');

alter table public.catalog_order_stock_balances enable row level security;
alter table public.catalog_order_revisions enable row level security;
revoke all on public.catalog_order_stock_balances,public.catalog_order_revisions from public,anon,authenticated;
grant all on public.catalog_order_stock_balances,public.catalog_order_revisions to service_role;

create or replace function public.catalog_reserved_units(p_account_id uuid,p_product_id uuid,p_exclude_order uuid default null)
returns bigint language sql volatile security invoker set search_path='' as $$
  select coalesce(sum(i.base_units),0)::bigint
  from public.catalog_order_items i join public.catalog_orders o on o.id=i.order_id
  where o.account_id=p_account_id and i.product_id=p_product_id
    and (p_exclude_order is null or o.id<>p_exclude_order)
    and o.inventory_policy='delivered' and not o.inventory_committed
    and o.status in ('new','confirmed','preparing','dispatched');
$$;
create or replace function public.catalog_stock_availability(p_account_id uuid)
returns table(product_id uuid,physical_quantity bigint,reserved_quantity bigint,available_quantity bigint)
language sql stable security invoker set search_path='' as $$
  select p.id,p.stock_quantity::bigint,coalesce(r.units,0),greatest(0,p.stock_quantity-coalesce(r.units,0))
  from public.catalog_products p
  left join (
    select i.product_id,sum(i.base_units)::bigint units
    from public.catalog_order_items i join public.catalog_orders o on o.id=i.order_id
    where o.account_id=p_account_id and o.inventory_policy='delivered' and not o.inventory_committed
      and o.status in ('new','confirmed','preparing','dispatched') group by i.product_id
  ) r on r.product_id=p.id
  where p.account_id=p_account_id;
$$;
create or replace function public.catalog_order_snapshot(p_order_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('order',to_jsonb(o),'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id)
    from public.catalog_order_items i where i.order_id=o.id),'[]'::jsonb))
  from public.catalog_orders o where o.id=p_order_id;
$$;

create or replace function public.catalog_order_revision_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=old.revision+1; return new; end;
$$;
drop trigger if exists catalog_orders_revision_guard on public.catalog_orders;
create trigger catalog_orders_revision_guard before update on public.catalog_orders
for each row execute function public.catalog_order_revision_guard();

-- Order row is locked by caller. Product rows always lock in UUID order.
create or replace function public.catalog_apply_order_inventory(p_order_id uuid,p_mode text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.catalog_orders%rowtype; p public.catalog_products%rowtype;
  r record; needed bigint; debited bigint; target bigint; delta bigint; available bigint;
begin
  if p_mode not in ('validate','deliver','return','cancel') then raise exception 'invalid_inventory_mode'; end if;
  select * into strict o from public.catalog_orders where id=p_order_id;
  for r in
    select product_id from public.catalog_order_items where order_id=o.id and product_id is not null
    union select product_id from public.catalog_order_stock_balances where order_id=o.id
    order by product_id
  loop
    select * into p from public.catalog_products where id=r.product_id and account_id=o.account_id for update;
    if not found then raise exception 'inventory_product_missing'; end if;
    select coalesce(sum(base_units),0) into needed from public.catalog_order_items where order_id=o.id and product_id=p.id;
    select coalesce(max(debited_units),0) into debited from public.catalog_order_stock_balances where order_id=o.id and product_id=p.id;
    if p_mode='validate' then
      if p.stock_tracking and needed>p.stock_quantity-public.catalog_reserved_units(o.account_id,p.id,o.id) then
        raise exception 'insufficient_stock:%',p.name;
      end if;
      continue;
    end if;
    target:=case when p_mode='cancel' then 0 when p_mode='return' then least(debited,needed)
      when p.stock_tracking then needed else 0 end;
    delta:=target-debited;
    if delta>0 then
      available:=p.stock_quantity-public.catalog_reserved_units(o.account_id,p.id,o.id);
      if delta>available then raise exception 'insufficient_stock:%',p.name; end if;
    end if;
    if delta<>0 then
      update public.catalog_products set stock_quantity=stock_quantity-delta,updated_at=now()
      where id=p.id and account_id=o.account_id;
    end if;
    insert into public.catalog_order_stock_balances(account_id,order_id,product_id,debited_units)
    values(o.account_id,o.id,p.id,target)
    on conflict(order_id,product_id) do update set debited_units=excluded.debited_units;
  end loop;
end;
$$;

create or replace function public.catalog_valid_order_transition(p_from text,p_to text)
returns boolean language sql immutable set search_path='' as $$
  select p_from=p_to or case p_from
    when 'new' then p_to in ('confirmed','cancelled')
    when 'confirmed' then p_to in ('preparing','cancelled')
    when 'preparing' then p_to in ('dispatched','cancelled')
    when 'dispatched' then p_to in ('delivered','cancelled')
    when 'delivered' then p_to='cancelled'
    when 'cancelled' then p_to='new' else false end;
$$;

create or replace function public.catalog_order_inventory_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record; p public.catalog_products%rowtype;
begin
  if new.status is not distinct from old.status then return new; end if;
  -- Hakuna's delivery-based policy skips intermediate steps, including
  -- orders already in preparation when the policy is switched on. Other
  -- catalogs keep their original state machine.
  if not public.catalog_valid_order_transition(old.status,new.status)
    and not (new.inventory_policy='delivered' and old.status in ('confirmed','preparing') and new.status='delivered') then
    raise exception 'invalid_status_transition';
  end if;
  if new.inventory_policy='delivered' then
    if new.status='delivered' then
      perform public.catalog_apply_order_inventory(old.id,'deliver'); new.inventory_committed:=true;
    elsif new.status='cancelled' then
      perform public.catalog_apply_order_inventory(old.id,'cancel'); new.inventory_committed:=false;
    else
      perform public.catalog_apply_order_inventory(old.id,'validate'); new.inventory_committed:=false;
    end if;
    return new;
  end if;
  -- Other catalogs retain the original create-and-reserve policy.
  if old.status='delivered' then raise exception 'invalid_status_transition'; end if;
  if old.inventory_committed and new.status='cancelled' then
    for r in select product_id,sum(base_units)::bigint units from public.catalog_order_items
      where order_id=old.id and product_id is not null group by product_id order by product_id loop
      update public.catalog_products set stock_quantity=stock_quantity+r.units,updated_at=now()
      where id=r.product_id and account_id=new.account_id and stock_tracking;
    end loop;
    new.inventory_committed:=false;
  elsif not old.inventory_committed and new.status<>'cancelled' then
    for r in select product_id,sum(base_units)::bigint units from public.catalog_order_items
      where order_id=old.id and product_id is not null group by product_id order by product_id loop
      select * into p from public.catalog_products where id=r.product_id and account_id=new.account_id for update;
      if found and p.stock_tracking then
        if p.stock_quantity<r.units then raise exception 'insufficient_stock:%',p.name; end if;
        update public.catalog_products set stock_quantity=stock_quantity-r.units,updated_at=now() where id=p.id;
      end if;
    end loop;
    new.inventory_committed:=true;
  end if;
  return new;
end;
$$;

create or replace function public.catalog_restore_inventory_on_order_delete()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if old.inventory_policy='delivered' then
    perform public.catalog_apply_order_inventory(old.id,'cancel');
  elsif old.inventory_committed then
    for r in select product_id,sum(base_units)::bigint units from public.catalog_order_items
      where order_id=old.id and product_id is not null group by product_id order by product_id loop
      update public.catalog_products set stock_quantity=stock_quantity+r.units,updated_at=now()
      where id=r.product_id and account_id=old.account_id and stock_tracking;
    end loop;
  end if;
  return old;
end;
$$;

-- Durable notification outbox: written in the same transaction as the order.
create table if not exists public.catalog_notification_jobs (
  event_key text primary key,
  account_id uuid not null references public.catalog_accounts(id),
  order_id uuid not null references public.catalog_orders(id) on delete cascade,
  audience text not null check(audience in ('provider','customer')),
  kind text not null,
  revision bigint not null,
  status text not null default 'pending' check(status in ('pending','processing','sent')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists catalog_notification_jobs_pending_idx on public.catalog_notification_jobs(available_at)
  where status<>'sent';
alter table public.catalog_notification_jobs enable row level security;
revoke all on public.catalog_notification_jobs from public,anon,authenticated;
grant all on public.catalog_notification_jobs to service_role;

create or replace function public.catalog_queue_order_notification(p_order_id uuid,p_kind text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.catalog_orders%rowtype;
begin
  select * into strict o from public.catalog_orders where id=p_order_id;
  insert into public.catalog_notification_jobs(event_key,account_id,order_id,audience,kind,revision)
  select o.id::text||':'||o.revision::text||':'||p_kind||':'||audience,o.account_id,o.id,audience,p_kind,o.revision
  from unnest(case when p_kind='created' then array['provider','customer'] else array['customer'] end) audience
  on conflict(event_key) do nothing;
end;
$$;
create or replace function public.catalog_claim_notification_jobs(p_account_id uuid,p_limit integer default 12)
returns setof public.catalog_notification_jobs language sql security invoker set search_path='' as $$
  update public.catalog_notification_jobs j set status='processing',attempts=j.attempts+1,locked_until=now()+interval '2 minutes'
  where j.event_key in (
    select q.event_key from public.catalog_notification_jobs q
    where q.account_id=p_account_id and q.status<>'sent' and q.available_at<=now()
      and (q.status='pending' or q.locked_until<now())
    order by q.created_at,q.event_key for update skip locked limit least(25,greatest(1,p_limit))
  ) returning j.*;
$$;

create or replace function public.catalog_change_order_status(
  p_account_id uuid,p_order_id uuid,p_status text,p_expected_revision bigint,p_operation_id uuid,
  p_reason text default null,p_actor jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.catalog_orders%rowtype; previous jsonb; current_state jsonb;
  prior public.catalog_order_revisions%rowtype;
  request jsonb:=jsonb_build_object('status',p_status,'reason',nullif(trim(p_reason),''));
begin
  if p_operation_id is null then raise exception 'invalid_operation'; end if;
  select * into o from public.catalog_orders where id=p_order_id and account_id=p_account_id for update;
  if not found then raise exception 'order_not_found'; end if;
  select * into prior from public.catalog_order_revisions where account_id=p_account_id and operation_id=p_operation_id;
  if found then
    if prior.order_id<>o.id or prior.request<>request then raise exception 'operation_conflict'; end if;
    return to_jsonb(o)||jsonb_build_object('items',public.catalog_order_snapshot(o.id)->'items','duplicate',true);
  end if;
  if p_expected_revision is null or o.revision<>p_expected_revision then raise exception 'order_conflict'; end if;
  if o.status=p_status then return to_jsonb(o)||jsonb_build_object('items',public.catalog_order_snapshot(o.id)->'items','duplicate',true); end if;
  if o.status='cancelled' and p_status='new' and o.refund_due>0 then raise exception 'refund_pending'; end if;
  if p_status='cancelled' and char_length(trim(coalesce(p_reason,'')))<3 then raise exception 'cancellation_reason_required'; end if;
  previous:=public.catalog_order_snapshot(o.id);
  update public.catalog_orders set status=p_status,
    cancellation_reason=case when p_status='cancelled' then left(trim(p_reason),240) else cancellation_reason end,
    cancelled_by=case when p_status='cancelled' then coalesce(p_actor->>'type','provider') else cancelled_by end,
    refund_due=refund_due+case when p_status='cancelled' and payment_status in ('paid','verified') then total else 0 end,
    payment_status=case when p_status='cancelled' and payment_status not in ('paid','verified') then 'cancelled'
      when status='cancelled' and p_status='new' and payment_status in ('cancelled','paid','verified') then 'pending' else payment_status end
  where id=o.id returning * into o;
  current_state:=public.catalog_order_snapshot(o.id);
  insert into public.catalog_order_revisions(account_id,order_id,revision,operation_id,kind,reason,actor,request,before_state,after_state)
  values(o.account_id,o.id,o.revision,p_operation_id,'status',left(trim(p_reason),240),p_actor,request,previous,current_state);
  perform public.catalog_queue_order_notification(o.id,'status');
  return to_jsonb(o)||jsonb_build_object('items',current_state->'items');
end;
$$;

-- Records a refund already performed outside the application; never moves money.
create or replace function public.catalog_record_refund(
  p_account_id uuid,p_order_id uuid,p_amount numeric,p_expected_revision bigint,p_operation_id uuid,
  p_reason text,p_actor jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.catalog_orders%rowtype; prior public.catalog_order_revisions%rowtype;
  previous jsonb; current_state jsonb;
  request jsonb:=jsonb_build_object('amount',p_amount,'reason',trim(p_reason));
begin
  if p_operation_id is null then raise exception 'invalid_operation'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'invalid_refund_amount'; end if;
  if char_length(trim(coalesce(p_reason,'')))<3 or char_length(p_reason)>240 then raise exception 'refund_reason_required'; end if;
  select * into o from public.catalog_orders where id=p_order_id and account_id=p_account_id for update;
  if not found then raise exception 'order_not_found'; end if;
  select * into prior from public.catalog_order_revisions where account_id=p_account_id and operation_id=p_operation_id;
  if found then
    if prior.order_id<>o.id or prior.request<>request then raise exception 'operation_conflict'; end if;
    return to_jsonb(o)||jsonb_build_object('items',public.catalog_order_snapshot(o.id)->'items','duplicate',true);
  end if;
  if p_expected_revision is null or o.revision<>p_expected_revision then raise exception 'order_conflict'; end if;
  if p_amount>o.refund_due then raise exception 'invalid_refund_amount'; end if;
  previous:=public.catalog_order_snapshot(o.id);
  update public.catalog_orders set refund_due=round(refund_due-p_amount,2) where id=o.id returning * into o;
  current_state:=public.catalog_order_snapshot(o.id);
  insert into public.catalog_order_revisions(account_id,order_id,revision,operation_id,kind,reason,actor,request,before_state,after_state)
  values(o.account_id,o.id,o.revision,p_operation_id,'refund_recorded',trim(p_reason),p_actor,request,previous,current_state);
  return to_jsonb(o)||jsonb_build_object('items',current_state->'items');
end;
$$;

create or replace function public.catalog_amend_order(
  p_account_id uuid,p_order_id uuid,p_items jsonb,p_expected_revision bigint,p_operation_id uuid,
  p_kind text,p_reason text,p_actor jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.catalog_orders%rowtype; old_item public.catalog_order_items%rowtype;
  p public.catalog_products%rowtype; pres public.catalog_product_presentations%rowtype;
  item jsonb; resolved jsonb:='[]'::jsonb; previous jsonb; current_state jsonb;
  prior public.catalog_order_revisions%rowtype; item_id uuid; v_product_id uuid; v_presentation_id uuid;
  q integer; units integer; price numeric(12,2); v_total numeric(12,2):=0; seen uuid[]:='{}';
  request jsonb:=jsonb_build_object('items',p_items,'kind',p_kind,'reason',trim(p_reason));
begin
  if p_operation_id is null or p_kind not in ('edit','return') then raise exception 'invalid_operation'; end if;
  if char_length(trim(coalesce(p_reason,'')))<3 or char_length(p_reason)>240 then raise exception 'edit_reason_required'; end if;
  select * into o from public.catalog_orders where id=p_order_id and account_id=p_account_id for update;
  if not found then raise exception 'order_not_found'; end if;
  select * into prior from public.catalog_order_revisions where account_id=p_account_id and operation_id=p_operation_id;
  if found then
    if prior.order_id<>o.id or prior.request<>request then raise exception 'operation_conflict'; end if;
    return to_jsonb(o)||jsonb_build_object('items',public.catalog_order_snapshot(o.id)->'items','duplicate',true);
  end if;
  if o.revision<>p_expected_revision or p_expected_revision is null then raise exception 'order_conflict'; end if;
  if o.inventory_policy<>'delivered' then raise exception 'order_policy_not_ready'; end if;
  if (p_kind='edit' and o.status<>'new') or (p_kind='return' and o.status<>'delivered') then raise exception 'order_not_editable'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>80 then raise exception 'invalid_items'; end if;
  -- Lock old and newly requested products together, before presentation rows.
  perform 1 from public.catalog_products where account_id=o.account_id and id in (
    select i.product_id from public.catalog_order_items i where i.order_id=o.id
    union select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x where nullif(x->>'product_id','') is not null
  ) order by id for update;
  previous:=public.catalog_order_snapshot(o.id);
  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce(item->>'quantity','') !~ '^(0|[1-9][0-9]{0,2})$' then raise exception 'invalid_quantity'; end if;
    q:=(item->>'quantity')::integer;
    item_id:=nullif(item->>'id','')::uuid;
    if item_id is not null then
      if item_id=any(seen) then raise exception 'duplicate_order_item'; end if;
      seen:=array_append(seen,item_id);
      select * into old_item from public.catalog_order_items where id=item_id and order_id=o.id;
      if not found then raise exception 'invalid_order_item'; end if;
      if p_kind='return' and q>old_item.quantity then raise exception 'return_quantity_exceeded'; end if;
      if q=0 then continue; end if;
      resolved:=resolved||jsonb_build_array(to_jsonb(old_item)||jsonb_build_object(
        'quantity',q,'base_units',q*old_item.units_per_presentation,'line_total',q*old_item.unit_price));
      v_total:=v_total+q*old_item.unit_price;
      continue;
    end if;
    if q=0 then continue; end if;
    if p_kind='return' then raise exception 'return_cannot_add_items'; end if;
    v_product_id:=(item->>'product_id')::uuid;
    select * into p from public.catalog_products where id=v_product_id and account_id=o.account_id
      and archived_at is null and visible and status<>'out';
    if not found then raise exception 'product_unavailable'; end if;
    v_presentation_id:=nullif(item->>'presentation_id','')::uuid;
    if v_presentation_id is not null then
      select * into pres from public.catalog_product_presentations where id=v_presentation_id and product_id=p.id
        and account_id=o.account_id and visible for share;
      if not found then raise exception 'invalid_presentation'; end if;
    else
      select * into pres from public.catalog_product_presentations where product_id=p.id and account_id=o.account_id and visible
        order by is_default desc,sort_order,id limit 1 for share;
      if not found and exists(select 1 from public.catalog_product_presentations where product_id=p.id and account_id=o.account_id) then
        raise exception 'product_unavailable';
      end if;
    end if;
    units:=coalesce(pres.units_per_presentation,1); price:=coalesce(pres.price,p.price);
    if coalesce(pres.promo_active,false) and pres.promo_price>=0 and pres.promo_price<price then price:=pres.promo_price; end if;
    resolved:=resolved||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'product_id',p.id,'product_name',p.name,
      'sku',p.sku,'unit',p.unit,'unit_price',price,'quantity',q,'line_total',price*q,
      'presentation_id',pres.id,'presentation_name',coalesce(pres.name,p.unit),'units_per_presentation',units,'base_units',q*units,
      'item_note',case when p.allow_item_note then nullif(left(trim(item->>'item_note'),180),'') else null end));
    v_total:=v_total+q*price;
  end loop;
  if jsonb_array_length(resolved)=0 then raise exception 'cancel_order_instead'; end if;
  if p_kind='return' and
    (select sum((x->>'quantity')::integer) from jsonb_array_elements(resolved) x)>=
    (select sum(i.quantity) from public.catalog_order_items i where i.order_id=o.id)
  then raise exception 'return_has_no_changes'; end if;
  delete from public.catalog_order_items where order_id=o.id;
  for item in select value from jsonb_array_elements(resolved) loop
    insert into public.catalog_order_items(id,order_id,product_id,product_name,sku,unit,unit_price,quantity,line_total,item_note,
      presentation_id,presentation_name,units_per_presentation,base_units,created_at)
    values((item->>'id')::uuid,o.id,(item->>'product_id')::uuid,item->>'product_name',item->>'sku',item->>'unit',
      (item->>'unit_price')::numeric,(item->>'quantity')::integer,(item->>'line_total')::numeric,item->>'item_note',
      (item->>'presentation_id')::uuid,item->>'presentation_name',(item->>'units_per_presentation')::integer,
      (item->>'base_units')::integer,coalesce((item->>'created_at')::timestamptz,now()));
  end loop;
  perform public.catalog_apply_order_inventory(o.id,case when p_kind='return' then 'return' else 'validate' end);
  update public.catalog_orders set subtotal=v_total,total=v_total,
    refund_due=refund_due+case when p_kind='return' and payment_status in ('paid','verified') then o.total-v_total else 0 end
  where id=o.id returning * into o;
  current_state:=public.catalog_order_snapshot(o.id);
  insert into public.catalog_order_revisions(account_id,order_id,revision,operation_id,kind,reason,actor,request,before_state,after_state)
  values(o.account_id,o.id,o.revision,p_operation_id,p_kind,trim(p_reason),p_actor,request,previous,current_state);
  perform public.catalog_queue_order_notification(o.id,p_kind);
  return to_jsonb(o)||jsonb_build_object('items',current_state->'items');
end;
$$;

-- The existing canonical pricing and presentation validation is preserved.
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
  v_lat numeric := case when p_customer->>'delivery_method'='pickup' then null else nullif(p_customer->>'delivery_lat','')::numeric end;
  v_lng numeric := case when p_customer->>'delivery_method'='pickup' then null else nullif(p_customer->>'delivery_lng','')::numeric end;
begin
  select * into v_account from public.catalog_accounts where slug=p_slug for share;
  if not found then raise exception 'account_not_found'; end if;
  if not v_account.is_open then raise exception 'catalog_closed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_account.id::text||':'||p_idempotency_key::text,0));

  select * into v_existing from public.catalog_orders
  where account_id=v_account.id and idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('id',v_existing.id,'public_token',v_existing.public_token,'order_number',v_existing.order_number,'total',v_existing.total,'whatsapp',v_account.whatsapp,'duplicate',true);
  end if;

  if char_length(v_business)<2 or char_length(v_business)>80 then raise exception 'invalid_customer'; end if;
  if char_length(v_phone)<11 or char_length(v_phone)>15 then raise exception 'invalid_phone'; end if;
  if v_delivery not in ('delivery','pickup') then raise exception 'invalid_delivery'; end if;
  if (v_lat is null)<>(v_lng is null) or v_lat not between -90 and 90 or v_lng not between -180 and 180 or (v_lat=0 and v_lng=0) then raise exception 'invalid_location'; end if;
  if v_payment_method is not null and not (v_payment_method=any(v_account.payment_methods)) then raise exception 'payment_method_unavailable'; end if;
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
    if v_product.stock_tracking and (v_needed_by_product->>(v_product_id::text))::integer>v_product.stock_quantity-public.catalog_reserved_units(v_account.id,v_product_id) then
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
      inventory_committed,payment_method,inventory_policy,delivery_lat,delivery_lng,delivery_location_label
    ) values(
      v_order_id,v_account.id,p_idempotency_key,v_number,v_business,v_name,
      v_phone,v_delivery,v_address,v_notes,v_subtotal,v_subtotal,v_account.inventory_policy='created',v_payment_method,
      v_account.inventory_policy,v_lat,v_lng,case when v_lat is not null then left(p_customer->>'delivery_location_label',160) else null end
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

  if v_account.inventory_policy='created' then
  for v_product_id in select jsonb_object_keys(v_needed_by_product)::uuid
  loop
    update public.catalog_products
    set stock_quantity=stock_quantity-(v_needed_by_product->>(v_product_id::text))::integer,
        updated_at=now()
    where id=v_product_id and account_id=v_account.id and stock_tracking=true;
  end loop;

  end if;
  perform public.catalog_queue_order_notification(v_order_id,'created');

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


-- Convert only Hakuna. Keep availability unchanged while moving the two old
-- concepts (already subtracted reservations vs physical stock) into separate fields.
-- A later manual stock edit makes that legacy deduction ambiguous: stop rather
-- than invent a stock correction. This check runs again at deployment time.
do $$
declare a public.catalog_accounts%rowtype; o public.catalog_orders%rowtype;
  before_state jsonb; after_state jsonb;
begin
  select * into a from public.catalog_accounts where slug='hakuna-matata' for update;
  if not found or a.inventory_policy='delivered' then return; end if;
  perform 1 from public.catalog_orders where account_id=a.id order by id for update;
  if exists(
    select 1 from public.catalog_orders ord
    join public.catalog_order_items i on i.order_id=ord.id
    join public.catalog_activity_log l on l.account_id=ord.account_id and l.entity_id=i.product_id::text
    where ord.account_id=a.id and ord.inventory_committed
      and l.action='product.stock_updated' and l.created_at>ord.created_at
  ) then raise exception 'legacy_stock_review_required'; end if;
  if exists(select 1 from public.catalog_orders ord join public.catalog_order_items i on i.order_id=ord.id
    left join public.catalog_products p on p.id=i.product_id and p.account_id=ord.account_id
    where ord.account_id=a.id and ord.inventory_committed and p.id is null)
  then raise exception 'legacy_inventory_product_missing'; end if;
  perform 1 from public.catalog_products where account_id=a.id and id in (
    select i.product_id from public.catalog_order_items i join public.catalog_orders ord on ord.id=i.order_id
    where ord.account_id=a.id and ord.inventory_committed
  ) order by id for update;
  insert into public.catalog_order_stock_balances(account_id,order_id,product_id,debited_units)
  select a.id,ord.id,i.product_id,sum(i.base_units)::bigint
  from public.catalog_orders ord join public.catalog_order_items i on i.order_id=ord.id
  join public.catalog_products p on p.id=i.product_id and p.account_id=a.id and p.stock_tracking
  where ord.account_id=a.id and ord.inventory_committed group by ord.id,i.product_id
  on conflict(order_id,product_id) do nothing;
  for o in select * from public.catalog_orders where account_id=a.id order by id loop
    before_state:=public.catalog_order_snapshot(o.id);
    if o.inventory_committed and o.status in ('new','confirmed','preparing','dispatched') then
      update public.catalog_products p set stock_quantity=p.stock_quantity+b.debited_units,updated_at=now()
      from public.catalog_order_stock_balances b where b.order_id=o.id and b.account_id=a.id and p.id=b.product_id and p.account_id=a.id;
      update public.catalog_order_stock_balances set debited_units=0 where order_id=o.id;
    end if;
    update public.catalog_orders set inventory_policy='delivered',
      inventory_committed=case when status='delivered' then inventory_committed else false end
    where id=o.id returning * into o;
    after_state:=public.catalog_order_snapshot(o.id);
    insert into public.catalog_order_revisions(account_id,order_id,revision,operation_id,kind,reason,before_state,after_state)
    values(a.id,o.id,o.revision,gen_random_uuid(),'policy_conversion',
      'Stock físico al entregar; los pedidos pendientes conservan su reserva.',before_state,after_state);
  end loop;
  update public.catalog_accounts set inventory_policy='delivered',payment_methods=case when 'credit'=any(payment_methods)
    then payment_methods else array_append(payment_methods,'credit') end where id=a.id;
end;
$$;

revoke all on function public.catalog_reserved_units(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.catalog_stock_availability(uuid) from public,anon,authenticated;
-- Save a product, its presentations and stock as one transaction. The
-- operation record makes a lost response safe to retry.
create table if not exists public.catalog_product_save_operations (
  account_id uuid not null references public.catalog_accounts(id),
  operation_id uuid not null,
  request jsonb not null,
  product_id uuid references public.catalog_products(id),
  created_at timestamptz not null default now(),
  primary key(account_id,operation_id)
);
alter table public.catalog_product_save_operations enable row level security;
revoke all on public.catalog_product_save_operations from public,anon,authenticated;
grant all on public.catalog_product_save_operations to service_role;

create or replace function public.catalog_save_product_atomic(
  p_account_id uuid,p_operation_id uuid,p_product_id uuid,p_expected_stock integer,
  p_product jsonb,p_presentations jsonb,p_stock jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_request jsonb:=jsonb_build_object('product_id',p_product_id,'expected_stock',p_expected_stock,'product',p_product,'presentations',p_presentations,'stock',p_stock);
  v_operation public.catalog_product_save_operations%rowtype;
  v_previous public.catalog_products%rowtype;
  v_id uuid; v_rows jsonb; v_category uuid;
  v_tracking boolean; v_initialized boolean; v_quantity integer; v_threshold integer;
begin
  if p_account_id is null or p_operation_id is null or jsonb_typeof(p_product) is distinct from 'object'
    or jsonb_typeof(p_stock) is distinct from 'object' or jsonb_typeof(p_presentations) is distinct from 'array' then
    raise exception 'invalid_request';
  end if;
  if jsonb_typeof(p_stock->'stock_tracking') is distinct from 'boolean' or jsonb_typeof(p_stock->'stock_initialized') is distinct from 'boolean'
    or coalesce(p_stock->>'stock_quantity','') !~ '^(0|[1-9][0-9]{0,8})$'
    or coalesce(p_stock->>'low_stock_threshold','') !~ '^(0|[1-9][0-9]{0,8})$' then
    raise exception 'invalid_stock';
  end if;
  v_tracking:=(p_stock->>'stock_tracking')::boolean;
  v_initialized:=(p_stock->>'stock_initialized')::boolean;
  v_quantity:=(p_stock->>'stock_quantity')::integer;
  v_threshold:=(p_stock->>'low_stock_threshold')::integer;
  if v_quantity>100000000 or v_threshold>100000000 or (v_tracking and not v_initialized) then raise exception 'invalid_stock'; end if;
  if char_length(trim(coalesce(p_stock->>'base_unit','')))<1 or char_length(p_stock->>'base_unit')>40 then raise exception 'invalid_stock'; end if;
  if nullif(p_product->>'category_id','') is not null then
    v_category:=(p_product->>'category_id')::uuid;
    if not exists(select 1 from public.catalog_categories where id=v_category and account_id=p_account_id) then raise exception 'invalid_category'; end if;
  end if;

  insert into public.catalog_product_save_operations(account_id,operation_id,request)
    values(p_account_id,p_operation_id,v_request) on conflict(account_id,operation_id) do nothing;
  select * into strict v_operation from public.catalog_product_save_operations
    where account_id=p_account_id and operation_id=p_operation_id for update;
  if v_operation.request<>v_request then raise exception 'operation_conflict'; end if;
  if v_operation.product_id is not null then
    select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order,p.name),'[]'::jsonb) into v_rows
      from public.catalog_product_presentations p where p.account_id=p_account_id and p.product_id=v_operation.product_id;
    return jsonb_build_object('id',v_operation.product_id,'presentations',v_rows,'atomic',true,'duplicate',true);
  end if;
  if p_product_id is null then
    insert into public.catalog_products(account_id,category_id,sku,name,brand,description,unit,price,compare_at_price,
      status,visible,featured,image_path,image_url,sort_order,stock_tracking,stock_initialized,stock_quantity,low_stock_threshold,base_unit,allow_item_note)
    values(p_account_id,v_category,p_product->>'sku',p_product->>'name',p_product->>'brand',p_product->>'description',p_product->>'unit',
      (p_product->>'price')::numeric,nullif(p_product->>'compare_at_price','')::numeric,p_product->>'status',
      (p_product->>'visible')::boolean,(p_product->>'featured')::boolean,p_product->>'image_path',p_product->>'image_url',
      (p_product->>'sort_order')::integer,v_tracking,v_initialized,v_quantity,v_threshold,trim(p_stock->>'base_unit'),
      coalesce((p_stock->>'allow_item_note')::boolean,true)) returning id into v_id;
  else
    select * into v_previous from public.catalog_products where id=p_product_id and account_id=p_account_id and archived_at is null for update;
    if not found then raise exception 'product_not_found'; end if;
    if p_expected_stock is null or v_previous.stock_quantity<>p_expected_stock then raise exception 'stock_conflict'; end if;
    -- The product row is locked here; order writers lock the same row when
    -- creating reservations. A manager cannot quietly underfund pending orders.
    if v_tracking and v_quantity<public.catalog_reserved_units(p_account_id,p_product_id) then
      raise exception 'stock_below_reserved';
    end if;
    if v_previous.stock_tracking and not v_tracking
      and public.catalog_reserved_units(p_account_id,p_product_id)>0 then
      raise exception 'stock_tracking_required_for_pending_orders';
    end if;
    update public.catalog_products set category_id=v_category,sku=p_product->>'sku',name=p_product->>'name',brand=p_product->>'brand',
      description=p_product->>'description',unit=p_product->>'unit',price=(p_product->>'price')::numeric,
      compare_at_price=nullif(p_product->>'compare_at_price','')::numeric,status=p_product->>'status',
      visible=(p_product->>'visible')::boolean,featured=(p_product->>'featured')::boolean,
      image_path=case when p_product ? 'image_path' then p_product->>'image_path' else image_path end,
      image_url=case when p_product ? 'image_url' then p_product->>'image_url' else image_url end,
      sort_order=(p_product->>'sort_order')::integer,stock_tracking=v_tracking,stock_initialized=v_initialized,
      stock_quantity=v_quantity,low_stock_threshold=v_threshold,base_unit=trim(p_stock->>'base_unit'),
      allow_item_note=coalesce((p_stock->>'allow_item_note')::boolean,true),updated_at=now()
      where id=p_product_id and account_id=p_account_id returning id into v_id;
  end if;
  v_rows:=public.catalog_replace_presentations(p_account_id,v_id,p_presentations);
  update public.catalog_product_save_operations set product_id=v_id
    where account_id=p_account_id and operation_id=p_operation_id;
  return jsonb_build_object('id',v_id,'presentations',v_rows,'atomic',true,'duplicate',false);
end;
$$;
revoke all on function public.catalog_save_product_atomic(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.catalog_save_product_atomic(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb) to service_role;

revoke all on function public.catalog_order_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.catalog_apply_order_inventory(uuid,text) from public,anon,authenticated;
revoke all on function public.catalog_queue_order_notification(uuid,text) from public,anon,authenticated;
revoke all on function public.catalog_claim_notification_jobs(uuid,integer) from public,anon,authenticated;
revoke all on function public.catalog_change_order_status(uuid,uuid,text,bigint,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.catalog_record_refund(uuid,uuid,numeric,bigint,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.catalog_amend_order(uuid,uuid,jsonb,bigint,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.catalog_order_revision_guard() from public,anon,authenticated;
revoke all on function public.catalog_order_inventory_guard() from public,anon,authenticated;
revoke all on function public.catalog_restore_inventory_on_order_delete() from public,anon,authenticated;
grant execute on function public.catalog_reserved_units(uuid,uuid,uuid),public.catalog_stock_availability(uuid),
  public.catalog_order_snapshot(uuid),public.catalog_apply_order_inventory(uuid,text),public.catalog_queue_order_notification(uuid,text),
  public.catalog_claim_notification_jobs(uuid,integer),public.catalog_change_order_status(uuid,uuid,text,bigint,uuid,text,jsonb),public.catalog_record_refund(uuid,uuid,numeric,bigint,uuid,text,jsonb),
  public.catalog_amend_order(uuid,uuid,jsonb,bigint,uuid,text,text,jsonb) to service_role;
