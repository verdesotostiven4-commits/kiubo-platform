-- YUKI operates in Galápagos (UTC-6). Store the business timezone in the
-- canonical synced settings row so every device groups the same sale into
-- the same business day, regardless of the device's own timezone.

do $$
declare
  v_tenant uuid;
  v_changed_tenant integer;
  v_changed_settings integer;
  v_changed_sync integer;
begin
  select id into v_tenant
  from public.tenants
  where slug='yuki-irwf' and display_name='YUKI';

  if v_tenant is null then
    raise exception 'YUKI tenant not found';
  end if;

  update public.tenants
  set timezone='Pacific/Galapagos',updated_at=now()
  where id=v_tenant;
  get diagnostics v_changed_tenant=row_count;

  update public.tenant_settings
  set settings=settings||jsonb_build_object('timeZone','Pacific/Galapagos'),updated_at=now()
  where tenant_id=v_tenant;
  get diagnostics v_changed_settings=row_count;

  update public.sync_entities
  set payload=payload||jsonb_build_object('timeZone','Pacific/Galapagos'),updated_at=now()
  where tenant_id=v_tenant and entity_type='settings' and not deleted;
  get diagnostics v_changed_sync=row_count;

  if v_changed_tenant<>1 or v_changed_settings<>1 or v_changed_sync<>1 then
    raise exception 'Expected one YUKI row per settings surface; tenant %, settings %, sync %',v_changed_tenant,v_changed_settings,v_changed_sync;
  end if;
end $$;
