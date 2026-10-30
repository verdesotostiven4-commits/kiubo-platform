-- Run only AFTER both schema migrations, Edge Functions and frontend are compatible.
-- This transaction preserves availability and records every converted order.
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

