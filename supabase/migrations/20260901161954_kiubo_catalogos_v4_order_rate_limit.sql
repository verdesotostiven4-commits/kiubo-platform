-- KIUBO Catálogos v4.1
-- Public order throttling. Isolated to catalog_* objects.

create table if not exists public.catalog_order_rate_limits (
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  rate_key text not null,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, rate_key)
);

create index if not exists catalog_order_rate_limits_updated_idx
  on public.catalog_order_rate_limits (updated_at);

alter table public.catalog_order_rate_limits enable row level security;
revoke all on public.catalog_order_rate_limits from public, anon, authenticated;
grant all on public.catalog_order_rate_limits to service_role;

create or replace function public.catalog_check_order_rate(p_slug text, p_rate_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_limit public.catalog_order_rate_limits%rowtype;
begin
  if p_rate_key !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select id into v_account_id
  from public.catalog_accounts
  where slug = p_slug;

  if v_account_id is null then
    raise exception 'account_not_found';
  end if;

  insert into public.catalog_order_rate_limits (account_id, rate_key, request_count)
  values (v_account_id, p_rate_key, 0)
  on conflict (account_id, rate_key) do nothing;

  select * into v_limit
  from public.catalog_order_rate_limits
  where account_id = v_account_id and rate_key = p_rate_key
  for update;

  if v_limit.window_started_at < now() - interval '10 minutes' then
    update public.catalog_order_rate_limits
    set request_count = 1, window_started_at = now(), updated_at = now()
    where account_id = v_account_id and rate_key = p_rate_key;
    return true;
  end if;

  if v_limit.request_count >= 30 then
    update public.catalog_order_rate_limits
    set updated_at = now()
    where account_id = v_account_id and rate_key = p_rate_key;
    return false;
  end if;

  update public.catalog_order_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where account_id = v_account_id and rate_key = p_rate_key;

  return true;
end;
$$;

revoke all on function public.catalog_check_order_rate(text,text) from public, anon, authenticated;
grant execute on function public.catalog_check_order_rate(text,text) to service_role;
