-- KIUBO Cloud · one active operational device per business user.
-- Platform-admin client preview is intentionally bypassed and never owns a lease.

create table if not exists public.operational_sessions(
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_label text not null default 'Dispositivo',
  claimed_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(tenant_id,user_id)
);

create index if not exists operational_sessions_last_seen_idx
  on public.operational_sessions(last_seen_at);

alter table public.operational_sessions enable row level security;
revoke all on table public.operational_sessions from public;
revoke all on table public.operational_sessions from anon;
revoke all on table public.operational_sessions from authenticated;

create or replace function public.claim_operational_session_v1(
  p_tenant uuid,
  p_device_id text,
  p_device_label text default 'Dispositivo'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_row public.operational_sessions%rowtype;
  v_label text:=left(coalesce(nullif(trim(p_device_label),''),'Dispositivo'),80);
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if public.is_platform_admin() then
    return jsonb_build_object('granted',true,'bypassed',true);
  end if;
  if p_tenant is null or p_device_id is null or length(trim(p_device_id))<4 or length(p_device_id)>220 then
    raise exception 'invalid operational device';
  end if;
  if not public.has_tenant_access(p_tenant) then raise exception 'tenant denied'; end if;
  if not public.tenant_can_operate(p_tenant) then raise exception 'tenant is not allowed to operate'; end if;

  perform pg_advisory_xact_lock(hashtextextended('kiubo:operational:'||p_tenant::text||':'||v_user::text,0));
  select * into v_row
  from public.operational_sessions
  where tenant_id=p_tenant and user_id=v_user
  for update;

  if not found then
    insert into public.operational_sessions(tenant_id,user_id,device_id,device_label,claimed_at,last_seen_at)
    values(p_tenant,v_user,p_device_id,v_label,now(),now());
    return jsonb_build_object('granted',true,'claimedAt',now());
  end if;

  if v_row.device_id=p_device_id or v_row.last_seen_at<now()-interval '75 seconds' then
    update public.operational_sessions
    set device_id=p_device_id,
        device_label=v_label,
        claimed_at=case when v_row.device_id=p_device_id then v_row.claimed_at else now() end,
        last_seen_at=now()
    where tenant_id=p_tenant and user_id=v_user;
    return jsonb_build_object('granted',true,'claimedAt',case when v_row.device_id=p_device_id then v_row.claimed_at else now() end);
  end if;

  return jsonb_build_object(
    'granted',false,
    'conflict',true,
    'activeDeviceLabel',v_row.device_label,
    'claimedAt',v_row.claimed_at,
    'lastSeenAt',v_row.last_seen_at
  );
end
$$;

create or replace function public.transfer_operational_session_v1(
  p_tenant uuid,
  p_device_id text,
  p_device_label text default 'Dispositivo'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_label text:=left(coalesce(nullif(trim(p_device_label),''),'Dispositivo'),80);
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if public.is_platform_admin() then
    return jsonb_build_object('granted',true,'bypassed',true);
  end if;
  if p_tenant is null or p_device_id is null or length(trim(p_device_id))<4 or length(p_device_id)>220 then
    raise exception 'invalid operational device';
  end if;
  if not public.has_tenant_access(p_tenant) then raise exception 'tenant denied'; end if;
  if not public.tenant_can_operate(p_tenant) then raise exception 'tenant is not allowed to operate'; end if;

  perform pg_advisory_xact_lock(hashtextextended('kiubo:operational:'||p_tenant::text||':'||v_user::text,0));
  insert into public.operational_sessions(tenant_id,user_id,device_id,device_label,claimed_at,last_seen_at)
  values(p_tenant,v_user,p_device_id,v_label,now(),now())
  on conflict(tenant_id,user_id) do update
    set device_id=excluded.device_id,
        device_label=excluded.device_label,
        claimed_at=excluded.claimed_at,
        last_seen_at=excluded.last_seen_at;

  return jsonb_build_object('granted',true,'claimedAt',now());
end
$$;

create or replace function public.heartbeat_operational_session_v1(
  p_tenant uuid,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
  v_count integer:=0;
  v_row public.operational_sessions%rowtype;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if public.is_platform_admin() then
    return jsonb_build_object('granted',true,'bypassed',true);
  end if;
  if not public.has_tenant_access(p_tenant) then raise exception 'tenant denied'; end if;

  update public.operational_sessions
  set last_seen_at=now()
  where tenant_id=p_tenant and user_id=v_user and device_id=p_device_id;
  get diagnostics v_count=row_count;
  if v_count=1 then return jsonb_build_object('granted',true); end if;

  select * into v_row
  from public.operational_sessions
  where tenant_id=p_tenant and user_id=v_user;

  if not found then return jsonb_build_object('granted',false,'conflict',true); end if;
  return jsonb_build_object(
    'granted',false,
    'conflict',true,
    'activeDeviceLabel',v_row.device_label,
    'claimedAt',v_row.claimed_at,
    'lastSeenAt',v_row.last_seen_at
  );
end
$$;

create or replace function public.release_operational_session_v1(
  p_tenant uuid,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null then return jsonb_build_object('granted',true); end if;
  if public.is_platform_admin() then return jsonb_build_object('granted',true,'bypassed',true); end if;
  delete from public.operational_sessions
  where tenant_id=p_tenant and user_id=v_user and device_id=p_device_id;
  return jsonb_build_object('granted',true);
end
$$;

revoke all on function public.claim_operational_session_v1(uuid,text,text) from public;
revoke all on function public.claim_operational_session_v1(uuid,text,text) from anon;
grant execute on function public.claim_operational_session_v1(uuid,text,text) to authenticated;

revoke all on function public.transfer_operational_session_v1(uuid,text,text) from public;
revoke all on function public.transfer_operational_session_v1(uuid,text,text) from anon;
grant execute on function public.transfer_operational_session_v1(uuid,text,text) to authenticated;

revoke all on function public.heartbeat_operational_session_v1(uuid,text) from public;
revoke all on function public.heartbeat_operational_session_v1(uuid,text) from anon;
grant execute on function public.heartbeat_operational_session_v1(uuid,text) to authenticated;

revoke all on function public.release_operational_session_v1(uuid,text) from public;
revoke all on function public.release_operational_session_v1(uuid,text) from anon;
grant execute on function public.release_operational_session_v1(uuid,text) to authenticated;
