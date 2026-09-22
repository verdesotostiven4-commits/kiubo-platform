-- KIUBO Cloud · hotfix finance branch authorization used by multi-device cash.
-- Some production deployments wrapped apply_finance_transactions_v2 with a call to
-- branch_can_operate(), but that helper is not part of the current public schema.
-- Replace only that wrapper guard; fresh databases using 0011 already have the
-- canonical tenant + branch + membership checks and therefore no-op here.

do $do$
declare
  ddl text;
  old_guard text := $old$if not public.branch_can_operate(v_tenant,v_branch) then raise exception 'branch denied'; end if;$old$;
  new_guard text := $new$if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;$new$;
begin
  select pg_get_functiondef('public.apply_finance_transactions_v2(jsonb)'::regprocedure) into ddl;
  if position('branch_can_operate' in ddl)=0 then
    return;
  end if;
  if position(old_guard in ddl)=0 then
    raise exception 'apply_finance_transactions_v2 branch guard signature changed';
  end if;
  ddl:=replace(ddl,old_guard,new_guard);
  execute ddl;
end
$do$;

do $verify$
declare
  ddl text;
begin
  select pg_get_functiondef('public.apply_finance_transactions_v2(jsonb)'::regprocedure) into ddl;
  if position('branch_can_operate' in ddl)>0 then raise exception 'obsolete branch_can_operate guard remains'; end if;
  if position('tenant_can_operate' in ddl)=0 then raise exception 'tenant operation guard missing'; end if;
  if position('branch_belongs_to_tenant' in ddl)=0 then raise exception 'branch ownership guard missing'; end if;
  if position('has_branch_access' in ddl)=0 then raise exception 'branch membership guard missing'; end if;
end
$verify$;
