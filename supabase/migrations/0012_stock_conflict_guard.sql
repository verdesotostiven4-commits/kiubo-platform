-- KIUBO Cloud v2 phase 4 · conflict floor guard.
-- Safe to apply even before/after 0011_finance_transaction_v2.sql.
-- It prevents a concurrent or stale sale from ever persisting negative stock.

create or replace function public.sync_nonnegative_number(p_payload jsonb,p_key text)
returns boolean
language plpgsql
immutable
set search_path=public
as $$
declare
  v numeric;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then return false; end if;
  v:=coalesce(nullif(p_payload->>p_key,'')::numeric,0);
  return v>=0;
exception when others then
  return false;
end
$$;

revoke all on function public.sync_nonnegative_number(jsonb,text) from public;
revoke all on function public.sync_nonnegative_number(jsonb,text) from anon;
revoke all on function public.sync_nonnegative_number(jsonb,text) from authenticated;

do $$
begin
  if not exists(
    select 1
    from pg_constraint
    where conname='sync_tenant_products_stock_nonnegative'
      and conrelid='public.sync_entities'::regclass
  ) then
    alter table public.sync_entities
      add constraint sync_tenant_products_stock_nonnegative
      check (
        entity_type<>'tenantProducts'
        or deleted
        or public.sync_nonnegative_number(payload,'stock')
      ) not valid;
  end if;
end
$$;
