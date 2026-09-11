-- Hakuna Matata: deleting/resetting committed orders must restore inventory first.
-- Production behavior was verified transactionally on 2026-09-11.

create or replace function public.catalog_restore_inventory_on_order_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
begin
  if coalesce(old.inventory_committed,false) then
    for v_item in
      select oi.product_id,
             sum(coalesce(oi.base_units,oi.quantity,0))::bigint as base_units
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
$$;

drop trigger if exists catalog_orders_inventory_restore_delete on public.catalog_orders;
create trigger catalog_orders_inventory_restore_delete
before delete on public.catalog_orders
for each row
execute function public.catalog_restore_inventory_on_order_delete();

revoke all on function public.catalog_restore_inventory_on_order_delete() from public,anon,authenticated;
