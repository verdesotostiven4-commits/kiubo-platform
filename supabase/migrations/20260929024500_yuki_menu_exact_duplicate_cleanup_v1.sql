-- KIUBO · YUKI exact duplicate cleanup V1
-- Handles products created concurrently before the canonical menu migration.
-- Rows are archived, never deleted, so historical sales keep their references.

do $$
declare
  v_tenant uuid;
  v_branch uuid;
begin
  select id into v_tenant
  from public.tenants
  where slug='yuki-irwf' and display_name='YUKI';
  if v_tenant is null then raise exception 'YUKI production tenant not found'; end if;

  select id into v_branch
  from public.branches
  where tenant_id=v_tenant and code='001' and name='Matriz' and active;
  if v_branch is null then raise exception 'YUKI production branch not found'; end if;

  update public.sync_entities candidate
  set payload=candidate.payload||jsonb_build_object(
    'active',false,
    'menuFeatured',false,
    'archivedReason','Duplicado exacto conciliado por menú YUKI 2026-09'
  ),updated_at=now()
  where candidate.tenant_id=v_tenant
    and candidate.branch_id=v_branch
    and candidate.entity_type='tenantProducts'
    and not candidate.deleted
    and coalesce((candidate.payload->>'active')::boolean,false)
    and candidate.payload->>'productKind'='sellable'
    and not coalesce((candidate.payload->>'menuFeatured')::boolean,false)
    and exists(
      select 1
      from public.sync_entities canonical
      where canonical.tenant_id=candidate.tenant_id
        and canonical.branch_id=candidate.branch_id
        and canonical.entity_type='tenantProducts'
        and not canonical.deleted
        and canonical.entity_id<>candidate.entity_id
        and coalesce((canonical.payload->>'active')::boolean,false)
        and coalesce((canonical.payload->>'menuFeatured')::boolean,false)
        and canonical.payload->>'menuVersion'='2026-09'
        and lower(trim(canonical.payload->>'name'))=lower(trim(candidate.payload->>'name'))
    );
end $$;
