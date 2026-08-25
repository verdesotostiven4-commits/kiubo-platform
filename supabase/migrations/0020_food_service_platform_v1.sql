-- KIUBO Food Service Platform V1
-- Reusable food-service orders, business profile configuration, realtime nudge and optimized media storage.
-- This migration is tenant-generic: YUKI is data/configuration, never hardcoded application logic.

create or replace function public.can_sync_entity(target_tenant uuid,target_type text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_platform_admin() or case
    when target_type in('settings','branding') then public.has_tenant_role(target_tenant,array['owner','admin'])
    when target_type in('tenantProducts','suppliers','purchases','supplierPayments') then public.has_tenant_role(target_tenant,array['owner','admin','inventory'])
    when target_type in('customers','sales','cashSessions','cashMovements','credits','creditPayments','orders') then public.has_tenant_role(target_tenant,array['owner','admin','cashier'])
    when target_type='stockMovements' then public.has_tenant_role(target_tenant,array['owner','admin','inventory','cashier'])
    else false end
$$;
revoke all on function public.can_sync_entity(uuid,text) from public;
revoke all on function public.can_sync_entity(uuid,text) from anon;
grant execute on function public.can_sync_entity(uuid,text) to authenticated;

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

  if p_type in('tenantProducts','sales','cashSessions','cashMovements','credits','creditPayments','purchases','supplierPayments','stockMovements','orders')
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

  v_payload=v_payload-'pin'-'password'-'service_role'-'serviceRole'-'platformAdmin'-'platform_admin';
  return v_payload;
end
$$;
revoke all on function public.normalize_sync_payload(uuid,uuid,text,text,jsonb) from public;
revoke all on function public.normalize_sync_payload(uuid,uuid,text,text,jsonb) from anon;
revoke all on function public.normalize_sync_payload(uuid,uuid,text,text,jsonb) from authenticated;

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
      if v_type not in('tenantProducts','customers','sales','cashSessions','cashMovements','credits','creditPayments','settings','branding','suppliers','purchases','supplierPayments','stockMovements','orders') then
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
revoke all on function public.apply_sync_operations(jsonb) from anon;
grant execute on function public.apply_sync_operations(jsonb) to authenticated;

create index if not exists sync_entities_food_orders_idx
  on public.sync_entities(tenant_id,branch_id,updated_at desc)
  where entity_type='orders' and not deleted;

-- A business profile is configuration, not bespoke code. This keeps the same KIUBO app reusable.
create or replace function public.configure_business_profile_v1(
  p_tenant uuid,
  p_trade_name text,
  p_address text default '',
  p_phone text default '',
  p_business_type text default 'general',
  p_service_modes text[] default array['counter']::text[],
  p_table_count integer default 0,
  p_logo_url text default '',
  p_primary_color text default '#0b5a42',
  p_secondary_color text default '#17352c',
  p_accent_color text default '#f28b30',
  p_receipt_footer text default 'Gracias por tu compra'
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_trade_name text:=trim(coalesce(p_trade_name,''));
  v_address text:=trim(coalesce(p_address,''));
  v_phone text:=trim(coalesce(p_phone,''));
  v_type text:=lower(trim(coalesce(p_business_type,'general')));
  v_modes text[]:=coalesce(p_service_modes,array['counter']::text[]);
  v_settings jsonb;
  v_branding jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (public.is_platform_admin() or (public.has_tenant_access(p_tenant) and public.has_tenant_role(p_tenant,array['owner','admin']))) then
    raise exception 'business configuration denied';
  end if;
  if v_trade_name='' or length(v_trade_name)>120 then raise exception 'invalid trade name'; end if;
  if length(v_address)>240 then raise exception 'address too long'; end if;
  if length(v_phone)>40 then raise exception 'phone too long'; end if;
  if v_type not in('general','retail','food_service','services') then raise exception 'invalid business type'; end if;
  if p_table_count<0 or p_table_count>500 then raise exception 'invalid table count'; end if;
  if exists(select 1 from unnest(v_modes) mode where mode not in('counter','table','takeaway','delivery')) then raise exception 'invalid service mode'; end if;

  insert into public.tenant_settings(tenant_id,trade_name,currency,require_cash_session,allow_credit,settings)
  values(
    p_tenant,v_trade_name,'USD',true,true,
    jsonb_build_object(
      'address',v_address,'phone',v_phone,'businessType',v_type,'serviceModes',to_jsonb(v_modes),
      'tableCount',p_table_count,'showProductImages',true,'splashEnabled',true,'receiptWidth','80mm'
    )
  )
  on conflict(tenant_id) do update set
    trade_name=excluded.trade_name,
    require_cash_session=excluded.require_cash_session,
    allow_credit=excluded.allow_credit,
    settings=coalesce(public.tenant_settings.settings,'{}'::jsonb)||excluded.settings,
    updated_at=now();

  insert into public.tenant_branding(tenant_id,business_name,logo_url,primary_color,secondary_color,accent_color,receipt_tagline,updated_at)
  values(p_tenant,v_trade_name,nullif(trim(coalesce(p_logo_url,'')),''),p_primary_color,p_secondary_color,p_accent_color,p_receipt_footer,now())
  on conflict(tenant_id) do update set
    business_name=excluded.business_name,
    logo_url=coalesce(excluded.logo_url,public.tenant_branding.logo_url),
    primary_color=excluded.primary_color,
    secondary_color=excluded.secondary_color,
    accent_color=excluded.accent_color,
    receipt_tagline=excluded.receipt_tagline,
    updated_at=now();

  v_settings=jsonb_build_object(
    'tenantId',p_tenant::text,'tradeName',v_trade_name,'legalName','', 'ruc','',
    'establishment','001','emissionPoint','001','currency','USD','accent',p_primary_color,
    'receiptFooter',p_receipt_footer,'requireCashSession',true,'allowCredit',true,
    'address',v_address,'phone',v_phone,'businessType',v_type,'serviceModes',to_jsonb(v_modes),
    'tableCount',p_table_count,'showProductImages',true,'splashEnabled',true,'receiptWidth','80mm'
  );
  v_branding=jsonb_build_object(
    'tenantId',p_tenant::text,'businessName',v_trade_name,'logoUrl',coalesce(p_logo_url,''),
    'primaryColor',p_primary_color,'secondaryColor',p_secondary_color,'accentColor',p_accent_color,
    'receiptTagline',p_receipt_footer,'updatedAt',now()::text
  );

  insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
  values(p_tenant,null,'settings',p_tenant::text,v_settings,false,now())
  on conflict(tenant_id,entity_type,entity_id) do update set payload=excluded.payload,deleted=false,updated_at=now();

  insert into public.sync_entities(tenant_id,branch_id,entity_type,entity_id,payload,deleted,updated_at)
  values(p_tenant,null,'branding',p_tenant::text,v_branding,false,now())
  on conflict(tenant_id,entity_type,entity_id) do update set payload=excluded.payload,deleted=false,updated_at=now();

  return true;
end
$$;
revoke all on function public.configure_business_profile_v1(uuid,text,text,text,text,text[],integer,text,text,text,text,text) from public;
revoke all on function public.configure_business_profile_v1(uuid,text,text,text,text,text[],integer,text,text,text,text,text) from anon;
grant execute on function public.configure_business_profile_v1(uuid,text,text,text,text,text[],integer,text,text,text,text,text) to authenticated;

-- Realtime is only a nudge; canonical state still arrives through revision-based sync.
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='sync_entities'
  ) then
    alter publication supabase_realtime add table public.sync_entities;
  end if;
end
$$;

-- Public CDN reads for logos/menu photos; authenticated tenant members control writes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kiubo-media','kiubo-media',true,6291456,array['image/webp','image/png','image/jpeg']::text[])
on conflict(id) do update set
  public=true,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists kiubo_media_read on storage.objects;
drop policy if exists kiubo_media_insert on storage.objects;
drop policy if exists kiubo_media_update on storage.objects;
drop policy if exists kiubo_media_delete on storage.objects;

create policy kiubo_media_read on storage.objects
for select to public
using(bucket_id='kiubo-media');

create policy kiubo_media_insert on storage.objects
for insert to authenticated
with check(
  bucket_id='kiubo-media' and (
    public.is_platform_admin() or exists(
      select 1 from public.tenant_members tm
      where tm.user_id=auth.uid() and tm.active
        and tm.tenant_id::text=split_part(name,'/',1)
        and tm.role in('owner','admin','inventory')
    )
  )
);

create policy kiubo_media_update on storage.objects
for update to authenticated
using(
  bucket_id='kiubo-media' and (
    public.is_platform_admin() or exists(
      select 1 from public.tenant_members tm
      where tm.user_id=auth.uid() and tm.active
        and tm.tenant_id::text=split_part(name,'/',1)
        and tm.role in('owner','admin','inventory')
    )
  )
)
with check(
  bucket_id='kiubo-media' and (
    public.is_platform_admin() or exists(
      select 1 from public.tenant_members tm
      where tm.user_id=auth.uid() and tm.active
        and tm.tenant_id::text=split_part(name,'/',1)
        and tm.role in('owner','admin','inventory')
    )
  )
);

create policy kiubo_media_delete on storage.objects
for delete to authenticated
using(
  bucket_id='kiubo-media' and (
    public.is_platform_admin() or exists(
      select 1 from public.tenant_members tm
      where tm.user_id=auth.uid() and tm.active
        and tm.tenant_id::text=split_part(name,'/',1)
        and tm.role in('owner','admin','inventory')
    )
  )
);
