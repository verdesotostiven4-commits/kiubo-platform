begin;

-- Authenticated clients use selected RPCs, but anonymous callers should never
-- execute KIUBO database functions directly.
revoke execute on all functions in schema public from anon;

-- Trigger helpers are internal implementation details, not public RPCs.
revoke execute on function public.guard_last_active_owner() from public, anon, authenticated;
revoke execute on function public.guard_member_branch_scope() from public, anon, authenticated;
revoke execute on function public.guard_tenant_member_write() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- New functions should not silently become executable by PUBLIC.
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- Cover foreign keys used by tenant lookup/sync paths before client volume grows.
create index if not exists subscriptions_plan_code_idx on public.subscriptions(plan_code);
create index if not exists sync_entities_branch_id_idx on public.sync_entities(branch_id);
create index if not exists tenant_member_branches_branch_id_idx on public.tenant_member_branches(branch_id);
create index if not exists tenant_members_user_id_idx on public.tenant_members(user_id);

commit;
