-- Hakuna Matata / KIUBO Catalogos
-- Keep customer lifetime aggregates consistent when orders are cancelled or changed.
-- Applied to production on 2026-09-11 before being recorded here.

alter table public.catalog_customers
  alter column first_order_at drop not null,
  alter column last_order_at drop not null;

create or replace function public.catalog_recalculate_customer_stats(
  p_account_id uuid,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

create or replace function public.catalog_sync_customer_stats_on_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

drop trigger if exists catalog_orders_customer_stats_sync on public.catalog_orders;
create trigger catalog_orders_customer_stats_sync
after update of status, total, customer_phone or delete on public.catalog_orders
for each row execute function public.catalog_sync_customer_stats_on_order_change();

-- Backfill every catalog account so existing cancelled orders are not counted as spent.
with stats as (
  select
    c.id,
    count(o.id) filter (where o.status <> 'cancelled')::integer as order_count,
    coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::numeric(12,2) as total_spent,
    min(o.created_at) filter (where o.status <> 'cancelled') as first_order_at,
    max(o.created_at) filter (where o.status <> 'cancelled') as last_order_at
  from public.catalog_customers c
  left join public.catalog_orders o
    on o.account_id = c.account_id
   and o.customer_phone = c.phone
  group by c.id
)
update public.catalog_customers c
set order_count = s.order_count,
    total_spent = s.total_spent,
    first_order_at = s.first_order_at,
    last_order_at = s.last_order_at,
    updated_at = now()
from stats s
where s.id = c.id;

revoke all on function public.catalog_recalculate_customer_stats(uuid,text)
  from public, anon, authenticated;
revoke all on function public.catalog_sync_customer_stats_on_order_change()
  from public, anon, authenticated;
