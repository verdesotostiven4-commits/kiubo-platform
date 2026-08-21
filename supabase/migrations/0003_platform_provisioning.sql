-- KIUBO Cloud v1 · secure platform provisioning helpers
-- Apply after 0001_core_multitenant.sql and 0002_sync_substrate.sql.

create or replace function public.platform_provision_tenant(p_owner_user uuid,p_display_name text,p_slug text,p_plan_code text default 'start')
returns table(tenant_id uuid,branch_id uuid) language plpgsql security definer set search_path=public,auth as $$
declare v_tenant uuid;v_branch uuid;v_name text:=trim(coalesce(p_display_name,''));v_slug text:=lower(trim(coalesce(p_slug,'')));
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'platform admin required'; end if;
  if v_name='' then raise exception 'display name required'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,62}$' then raise exception 'invalid slug'; end if;
  if p_plan_code not in('start','pro','custom') then raise exception 'invalid plan'; end if;
  if not exists(select 1 from auth.users where id=p_owner_user) then raise exception 'owner auth user not found'; end if;
  if exists(select 1 from public.tenant_members where user_id=p_owner_user and active) then raise exception 'owner already belongs to a tenant'; end if;
  insert into public.tenants(slug,display_name) values(v_slug,v_name) returning id into v_tenant;
  insert into public.branches(tenant_id,name,code) values(v_tenant,'Matriz','001') returning id into v_branch;
  insert into public.tenant_members(tenant_id,user_id,role) values(v_tenant,p_owner_user,'owner');
  insert into public.tenant_settings(tenant_id,trade_name) values(v_tenant,v_name);
  insert into public.tenant_branding(tenant_id,business_name) values(v_tenant,v_name);
  insert into public.subscriptions(tenant_id,plan_code,status,trial_ends_at) values(v_tenant,p_plan_code,'trial',now()+interval '14 days');
  return query select v_tenant,v_branch;
end$$;
revoke all on function public.platform_provision_tenant(uuid,text,text,text) from public;grant execute on function public.platform_provision_tenant(uuid,text,text,text) to authenticated;

create or replace function public.can_manage_tenant_users(p_tenant uuid) returns boolean language sql stable security definer set search_path=public as $$select public.is_platform_admin() or public.has_tenant_role(p_tenant,array['owner','admin'])$$;
revoke all on function public.can_manage_tenant_users(uuid) from public;grant execute on function public.can_manage_tenant_users(uuid) to authenticated;

create or replace function public.platform_set_tenant_plan(p_tenant uuid,p_plan_code text) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'platform admin required';end if;
  if p_plan_code not in('start','pro','custom') then raise exception 'invalid plan';end if;
  update public.subscriptions set plan_code=p_plan_code,updated_at=now() where tenant_id=p_tenant and status in('trial','active','grace','suspended');
  if not found then raise exception 'active subscription not found';end if;
end$$;
revoke all on function public.platform_set_tenant_plan(uuid,text) from public;grant execute on function public.platform_set_tenant_plan(uuid,text) to authenticated;

create or replace function public.platform_set_tenant_status(p_tenant uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'platform admin required';end if;
  if p_status not in('trial','active','grace','suspended','cancelled') then raise exception 'invalid status';end if;
  update public.tenants set status=p_status,updated_at=now() where id=p_tenant;if not found then raise exception 'tenant not found';end if;
  update public.subscriptions set status=p_status,suspended_at=case when p_status='suspended' then now() else null end,updated_at=now() where tenant_id=p_tenant and status in('trial','active','grace','suspended');
end$$;
revoke all on function public.platform_set_tenant_status(uuid,text) from public;grant execute on function public.platform_set_tenant_status(uuid,text) to authenticated;
