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
        and account_id = new.account_id;
    end loop;
    new.inventory_committed := false;
  else
    new.inventory_committed := v_old_committed;
  end if;

  return new;
end;
$function$;
