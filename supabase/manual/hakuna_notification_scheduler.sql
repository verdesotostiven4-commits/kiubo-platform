-- Run only on the intended Supabase project after deploying catalog-notify with
-- JWT verification disabled (the function validates the worker token itself).
-- pg_cron/pg_net and Vault are Supabase extensions, not a separate paid service.
-- Setup is deliberately separate from the order migration so a preview cannot
-- accidentally schedule requests against production or send real notifications.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.catalog_notification_workers add column if not exists function_url text;

create or replace function public.catalog_dispatch_due_notifications()
returns void language plpgsql security definer set search_path='' as $$
declare worker record;
begin
  for worker in
    select a.slug,w.function_url,v.decrypted_secret
    from public.catalog_notification_workers w
    join public.catalog_accounts a on a.id=w.account_id
    join vault.decrypted_secrets v on v.id=w.vault_secret_id
    where w.function_url is not null and exists (
      select 1 from public.catalog_notification_jobs j where j.account_id=w.account_id
      and j.status<>'sent' and j.available_at<=now()
      and (j.status='pending' or j.locked_until<now())
    )
  loop
    perform net.http_post(url:=worker.function_url,
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker.decrypted_secret),
      body:=jsonb_build_object('action','dispatch','slug',worker.slug),timeout_milliseconds:=10000);
  end loop;
end;
$$;
revoke all on function public.catalog_dispatch_due_notifications() from public,anon,authenticated;

-- Project-specific URL is supplied at setup time; token is generated inside the
-- database and saved only in Vault. Call once for the intended account:
-- select public.catalog_install_notification_worker('hakuna-matata','https://PROJECT.supabase.co');
create or replace function public.catalog_install_notification_worker(p_slug text,p_base_url text)
returns void language plpgsql security definer set search_path='' as $$
declare a uuid; secret text; secret_id uuid;
begin
  if p_base_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then raise exception 'invalid_supabase_url'; end if;
  select id into a from public.catalog_accounts where slug=p_slug for update;
  if a is null then raise exception 'account_not_found'; end if;
  if exists(select 1 from public.catalog_notification_workers where account_id=a) then
    update public.catalog_notification_workers set function_url=p_base_url||'/functions/v1/catalog-notify' where account_id=a;
  else
    secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    secret_id:=vault.create_secret(secret,'catalog-notify-'||a::text,'Internal catalog notification worker');
    insert into public.catalog_notification_workers(account_id,token_hash,vault_secret_id,function_url)
    values(a,encode(sha256(convert_to(secret,'UTF8')),'hex'),secret_id,p_base_url||'/functions/v1/catalog-notify');
  end if;
  if not exists(select 1 from cron.job where jobname='catalog-notification-worker') then
    perform cron.schedule('catalog-notification-worker','* * * * *','select public.catalog_dispatch_due_notifications()');
  end if;
end;
$$;
revoke all on function public.catalog_install_notification_worker(text,text) from public,anon,authenticated,service_role;
