-- Hakuna: optional precise delivery location selected by the customer.
-- Forward-only follow-up. Does not change inventory reservation semantics.

alter table public.catalog_orders
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision,
  add column if not exists delivery_location_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='catalog_orders_delivery_lat_range'
      and conrelid='public.catalog_orders'::regclass
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_delivery_lat_range
      check (delivery_lat is null or delivery_lat between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='catalog_orders_delivery_lng_range'
      and conrelid='public.catalog_orders'::regclass
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_delivery_lng_range
      check (delivery_lng is null or delivery_lng between -180 and 180);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='catalog_orders_delivery_location_pair'
      and conrelid='public.catalog_orders'::regclass
  ) then
    alter table public.catalog_orders
      add constraint catalog_orders_delivery_location_pair
      check ((delivery_lat is null) = (delivery_lng is null));
  end if;
end
$$;
