-- KIUBO Cloud v1 · core multi-tenant + Auth/RLS
create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now();return new;end $$;

create table public.platform_admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.tenants(
  id uuid primary key default gen_random_uuid(),slug text not null unique,display_name text not null,legal_name text,
  status text not null default 'trial' check(status in('trial','active','grace','suspended','cancelled')),
  country_code text not null default 'EC',timezone text not null default 'America/Guayaquil',
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.tenant_members(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in('owner','admin','cashier','inventory','viewer','accounting')),active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,user_id)
);
create table public.branches(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,code text not null,address text,active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(tenant_id,code)
);
create table public.tenant_member_branches(
  tenant_member_id uuid not null references public.tenant_members(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  primary key(tenant_member_id,branch_id)
);
create table public.plans(
  code text primary key check(code in('start','pro','custom','internal')),name text not null,active boolean not null default true,
  monthly_price numeric(10,2),metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.plan_features(
  plan_code text not null references public.plans(code) on delete cascade,feature_key text not null,
  enabled boolean not null default true,limits jsonb not null default '{}'::jsonb,primary key(plan_code,feature_key)
);
create table public.subscriptions(
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_code text not null references public.plans(code),status text not null default 'trial' check(status in('trial','active','grace','suspended','cancelled')),
  trial_ends_at timestamptz,current_period_starts_at timestamptz,current_period_ends_at timestamptz,grace_ends_at timestamptz,suspended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index subscriptions_one_current_per_tenant on public.subscriptions(tenant_id) where status in('trial','active','grace','suspended');
create table public.tenant_feature_overrides(
  tenant_id uuid not null references public.tenants(id) on delete cascade,feature_key text not null,enabled boolean not null,
  limits jsonb not null default '{}'::jsonb,reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  primary key(tenant_id,feature_key)
);
create table public.tenant_settings(
  tenant_id uuid primary key references public.tenants(id) on delete cascade,trade_name text not null,currency text not null default 'USD',
  require_cash_session boolean not null default false,allow_credit boolean not null default true,settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.tenant_branding(
  tenant_id uuid primary key references public.tenants(id) on delete cascade,business_name text not null,logo_url text,
  primary_color text not null default '#ff5c5c',secondary_color text not null default '#0d1b3d',accent_color text not null default '#ff9a1e',
  receipt_tagline text not null default 'Todo tu negocio, en orden.',updated_at timestamptz not null default now()
);

insert into public.plans(code,name,monthly_price,metadata) values
('start','KIUBO Start',7.90,'{"commercial_preview":true}'),
('pro','KIUBO Pro',12.90,'{"commercial_preview":true}'),
('custom','KIUBO Custom',19.90,'{"commercial_preview":true,"price_from":true}'),
('internal','KIUBO Internal',null,'{"internal":true}') on conflict(code) do nothing;
insert into public.plan_features(plan_code,feature_key) values
('start','pos'),('start','inventory'),('start','cash'),('start','customers'),('start','reports_basic'),
('pro','pos'),('pro','inventory'),('pro','cash'),('pro','customers'),('pro','reports_basic'),('pro','purchases'),('pro','suppliers'),('pro','credit'),('pro','payables'),('pro','catalog'),('pro','reports_advanced'),
('custom','pos'),('custom','inventory'),('custom','cash'),('custom','customers'),('custom','reports_basic'),('custom','purchases'),('custom','suppliers'),('custom','credit'),('custom','payables'),('custom','catalog'),('custom','reports_advanced'),('custom','branding'),('custom','multi_branch'),
('internal','pos'),('internal','inventory'),('internal','cash'),('internal','customers'),('internal','reports_basic'),('internal','purchases'),('internal','suppliers'),('internal','credit'),('internal','payables'),('internal','catalog'),('internal','reports_advanced'),('internal','branding'),('internal','multi_branch'),('internal','invoice') on conflict do nothing;

create trigger tenants_updated before update on public.tenants for each row execute function public.set_updated_at();
create trigger members_updated before update on public.tenant_members for each row execute function public.set_updated_at();
create trigger branches_updated before update on public.branches for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins where user_id=auth.uid() and active)
$$;
create or replace function public.has_tenant_access(target_tenant uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(select 1 from public.tenant_members where tenant_id=target_tenant and user_id=auth.uid() and active)
$$;
create or replace function public.has_tenant_role(target_tenant uuid,allowed_roles text[]) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(select 1 from public.tenant_members where tenant_id=target_tenant and user_id=auth.uid() and active and role=any(allowed_roles))
$$;
create or replace function public.has_branch_access(target_tenant uuid,target_branch uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or exists(
    select 1 from public.tenant_members tm where tm.tenant_id=target_tenant and tm.user_id=auth.uid() and tm.active
    and(not exists(select 1 from public.tenant_member_branches x where x.tenant_member_id=tm.id)
      or exists(select 1 from public.tenant_member_branches x where x.tenant_member_id=tm.id and x.branch_id=target_branch))
  )
$$;
create or replace function public.tenant_can_operate(target_tenant uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin() or (
    public.has_tenant_access(target_tenant)
    and exists(select 1 from public.tenants t where t.id=target_tenant and t.status in('trial','active','grace'))
  )
$$;
create or replace function public.tenant_feature_enabled(target_tenant uuid,target_feature text) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    (select o.enabled from public.tenant_feature_overrides o where o.tenant_id=target_tenant and o.feature_key=target_feature),
    (select pf.enabled from public.subscriptions s join public.plan_features pf on pf.plan_code=s.plan_code
      where s.tenant_id=target_tenant and s.status in('trial','active','grace','suspended') and pf.feature_key=target_feature
      order by s.created_at desc limit 1),
    false
  )
$$;
revoke all on function public.is_platform_admin() from public;
revoke all on function public.has_tenant_access(uuid) from public;
revoke all on function public.has_tenant_role(uuid,text[]) from public;
revoke all on function public.has_branch_access(uuid,uuid) from public;
revoke all on function public.tenant_can_operate(uuid) from public;
revoke all on function public.tenant_feature_enabled(uuid,text) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_tenant_access(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid,text[]) to authenticated;
grant execute on function public.has_branch_access(uuid,uuid) to authenticated;
grant execute on function public.tenant_can_operate(uuid) to authenticated;
grant execute on function public.tenant_feature_enabled(uuid,text) to authenticated;

-- Kept as an internal helper only. Public customers are provisioned through KIUBO Control/Edge Function.
create or replace function public.bootstrap_tenant(p_display_name text,p_slug text,p_plan_code text default 'start') returns table(tenant_id uuid,branch_id uuid)
language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();v_tenant uuid;v_branch uuid;
begin
  if v_user is null then raise exception 'authentication required';end if;
  if p_plan_code not in('start','pro','custom') then raise exception 'invalid plan';end if;
  if exists(select 1 from public.tenant_members where user_id=v_user and active) then raise exception 'user already belongs to a tenant';end if;
  insert into public.tenants(slug,display_name) values(lower(trim(p_slug)),trim(p_display_name)) returning id into v_tenant;
  insert into public.branches(tenant_id,name,code) values(v_tenant,'Matriz','001') returning id into v_branch;
  insert into public.tenant_members(tenant_id,user_id,role) values(v_tenant,v_user,'owner');
  insert into public.tenant_settings(tenant_id,trade_name) values(v_tenant,trim(p_display_name));
  insert into public.tenant_branding(tenant_id,business_name) values(v_tenant,trim(p_display_name));
  insert into public.subscriptions(tenant_id,plan_code,status,trial_ends_at) values(v_tenant,p_plan_code,'trial',now()+interval '14 days');
  return query select v_tenant,v_branch;
end$$;
revoke all on function public.bootstrap_tenant(text,text,text) from public;
revoke all on function public.bootstrap_tenant(text,text,text) from authenticated;

alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.branches enable row level security;
alter table public.tenant_member_branches enable row level security;
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tenant_feature_overrides enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_branding enable row level security;

create policy tenants_select on public.tenants for select to authenticated using(public.has_tenant_access(id));
create policy tenants_platform_update on public.tenants for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy members_select on public.tenant_members for select to authenticated using(user_id=auth.uid() or public.has_tenant_role(tenant_id,array['owner','admin']));
create policy members_manage on public.tenant_members for all to authenticated
  using(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']))
  with check(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']));
create policy branches_select on public.branches for select to authenticated using(public.has_branch_access(tenant_id,id));
create policy branches_insert on public.branches for insert to authenticated
  with check(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'multi_branch'));
create policy branches_update on public.branches for update to authenticated
  using(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']))
  with check(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']));
create policy branches_delete on public.branches for delete to authenticated
  using(code<>'001' and public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'multi_branch'));
create policy member_branches_select on public.tenant_member_branches for select to authenticated using(
  exists(select 1 from public.tenant_members tm where tm.id=tenant_member_id and(tm.user_id=auth.uid() or public.has_tenant_role(tm.tenant_id,array['owner','admin'])))
);
create policy member_branches_manage on public.tenant_member_branches for all to authenticated
  using(exists(select 1 from public.tenant_members tm where tm.id=tenant_member_id and public.tenant_can_operate(tm.tenant_id) and public.has_tenant_role(tm.tenant_id,array['owner','admin'])))
  with check(exists(select 1 from public.tenant_members tm where tm.id=tenant_member_id and public.tenant_can_operate(tm.tenant_id) and public.has_tenant_role(tm.tenant_id,array['owner','admin'])));
create policy plans_read on public.plans for select to authenticated using(active);
create policy plan_features_read on public.plan_features for select to authenticated using(true);
create policy subscriptions_read on public.subscriptions for select to authenticated using(public.has_tenant_access(tenant_id));
create policy subscriptions_platform_manage on public.subscriptions for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy overrides_read on public.tenant_feature_overrides for select to authenticated using(public.has_tenant_access(tenant_id));
create policy overrides_platform_manage on public.tenant_feature_overrides for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy settings_read on public.tenant_settings for select to authenticated using(public.has_tenant_access(tenant_id));
create policy settings_manage on public.tenant_settings for all to authenticated
  using(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']))
  with check(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']));
create policy branding_read on public.tenant_branding for select to authenticated using(public.has_tenant_access(tenant_id));
create policy branding_manage on public.tenant_branding for all to authenticated
  using(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'branding'))
  with check(public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'branding'));
