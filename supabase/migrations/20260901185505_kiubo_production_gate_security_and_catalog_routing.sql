-- KIUBO Production Gate · security hardening and reusable Catalogs routing.
-- Applied to production as migration 20260901185505.

revoke execute on function public.pull_sync_changes_v2(uuid,bigint,integer) from public;
revoke execute on function public.pull_sync_changes_v2(uuid,bigint,integer) from anon;
grant execute on function public.pull_sync_changes_v2(uuid,bigint,integer) to authenticated;

drop policy if exists members_select on public.tenant_members;
create policy members_select on public.tenant_members
for select to authenticated
using ((user_id = (select auth.uid())) or public.has_tenant_role(tenant_id,array['owner','admin']));

drop policy if exists member_branches_select on public.tenant_member_branches;
create policy member_branches_select on public.tenant_member_branches
for select to authenticated
using (exists (
  select 1 from public.tenant_members tm
  where tm.id=tenant_member_branches.tenant_member_id
    and (tm.user_id=(select auth.uid()) or public.has_tenant_role(tm.tenant_id,array['owner','admin']))
));

alter table public.catalog_accounts add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.catalog_accounts add column if not exists public_base_url text;
alter table public.catalog_accounts add column if not exists allowed_origins text[] not null default '{}'::text[];

create unique index if not exists catalog_accounts_tenant_unique_idx
  on public.catalog_accounts(tenant_id) where tenant_id is not null;
create index if not exists catalog_accounts_tenant_idx on public.catalog_accounts(tenant_id);

update public.catalog_accounts
set public_base_url='https://hakuna-matata-catalogo.vercel.app',
    allowed_origins=array[
      'https://hakuna-matata-catalogo.vercel.app',
      'https://hakuna-matata-catalogo-verdesotostiven4-5089s-projects.vercel.app'
    ]::text[]
where slug='hakuna-matata'
  and (public_base_url is null or coalesce(array_length(allowed_origins,1),0)=0);

