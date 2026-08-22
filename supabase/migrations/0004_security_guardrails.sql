-- KIUBO Cloud v1 · security guardrails for memberships and branch scopes
-- Apply after 0001_core_multitenant.sql, 0002_sync_substrate.sql and 0003_platform_provisioning.sql.

create or replace function public.can_assign_tenant_role(p_tenant uuid,p_role text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_platform_admin()
    or (
      public.has_tenant_role(p_tenant,array['owner'])
      and p_role in('owner','admin','cashier','inventory','viewer','accounting')
    )
    or (
      public.has_tenant_role(p_tenant,array['admin'])
      and p_role in('cashier','inventory','viewer','accounting')
    )
$$;
revoke all on function public.can_assign_tenant_role(uuid,text) from public;
grant execute on function public.can_assign_tenant_role(uuid,text) to authenticated;

create or replace function public.branch_belongs_to_tenant(p_tenant uuid,p_branch uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(select 1 from public.branches where id=p_branch and tenant_id=p_tenant)
$$;
revoke all on function public.branch_belongs_to_tenant(uuid,uuid) from public;
grant execute on function public.branch_belongs_to_tenant(uuid,uuid) to authenticated;

create or replace function public.guard_tenant_member_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='UPDATE' then
    if new.tenant_id<>old.tenant_id or new.user_id<>old.user_id then
      raise exception 'tenant_id and user_id are immutable';
    end if;
    if new.role<>old.role and not public.can_assign_tenant_role(new.tenant_id,new.role) then
      raise exception 'role assignment denied';
    end if;
  elsif tg_op='INSERT' then
    if not public.can_assign_tenant_role(new.tenant_id,new.role) then
      raise exception 'role assignment denied';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists tenant_members_guard_write on public.tenant_members;
create trigger tenant_members_guard_write
before insert or update on public.tenant_members
for each row execute function public.guard_tenant_member_write();

create or replace function public.guard_member_branch_scope()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.tenant_members where id=new.tenant_member_id;
  if v_tenant is null then raise exception 'tenant member not found'; end if;
  if not public.branch_belongs_to_tenant(v_tenant,new.branch_id) then
    raise exception 'branch does not belong to member tenant';
  end if;
  return new;
end
$$;

drop trigger if exists tenant_member_branches_guard_scope on public.tenant_member_branches;
create trigger tenant_member_branches_guard_scope
before insert or update on public.tenant_member_branches
for each row execute function public.guard_member_branch_scope();

create or replace function public.guard_last_active_owner()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_tenant uuid:=old.tenant_id;
begin
  if old.role='owner' and old.active and (tg_op='DELETE' or new.role<>'owner' or not new.active) then
    if exists(select 1 from public.tenants where id=v_tenant)
       and not exists(
         select 1 from public.tenant_members
         where tenant_id=v_tenant and id<>old.id and role='owner' and active
       ) then
      raise exception 'tenant must keep at least one active owner';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists tenant_members_guard_last_owner on public.tenant_members;
create trigger tenant_members_guard_last_owner
before update or delete on public.tenant_members
for each row execute function public.guard_last_active_owner();

-- Replace broad membership write policy with role-aware policies.
drop policy if exists members_manage on public.tenant_members;
drop policy if exists members_insert on public.tenant_members;
drop policy if exists members_update on public.tenant_members;
drop policy if exists members_delete on public.tenant_members;

create policy members_insert on public.tenant_members
for insert to authenticated
with check(public.can_assign_tenant_role(tenant_id,role));

create policy members_update on public.tenant_members
for update to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin']))
with check(public.can_assign_tenant_role(tenant_id,role));

create policy members_delete on public.tenant_members
for delete to authenticated
using(
  public.is_platform_admin()
  or public.has_tenant_role(tenant_id,array['owner'])
  or (
    public.has_tenant_role(tenant_id,array['admin'])
    and role in('cashier','inventory','viewer','accounting')
  )
);

-- Tighten branch assignment write policy with same-tenant validation.
drop policy if exists member_branches_manage on public.tenant_member_branches;
create policy member_branches_manage on public.tenant_member_branches
for all to authenticated
using(
  exists(
    select 1 from public.tenant_members tm
    where tm.id=tenant_member_id
      and public.has_tenant_role(tm.tenant_id,array['owner','admin'])
  )
)
with check(
  exists(
    select 1 from public.tenant_members tm
    where tm.id=tenant_member_id
      and public.has_tenant_role(tm.tenant_id,array['owner','admin'])
      and public.branch_belongs_to_tenant(tm.tenant_id,branch_id)
  )
);
