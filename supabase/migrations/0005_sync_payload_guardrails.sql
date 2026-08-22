-- KIUBO Cloud v1 · canonicalize client sync payloads server-side
-- Apply after 0001..0004.

create or replace function public.normalize_sync_payload(
  p_tenant uuid,
  p_branch uuid,
  p_type text,
  p_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_payload_tenant text;
  v_payload_branch text;
  v_payload_id text;
begin
  if jsonb_typeof(v_payload)<>'object' then
    raise exception 'sync payload must be an object';
  end if;
  if pg_column_size(v_payload)>262144 then
    raise exception 'sync payload too large';
  end if;

  if p_type in('tenantProducts','sales','cashSessions','cashMovements','credits','creditPayments','purchases','supplierPayments','stockMovements')
     and p_branch is null then
    raise exception 'branch is required for entity';
  end if;

  v_payload_tenant=nullif(v_payload->>'tenantId','');
  if v_payload_tenant is not null and v_payload_tenant<>p_tenant::text then
    raise exception 'payload tenant mismatch';
  end if;
  v_payload=jsonb_set(v_payload,'{tenantId}',to_jsonb(p_tenant::text),true);

  if p_branch is not null then
    if not public.branch_belongs_to_tenant(p_tenant,p_branch) then
      raise exception 'branch does not belong to tenant';
    end if;
    v_payload_branch=nullif(v_payload->>'branchId','');
    if v_payload_branch is not null and v_payload_branch<>p_branch::text then
      raise exception 'payload branch mismatch';
    end if;
    v_payload=jsonb_set(v_payload,'{branchId}',to_jsonb(p_branch::text),true);
  else
    v_payload=v_payload-'branchId';
  end if;

  if p_type in('settings','branding') then
    v_payload=v_payload-'id';
  else
    v_payload_id=nullif(v_payload->>'id','');
    if v_payload_id is not null and v_payload_id<>p_id then
      raise exception 'payload id mismatch';
    end if;
    v_payload=jsonb_set(v_payload,'{id}',to_jsonb(p_id),true);
  end if;

  -- Never persist credential-like or platform escalation fields from a browser payload.
  v_payload=v_payload-'pin'-'password'-'service_role'-'serviceRole'-'platformAdmin'-'platform_admin';
  return v_payload;
end
$$;
revoke all on function public.normalize_sync_payload(uuid,uuid,text,text,jsonb) from public;

create or replace function public.apply_sync_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  op jsonb;
  v_tenant uuid;
  v_branch uuid;
  v_operation text;
  v_type text;
  v_id text;
  v_action text;
  v_payload jsonb;
  v_results jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array'; end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>100 then raise exception 'maximum 100 operations per batch'; end if;

  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant=(op->>'tenantId')::uuid;
      v_branch=nullif(op->>'branchId','')::uuid;
      v_operation=op->>'operationId';
      v_type=op->>'entityType';
      v_id=op->>'entityId';
      v_action=coalesce(op->>'action','upsert');

      if v_operation is null or v_type is null or v_id is null then raise exception 'invalid sync operation'; end if;
      if length(v_operation)>160 or length(v_type)>64 or length(v_id)>200 then raise exception 'sync identifier too long'; end if;
      if v_action not in('upsert','delete') then raise exception 'invalid sync action'; end if;
      if v_type not in('tenantProducts','customers','sales','cashSessions','cashMovements','credits','creditPayments','settings','branding','suppliers','purchases','supplierPayments','stockMovements') then
        raise exception 'unsupported entity type';
      end if;
      if not public.tenant_can_operate(v_tenant) then raise exception 'tenant is not allowed to operate'; end if;
      if not public.can_sync_entity(v_tenant,v_type) then raise exception 'role denied for entity'; end if;
      if v_branch is not null and not public.branch_belongs_to_tenant(v_tenant,v_branch) then raise exception 'branch does not belong to tenant'; end if;
      if v_branch is not null and not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied'; end if;

      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then
        v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));
        continue;
      end if;

      v_payload=case
        when v_action='delete' then '{}'::jsonb
        else public.normalize_sync_payload(v_tenant,v_branch,v_type,v_id,op->'payload')
      end;

      insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
      values(v_tenant,v_branch,v_type,v_id,v_payload,v_action='delete',now())
      on conflict(tenant_id,entity_type,entity_id) do update
        set branch_id=excluded.branch_id,payload=excluded.payload,deleted=excluded.deleted,updated_at=excluded.updated_at;

      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id)
      values(v_tenant,v_operation,v_type,v_id);
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true));
    exception when others then
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end
$$;
revoke all on function public.apply_sync_operations(jsonb) from public;
grant execute on function public.apply_sync_operations(jsonb) to authenticated;