create or replace function public.platform_list_catalog_accounts()
returns table(
  account_id uuid,
  tenant_id uuid,
  slug text,
  name text,
  public_base_url text,
  is_open boolean,
  show_prices boolean,
  product_count bigint,
  order_count bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;
  return query
  select a.id,a.tenant_id,a.slug,a.name,a.public_base_url,a.is_open,a.show_prices,
    (select count(*) from public.catalog_products p where p.account_id=a.id and p.archived_at is null),
    (select count(*) from public.catalog_orders o where o.account_id=a.id),
    a.updated_at
  from public.catalog_accounts a
  order by a.created_at;
end
$$;

create or replace function public.platform_create_catalog_account(
  p_name text,
  p_slug text,
  p_pin text,
  p_public_base_url text default null,
  p_allowed_origins text[] default '{}'::text[],
  p_tenant uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_name text:=trim(coalesce(p_name,''));
  v_slug text:=lower(trim(coalesce(p_slug,'')));
  v_base text:=nullif(regexp_replace(trim(coalesce(p_public_base_url,'')),'/+$',''), '');
  v_origins text[]:='{}'::text[];
  v_origin text;
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'platform admin required'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'invalid catalog name'; end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug)>63 then raise exception 'invalid catalog slug'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin_must_be_4_digits'; end if;
  if v_base is not null and v_base !~ '^https://[^[:space:]]+$' and v_base !~ '^http://localhost(:[0-9]+)?$' then raise exception 'invalid public base url'; end if;
  if coalesce(array_length(p_allowed_origins,1),0)>20 then raise exception 'too many allowed origins'; end if;
  foreach v_origin in array coalesce(p_allowed_origins,'{}'::text[]) loop
    v_origin:=regexp_replace(trim(v_origin),'/+$','');
    if v_origin !~ '^https://[^/[:space:]]+$' and v_origin !~ '^http://localhost(:[0-9]+)?$' then raise exception 'invalid allowed origin'; end if;
    if not (v_origin=any(v_origins)) then v_origins:=array_append(v_origins,v_origin); end if;
  end loop;
  if v_base is not null then
    v_origin:=substring(v_base from '^(https?://[^/]+)');
    if v_origin is not null and not (v_origin=any(v_origins)) then v_origins:=array_append(v_origins,v_origin); end if;
  end if;
  if p_tenant is not null and not exists(select 1 from public.tenants t where t.id=p_tenant and t.status<>'cancelled') then raise exception 'tenant not found'; end if;

  insert into public.catalog_accounts(tenant_id,slug,name,provider_pin_hash,public_base_url,allowed_origins)
  values(p_tenant,v_slug,v_name,extensions.crypt(p_pin,extensions.gen_salt('bf',12)),v_base,v_origins)
  returning id into v_id;

  insert into public.catalog_activity_log(account_id,actor_type,actor_id,action,entity_type,entity_id,metadata)
  values(v_id,'master',auth.uid()::text,'account.created','account',v_id::text,jsonb_build_object('tenant_id',p_tenant,'slug',v_slug));
  return v_id;
end
$$;

create or replace function public.platform_update_catalog_routing(
  p_account uuid,
  p_public_base_url text,
  p_allowed_origins text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_base text:=nullif(regexp_replace(trim(coalesce(p_public_base_url,'')),'/+$',''), '');
  v_origins text[]:='{}'::text[];
  v_origin text;
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'platform admin required'; end if;
  if v_base is not null and v_base !~ '^https://[^[:space:]]+$' and v_base !~ '^http://localhost(:[0-9]+)?$' then raise exception 'invalid public base url'; end if;
  if coalesce(array_length(p_allowed_origins,1),0)>20 then raise exception 'too many allowed origins'; end if;
  foreach v_origin in array coalesce(p_allowed_origins,'{}'::text[]) loop
    v_origin:=regexp_replace(trim(v_origin),'/+$','');
    if v_origin !~ '^https://[^/[:space:]]+$' and v_origin !~ '^http://localhost(:[0-9]+)?$' then raise exception 'invalid allowed origin'; end if;
    if not (v_origin=any(v_origins)) then v_origins:=array_append(v_origins,v_origin); end if;
  end loop;
  if v_base is not null then
    v_origin:=substring(v_base from '^(https?://[^/]+)');
    if v_origin is not null and not (v_origin=any(v_origins)) then v_origins:=array_append(v_origins,v_origin); end if;
  end if;
  update public.catalog_accounts set public_base_url=v_base,allowed_origins=v_origins,updated_at=now() where id=p_account;
  if not found then raise exception 'catalog account not found'; end if;
  insert into public.catalog_activity_log(account_id,actor_type,actor_id,action,entity_type,entity_id,metadata)
  values(p_account,'master',auth.uid()::text,'account.routing_updated','account',p_account::text,jsonb_build_object('public_base_url',v_base));
end
$$;

create or replace function public.platform_link_catalog_account(p_account uuid,p_tenant uuid default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'platform admin required'; end if;
  if p_tenant is not null and not exists(select 1 from public.tenants where id=p_tenant and status<>'cancelled') then raise exception 'tenant not found'; end if;
  update public.catalog_accounts set tenant_id=p_tenant,updated_at=now() where id=p_account;
  if not found then raise exception 'catalog account not found'; end if;
  insert into public.catalog_activity_log(account_id,actor_type,actor_id,action,entity_type,entity_id,metadata)
  values(p_account,'master',auth.uid()::text,'account.tenant_link_updated','account',p_account::text,jsonb_build_object('tenant_id',p_tenant));
end
$$;

revoke all on function public.platform_list_catalog_accounts() from public,anon;
revoke all on function public.platform_create_catalog_account(text,text,text,text,text[],uuid) from public,anon;
revoke all on function public.platform_update_catalog_routing(uuid,text,text[]) from public,anon;
revoke all on function public.platform_link_catalog_account(uuid,uuid) from public,anon;
grant execute on function public.platform_list_catalog_accounts() to authenticated;
grant execute on function public.platform_create_catalog_account(text,text,text,text,text[],uuid) to authenticated;
grant execute on function public.platform_update_catalog_routing(uuid,text,text[]) to authenticated;
grant execute on function public.platform_link_catalog_account(uuid,uuid) to authenticated;
