-- KIUBO Cloud v1 · provision tenant owner by email without Edge Functions
-- Requires 0001-0005.

create or replace function public.platform_provision_tenant_by_email(
  p_owner_email text,
  p_display_name text,
  p_slug text,
  p_plan_code text default 'start'
)
returns table(tenant_id uuid,branch_id uuid)
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text:=lower(trim(coalesce(p_owner_email,'')));
  v_user uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'platform admin required';
  end if;
  if v_email='' or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid owner email';
  end if;

  select u.id into v_user
  from auth.users u
  where lower(u.email)=v_email
  order by u.created_at asc
  limit 1;

  if v_user is null then raise exception 'owner auth user not found'; end if;

  return query
  select p.tenant_id,p.branch_id
  from public.platform_provision_tenant(v_user,p_display_name,p_slug,p_plan_code) p;
end
$$;

revoke all on function public.platform_provision_tenant_by_email(text,text,text,text) from public;
grant execute on function public.platform_provision_tenant_by_email(text,text,text,text) to authenticated;
