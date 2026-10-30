-- Multiple orders and provider/customer roles can share the same browser endpoint.
create table if not exists public.catalog_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  audience text not null check(audience in ('customer','provider')),
  order_public_token uuid,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id,endpoint)
);
alter table public.catalog_push_subscriptions
  add column if not exists provider_enabled boolean,
  add column if not exists customer_enabled boolean,
  add column if not exists provider_session_version integer;
update public.catalog_push_subscriptions set provider_enabled=(audience='provider') where provider_enabled is null;
update public.catalog_push_subscriptions set customer_enabled=(audience='customer') where customer_enabled is null;
alter table public.catalog_push_subscriptions
  alter column provider_enabled set default false, alter column provider_enabled set not null,
  alter column customer_enabled set default false, alter column customer_enabled set not null;
update public.catalog_push_subscriptions s set provider_session_version=a.session_version
from public.catalog_accounts a where s.account_id=a.id and s.provider_enabled and s.provider_session_version is null;

create table if not exists public.catalog_push_order_bindings (
  subscription_id uuid not null references public.catalog_push_subscriptions(id) on delete cascade,
  order_id uuid not null references public.catalog_orders(id) on delete cascade,
  account_id uuid not null references public.catalog_accounts(id),
  created_at timestamptz not null default now(),
  primary key(subscription_id,order_id)
);
create index if not exists catalog_push_order_bindings_order_idx on public.catalog_push_order_bindings(order_id);
create index if not exists catalog_push_order_bindings_account_idx on public.catalog_push_order_bindings(account_id);
insert into public.catalog_push_order_bindings(subscription_id,order_id,account_id)
select s.id,o.id,s.account_id from public.catalog_push_subscriptions s join public.catalog_orders o
  on o.public_token=s.order_public_token and o.account_id=s.account_id where s.customer_enabled
on conflict do nothing;

create table if not exists public.catalog_notification_deliveries (
  event_key text not null references public.catalog_notification_jobs(event_key) on delete cascade,
  subscription_id uuid not null references public.catalog_push_subscriptions(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key(event_key,subscription_id)
);
create index if not exists catalog_notification_deliveries_subscription_idx on public.catalog_notification_deliveries(subscription_id);
create table if not exists public.catalog_notification_workers (
  account_id uuid primary key references public.catalog_accounts(id),
  token_hash text not null,
  vault_secret_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.catalog_push_subscriptions enable row level security;
alter table public.catalog_push_order_bindings enable row level security;
alter table public.catalog_notification_deliveries enable row level security;
alter table public.catalog_notification_workers enable row level security;
revoke all on public.catalog_push_subscriptions,public.catalog_push_order_bindings,public.catalog_notification_deliveries,
  public.catalog_notification_workers from public,anon,authenticated;
grant all on public.catalog_push_subscriptions,public.catalog_push_order_bindings,public.catalog_notification_deliveries,
  public.catalog_notification_workers to service_role;

create or replace function public.catalog_register_push_subscription(
  p_slug text,p_audience text,p_endpoint text,p_p256dh text,p_auth text,p_user_agent text,p_provider_version integer default null
)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.catalog_accounts%rowtype; s public.catalog_push_subscriptions%rowtype;
begin
  select * into a from public.catalog_accounts where slug=p_slug;
  if not found then raise exception 'account_not_found'; end if;
  if p_audience not in ('customer','provider') then raise exception 'invalid_subscription'; end if;
  if p_audience='provider' and p_provider_version is distinct from a.session_version then raise exception 'session_expired'; end if;
  insert into public.catalog_push_subscriptions(account_id,audience,endpoint,p256dh,auth,user_agent,active,
    customer_enabled,provider_enabled,provider_session_version)
  values(a.id,p_audience,p_endpoint,p_p256dh,p_auth,left(p_user_agent,500),true,
    p_audience='customer',p_audience='provider',case when p_audience='provider' then p_provider_version else null end)
  on conflict(account_id,endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,
    user_agent=excluded.user_agent,active=true,updated_at=now(),
    customer_enabled=public.catalog_push_subscriptions.customer_enabled or excluded.customer_enabled,
    provider_enabled=public.catalog_push_subscriptions.provider_enabled or excluded.provider_enabled,
    provider_session_version=coalesce(excluded.provider_session_version,public.catalog_push_subscriptions.provider_session_version)
  returning * into s;
  return jsonb_build_object('subscription_id',s.id,'endpoint',s.endpoint,'active',s.active,
    'customer_enabled',s.customer_enabled,'provider_enabled',s.provider_enabled);
end;
$$;

create or replace function public.catalog_bind_push_order(p_slug text,p_subscription_id uuid,p_endpoint text,p_order_public_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a uuid; o public.catalog_orders%rowtype; inserted integer;
begin
  select id into a from public.catalog_accounts where slug=p_slug;
  perform 1 from public.catalog_push_subscriptions where id=p_subscription_id and account_id=a and endpoint=p_endpoint
    and active and customer_enabled for update;
  if not found then raise exception 'push_subscription_missing'; end if;
  select * into o from public.catalog_orders where public_token=p_order_public_token and account_id=a;
  if not found then raise exception 'order_not_found'; end if;
  insert into public.catalog_push_order_bindings(subscription_id,order_id,account_id)
  values(p_subscription_id,o.id,a) on conflict do nothing;
  get diagnostics inserted=row_count;
  -- Compatibility only; the binding table is authoritative for all orders.
  update public.catalog_push_subscriptions set order_public_token=p_order_public_token,updated_at=now() where id=p_subscription_id;
  if inserted>0 and o.status='new' and o.created_at>now()-interval '10 minutes' then
    update public.catalog_notification_jobs j set status='pending',available_at=now()
    where j.order_id=o.id and j.audience='customer' and j.kind='created' and j.status='sent'
      and not exists(select 1 from public.catalog_notification_deliveries d where d.event_key=j.event_key and d.subscription_id=p_subscription_id);
  end if;
  return jsonb_build_object('ok',true,'bound',true);
end;
$$;

revoke all on function public.catalog_register_push_subscription(text,text,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.catalog_bind_push_order(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.catalog_register_push_subscription(text,text,text,text,text,text,integer),
  public.catalog_bind_push_order(text,uuid,text,uuid) to service_role;
