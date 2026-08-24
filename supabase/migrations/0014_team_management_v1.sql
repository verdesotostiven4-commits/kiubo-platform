-- KIUBO Pilot Readiness V3 · real cloud team management.
-- Owners/admins can invite authenticated users, assign roles and scope branch access without exposing auth.users.

alter table public.tenant_members
  add column if not exists display_name text;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conname='tenant_members_display_name_sane'
      and conrelid='public.tenant_members'::regclass
  ) then
    alter table public.tenant_members
      add constraint tenant_members_display_name_sane
      check (display_name is null or length(trim(display_name)) between 1 and 120)
      not valid;
  end if;
end
$$;

create or replace function public.validate_team_branch_scope_v1(
  p_tenant uuid,
  p_branch_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_branch_ids is null then
    return;
  end if;

  if cardinality(p_branch_ids)=0 then
    raise exception 'select at least one branch or use all branches';
  end if;

  if exists(
    select 1
    from unnest(p_branch_ids) as requested(branch_id)
    where not exists(
      select 1 from public.branches b
      where b.id=requested.branch_id
        and b.tenant_id=p_tenant
        and b.active
    )
  ) then
    raise exception 'invalid or inactive branch assignment';
  end if;
end
$$;

revoke all on function public.validate_team_branch_scope_v1(uuid,uuid[]) from public;
revoke all on function public.validate_team_branch_scope_v1(uuid,uuid[]) from anon;
revoke all on function public.validate_team_branch_scope_v1(uuid,uuid[]) from authenticated;

create or replace function public.list_tenant_team_v1(p_tenant uuid)
returns table(
  member_id uuid,
  user_id uuid,
  display_name text,
  email text,
  role text,
  active boolean,
  confirmed boolean,
  all_branches boolean,
  branch_ids uuid[],
  created_at timestamptz
)
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if auth.uid() is null or not public.can_manage_tenant_users(p_tenant) then
    raise exception 'team management denied';
  end if;

  return query
  select
    tm.id,
    tm.user_id,
    coalesce(
      nullif(trim(tm.display_name),''),
      nullif(trim(u.raw_user_meta_data->>'full_name'),''),
      nullif(split_part(coalesce(u.email,''),'@',1),''),
      'Usuario KIUBO'
    ),
    coalesce(u.email,''),
    tm.role,
    tm.active,
    u.email_confirmed_at is not null,
    not exists(
      select 1 from public.tenant_member_branches tmb
      where tmb.tenant_member_id=tm.id
    ),
    coalesce(
      (
        select array_agg(tmb.branch_id order by b.code,tmb.branch_id)
        from public.tenant_member_branches tmb
        join public.branches b on b.id=tmb.branch_id
        where tmb.tenant_member_id=tm.id
      ),
      '{}'::uuid[]
    ),
    tm.created_at
  from public.tenant_members tm
  join auth.users u on u.id=tm.user_id
  where tm.tenant_id=p_tenant
  order by
    case tm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    tm.created_at;
end
$$;

revoke all on function public.list_tenant_team_v1(uuid) from public;
revoke all on function public.list_tenant_team_v1(uuid) from anon;
grant execute on function public.list_tenant_team_v1(uuid) to authenticated;

create or replace function public.tenant_invite_preflight_v1(
  p_tenant uuid,
  p_email text,
  p_role text,
  p_branch_ids uuid[] default null
)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_user uuid;
begin
  if auth.uid() is null or not public.can_manage_tenant_users(p_tenant) then
    raise exception 'team management denied';
  end if;
  if v_email='' or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid team email';
  end if;
  if p_role not in('owner','admin','cashier','inventory','viewer')
    or not public.can_assign_tenant_role(p_tenant,p_role)
  then
    raise exception 'role assignment denied';
  end if;

  perform public.validate_team_branch_scope_v1(p_tenant,p_branch_ids);

  select u.id into v_user
  from auth.users u
  where lower(u.email)=v_email
  order by u.created_at asc
  limit 1;

  if v_user=auth.uid() and not public.is_platform_admin() then
    raise exception 'cannot invite your own account';
  end if;

  if v_user is not null and exists(
    select 1 from public.tenant_members tm
    where tm.user_id=v_user
      and tm.tenant_id<>p_tenant
      and tm.active
  ) then
    raise exception 'user already belongs to another active business';
  end if;

  return true;
end
$$;

revoke all on function public.tenant_invite_preflight_v1(uuid,text,text,uuid[]) from public;
revoke all on function public.tenant_invite_preflight_v1(uuid,text,text,uuid[]) from anon;
grant execute on function public.tenant_invite_preflight_v1(uuid,text,text,uuid[]) to authenticated;

create or replace function public.upsert_tenant_member_by_email_v1(
  p_tenant uuid,
  p_email text,
  p_display_name text,
  p_role text,
  p_branch_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_name text:=trim(coalesce(p_display_name,''));
  v_user uuid;
  v_member uuid;
  v_existing_role text;
begin
  perform public.tenant_invite_preflight_v1(p_tenant,v_email,p_role,p_branch_ids);

  if v_name='' then v_name:=split_part(v_email,'@',1); end if;
  if length(v_name)>120 then raise exception 'display name too long'; end if;

  select u.id into v_user
  from auth.users u
  where lower(u.email)=v_email
  order by u.created_at asc
  limit 1;
  if v_user is null then raise exception 'invited auth user not found'; end if;

  select tm.id,tm.role into v_member,v_existing_role
  from public.tenant_members tm
  where tm.tenant_id=p_tenant and tm.user_id=v_user
  for update;

  if v_member is not null
    and v_existing_role in('owner','admin')
    and not public.is_platform_admin()
    and not public.has_tenant_role(p_tenant,array['owner'])
  then
    raise exception 'admin cannot modify owner or admin access';
  end if;

  if v_member is null then
    insert into public.tenant_members(tenant_id,user_id,role,active,display_name)
    values(p_tenant,v_user,p_role,true,v_name)
    returning id into v_member;
  else
    update public.tenant_members
    set role=p_role,active=true,display_name=v_name,updated_at=now()
    where id=v_member;
  end if;

  delete from public.tenant_member_branches
  where tenant_member_id=v_member;

  if p_branch_ids is not null then
    insert into public.tenant_member_branches(tenant_member_id,branch_id)
    select v_member,requested.branch_id
    from (select distinct unnest(p_branch_ids) as branch_id) requested
    on conflict do nothing;
  end if;

  return v_member;
end
$$;

revoke all on function public.upsert_tenant_member_by_email_v1(uuid,text,text,text,uuid[]) from public;
revoke all on function public.upsert_tenant_member_by_email_v1(uuid,text,text,text,uuid[]) from anon;
grant execute on function public.upsert_tenant_member_by_email_v1(uuid,text,text,text,uuid[]) to authenticated;

create or replace function public.update_tenant_member_v1(
  p_tenant uuid,
  p_member uuid,
  p_display_name text,
  p_role text,
  p_active boolean,
  p_branch_ids uuid[] default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_target_user uuid;
  v_existing_role text;
  v_name text:=trim(coalesce(p_display_name,''));
begin
  if auth.uid() is null or not public.can_manage_tenant_users(p_tenant) then
    raise exception 'team management denied';
  end if;

  select tm.user_id,tm.role into v_target_user,v_existing_role
  from public.tenant_members tm
  where tm.id=p_member and tm.tenant_id=p_tenant
  for update;
  if v_target_user is null then raise exception 'team member not found'; end if;

  if v_target_user=auth.uid() and not public.is_platform_admin() then
    raise exception 'cannot modify your own access here';
  end if;

  if v_existing_role in('owner','admin')
    and not public.is_platform_admin()
    and not public.has_tenant_role(p_tenant,array['owner'])
  then
    raise exception 'admin cannot modify owner or admin access';
  end if;

  if p_role not in('owner','admin','cashier','inventory','viewer')
    or not public.can_assign_tenant_role(p_tenant,p_role)
  then
    raise exception 'role assignment denied';
  end if;

  if v_name='' then raise exception 'display name required'; end if;
  if length(v_name)>120 then raise exception 'display name too long'; end if;
  if p_active then perform public.validate_team_branch_scope_v1(p_tenant,p_branch_ids); end if;

  update public.tenant_members
  set display_name=v_name,role=p_role,active=p_active,updated_at=now()
  where id=p_member;

  delete from public.tenant_member_branches
  where tenant_member_id=p_member;

  if p_active and p_branch_ids is not null then
    insert into public.tenant_member_branches(tenant_member_id,branch_id)
    select p_member,requested.branch_id
    from (select distinct unnest(p_branch_ids) as branch_id) requested
    on conflict do nothing;
  end if;

  return true;
end
$$;

revoke all on function public.update_tenant_member_v1(uuid,uuid,text,text,boolean,uuid[]) from public;
revoke all on function public.update_tenant_member_v1(uuid,uuid,text,text,boolean,uuid[]) from anon;
grant execute on function public.update_tenant_member_v1(uuid,uuid,text,text,boolean,uuid[]) to authenticated;
