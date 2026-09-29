-- Manual rollback for 20260929003428_yuki_menu_catalog_v1.sql.
-- Review the snapshot before executing. This restores only tenantProducts and
-- intentionally leaves sales, orders, stock movements and settings untouched.

do $$
declare
  v_tenant uuid;
  v_branch uuid;
  v_snapshot jsonb;
  v_row jsonb;
begin
  select tenant_id,branch_id,snapshot into v_tenant,v_branch,v_snapshot
  from private.tenant_catalog_backups
  where backup_key='yuki-menu-catalog-v1-before';
  if v_snapshot is null then raise exception 'YUKI catalog backup not found'; end if;

  for v_row in select value from jsonb_array_elements(v_snapshot) loop
    insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
    values(
      (v_row->>'tenant_id')::uuid,(v_row->>'branch_id')::uuid,v_row->>'entity_type',v_row->>'entity_id',
      v_row->'payload',(v_row->>'deleted')::boolean,now()
    )
    on conflict(tenant_id,entity_type,entity_id) do update
    set branch_id=excluded.branch_id,payload=excluded.payload,deleted=excluded.deleted,updated_at=excluded.updated_at;
  end loop;

  delete from public.sync_entities current
  where current.tenant_id=v_tenant
    and current.branch_id=v_branch
    and current.entity_type='tenantProducts'
    and not exists(
      select 1 from jsonb_array_elements(v_snapshot) original
      where original->>'entity_id'=current.entity_id
    );
end $$;
