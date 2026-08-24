-- KIUBO Pilot Readiness V1 · branch-scope integrity at the database boundary.
-- Prevents cross-tenant branch references and operational writes into deactivated branches.

create or replace function public.guard_sync_entity_branch_scope()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_branch_tenant uuid;
  v_branch_active boolean;
begin
  if new.branch_id is null then
    return new;
  end if;

  select tenant_id,active
  into v_branch_tenant,v_branch_active
  from public.branches
  where id=new.branch_id;

  if v_branch_tenant is null then
    raise exception 'sync branch not found';
  end if;

  if v_branch_tenant<>new.tenant_id then
    raise exception 'sync branch belongs to another tenant';
  end if;

  if not v_branch_active and not new.deleted then
    -- A branch may be deactivated while its last cash session is still open.
    -- Allow only the final open -> closed transition; all other operational writes stop.
    if tg_op='UPDATE'
      and new.entity_type='cashSessions'
      and lower(coalesce(old.payload->>'status',''))='open'
      and lower(coalesce(new.payload->>'status',''))='closed'
    then
      return new;
    end if;
    raise exception 'branch is inactive';
  end if;

  return new;
end
$$;

revoke all on function public.guard_sync_entity_branch_scope() from public;
revoke all on function public.guard_sync_entity_branch_scope() from anon;
revoke all on function public.guard_sync_entity_branch_scope() from authenticated;

drop trigger if exists sync_entities_guard_branch_scope on public.sync_entities;
create trigger sync_entities_guard_branch_scope
before insert or update on public.sync_entities
for each row execute function public.guard_sync_entity_branch_scope();

-- Defensive helper used by future transactional RPCs and server-side checks.
create or replace function public.branch_can_operate(p_tenant uuid,p_branch uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.tenant_can_operate(p_tenant)
    and public.has_branch_access(p_tenant,p_branch)
    and exists(
      select 1 from public.branches b
      where b.id=p_branch and b.tenant_id=p_tenant and b.active
    )
$$;

revoke all on function public.branch_can_operate(uuid,uuid) from public;
revoke all on function public.branch_can_operate(uuid,uuid) from anon;
grant execute on function public.branch_can_operate(uuid,uuid) to authenticated;
