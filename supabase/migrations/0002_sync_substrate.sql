-- KIUBO Cloud v1 · idempotent, tenant-scoped offline synchronization substrate
create table public.sync_entities(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(tenant_id,entity_type,entity_id)
);
create index sync_entities_pull_idx on public.sync_entities(tenant_id,updated_at);
create table public.sync_receipts(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  operation_id text not null,
  entity_type text not null,
  entity_id text not null,
  processed_at timestamptz not null default now(),
  primary key(tenant_id,operation_id)
);
alter table public.sync_entities enable row level security;alter table public.sync_receipts enable row level security;
create policy sync_entities_read on public.sync_entities for select to authenticated using(public.has_tenant_access(tenant_id) and(branch_id is null or public.has_branch_access(tenant_id,branch_id)));
create policy sync_receipts_read on public.sync_receipts for select to authenticated using(public.has_tenant_access(tenant_id));

create or replace function public.apply_sync_operations(p_operations jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare op jsonb;v_tenant uuid;v_branch uuid;v_operation text;v_type text;v_id text;v_action text;v_results jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required';end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb))<>'array' then raise exception 'operations must be an array';end if;
  if jsonb_array_length(coalesce(p_operations,'[]'::jsonb))>100 then raise exception 'maximum 100 operations per batch';end if;
  for op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    begin
      v_tenant=(op->>'tenantId')::uuid;v_branch=nullif(op->>'branchId','')::uuid;v_operation=op->>'operationId';v_type=op->>'entityType';v_id=op->>'entityId';v_action=coalesce(op->>'action','upsert');
      if v_operation is null or v_type is null or v_id is null then raise exception 'invalid sync operation';end if;
      if v_action not in('upsert','delete') then raise exception 'invalid sync action';end if;
      if v_type not in('tenants','branches','tenantProducts','customers','sales','users','cashSessions','cashMovements','credits','creditPayments','settings','branding','suppliers','purchases','supplierPayments','stockMovements') then raise exception 'unsupported entity type';end if;
      if not public.has_tenant_access(v_tenant) then raise exception 'tenant denied';end if;
      if v_branch is not null and not public.has_branch_access(v_tenant,v_branch) then raise exception 'branch denied';end if;
      if exists(select 1 from public.sync_receipts where tenant_id=v_tenant and operation_id=v_operation) then v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true,'duplicate',true));continue;end if;
      insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
      values(v_tenant,v_branch,v_type,v_id,coalesce(op->'payload','{}'::jsonb),v_action='delete',now())
      on conflict(tenant_id,entity_type,entity_id) do update set branch_id=excluded.branch_id,payload=excluded.payload,deleted=excluded.deleted,updated_at=excluded.updated_at;
      insert into public.sync_receipts(tenant_id,operation_id,entity_type,entity_id) values(v_tenant,v_operation,v_type,v_id);
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',v_operation,'ok',true));
    exception when others then
      v_results=v_results||jsonb_build_array(jsonb_build_object('operationId',coalesce(v_operation,''),'ok',false,'error',sqlerrm));
    end;
  end loop;
  return v_results;
end$$;
revoke all on function public.apply_sync_operations(jsonb) from public;grant execute on function public.apply_sync_operations(jsonb) to authenticated;

create or replace function public.pull_sync_changes(p_tenant uuid,p_cursor timestamptz default '1970-01-01T00:00:00Z')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_cursor timestamptz:=coalesce(p_cursor,'1970-01-01T00:00:00Z');v_next timestamptz;v_changes jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required';end if;
  if not public.has_tenant_access(p_tenant) then raise exception 'tenant denied';end if;
  select max(updated_at),coalesce(jsonb_agg(jsonb_build_object('tenantId',tenant_id::text,'branchId',branch_id::text,'entityType',entity_type,'entityId',entity_id,'action',case when deleted then 'delete' else 'upsert' end,'payload',case when deleted then null else payload end,'updatedAt',updated_at) order by updated_at),'[]'::jsonb)
  into v_next,v_changes from public.sync_entities where tenant_id=p_tenant and updated_at>v_cursor and(branch_id is null or public.has_branch_access(tenant_id,branch_id));
  return jsonb_build_object('cursor',coalesce(v_next,v_cursor),'changes',v_changes);
end$$;
revoke all on function public.pull_sync_changes(uuid,timestamptz) from public;grant execute on function public.pull_sync_changes(uuid,timestamptz) to authenticated;
