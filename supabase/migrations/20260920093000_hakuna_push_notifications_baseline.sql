-- Hakuna Web Push baseline.
-- Keeps push infrastructure version-controlled without storing VAPID secrets.

create table if not exists public.catalog_push_config (
  account_id uuid primary key references public.catalog_accounts(id) on delete cascade,
  vapid_public_key text not null,
  vapid_private_key text not null,
  subject text not null default 'mailto:soporte@kiubo.app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  audience text not null check (audience in ('provider','customer')),
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

create table if not exists public.catalog_push_events (
  event_key text primary key,
  account_id uuid not null references public.catalog_accounts(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists catalog_push_subscriptions_provider_idx
  on public.catalog_push_subscriptions(account_id,audience,active);

create index if not exists catalog_push_subscriptions_order_idx
  on public.catalog_push_subscriptions(account_id,order_public_token,active)
  where order_public_token is not null;

alter table public.catalog_push_config enable row level security;
alter table public.catalog_push_subscriptions enable row level security;
alter table public.catalog_push_events enable row level security;

revoke all on public.catalog_push_config from public, anon, authenticated;
revoke all on public.catalog_push_subscriptions from public, anon, authenticated;
revoke all on public.catalog_push_events from public, anon, authenticated;

grant select,insert,update,delete on public.catalog_push_config to service_role;
grant select,insert,update,delete on public.catalog_push_subscriptions to service_role;
grant select,insert,update,delete on public.catalog_push_events to service_role;
