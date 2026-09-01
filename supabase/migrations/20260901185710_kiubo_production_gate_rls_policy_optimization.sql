-- KIUBO Production Gate · RLS policy optimization.
-- Applied to production as migration 20260901185710.

drop index if exists public.catalog_accounts_tenant_idx;

drop policy if exists subscriptions_platform_manage on public.subscriptions;
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
for select to authenticated
using (public.is_platform_admin() or public.has_tenant_access(tenant_id));
create policy subscriptions_platform_insert on public.subscriptions
for insert to authenticated
with check (public.is_platform_admin());
create policy subscriptions_platform_update on public.subscriptions
for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy subscriptions_platform_delete on public.subscriptions
for delete to authenticated
using (public.is_platform_admin());

drop policy if exists overrides_platform_manage on public.tenant_feature_overrides;
drop policy if exists overrides_read on public.tenant_feature_overrides;
create policy overrides_read on public.tenant_feature_overrides
for select to authenticated
using (public.is_platform_admin() or public.has_tenant_access(tenant_id));
create policy overrides_platform_insert on public.tenant_feature_overrides
for insert to authenticated
with check (public.is_platform_admin());
create policy overrides_platform_update on public.tenant_feature_overrides
for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy overrides_platform_delete on public.tenant_feature_overrides
for delete to authenticated
using (public.is_platform_admin());

drop policy if exists branding_manage on public.tenant_branding;
drop policy if exists branding_read on public.tenant_branding;
create policy branding_read on public.tenant_branding
for select to authenticated
using (public.is_platform_admin() or public.has_tenant_access(tenant_id));
create policy branding_insert on public.tenant_branding
for insert to authenticated
with check (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'branding'));
create policy branding_update on public.tenant_branding
for update to authenticated
using (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'branding'))
with check (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'branding'));
create policy branding_delete on public.tenant_branding
for delete to authenticated
using (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']) and public.tenant_feature_enabled(tenant_id,'branding'));

drop policy if exists settings_manage on public.tenant_settings;
drop policy if exists settings_read on public.tenant_settings;
create policy settings_read on public.tenant_settings
for select to authenticated
using (public.is_platform_admin() or public.has_tenant_access(tenant_id));
create policy settings_insert on public.tenant_settings
for insert to authenticated
with check (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']));
create policy settings_update on public.tenant_settings
for update to authenticated
using (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']))
with check (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']));
create policy settings_delete on public.tenant_settings
for delete to authenticated
using (public.tenant_can_operate(tenant_id) and public.has_tenant_role(tenant_id,array['owner','admin']));

drop policy if exists member_branches_manage on public.tenant_member_branches;
drop policy if exists member_branches_select on public.tenant_member_branches;
create policy member_branches_select on public.tenant_member_branches
for select to authenticated
using (public.is_platform_admin() or exists (
  select 1 from public.tenant_members tm
  where tm.id=tenant_member_branches.tenant_member_id
    and (tm.user_id=(select auth.uid()) or public.has_tenant_role(tm.tenant_id,array['owner','admin']))
));
create policy member_branches_insert on public.tenant_member_branches
for insert to authenticated
with check (exists (
  select 1 from public.tenant_members tm
  where tm.id=tenant_member_branches.tenant_member_id
    and public.has_tenant_role(tm.tenant_id,array['owner','admin'])
    and public.branch_belongs_to_tenant(tm.tenant_id,tenant_member_branches.branch_id)
));
create policy member_branches_update on public.tenant_member_branches
for update to authenticated
using (exists (
  select 1 from public.tenant_members tm
  where tm.id=tenant_member_branches.tenant_member_id
    and public.has_tenant_role(tm.tenant_id,array['owner','admin'])
))
with check (exists (
  select 1 from public.tenant_members tm
  where tm.id=tenant_member_branches.tenant_member_id
    and public.has_tenant_role(tm.tenant_id,array['owner','admin'])
    and public.branch_belongs_to_tenant(tm.tenant_id,tenant_member_branches.branch_id)
));
create policy member_branches_delete on public.tenant_member_branches
for delete to authenticated
using (exists (
  select 1 from public.tenant_members tm
  where tm.id=tenant_member_branches.tenant_member_id
    and public.has_tenant_role(tm.tenant_id,array['owner','admin'])
));
