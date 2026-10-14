-- CLI execution does not preserve SET LOCAL between individual SQL statements.
-- Move any tables created by that path into the backend-only schema before use.
do $$ declare n text; r text; begin
 foreach n in array array['leads','diagnostics','diagnostic_requests','request_limits','events','accounts','account_leads','account_consents'] loop
  if to_regclass('app_private.' || n) is null and to_regclass('public.' || n) is not null then
   execute format('alter table public.%I set schema app_private',n);
  end if;
  execute format('alter table app_private.%I enable row level security',n);
  execute format('revoke all on app_private.%I from public',n);
  foreach r in array array['anon','authenticated'] loop
   if exists(select 1 from pg_roles where rolname=r) then
    execute format('revoke all on app_private.%I from %I',n,r);
   end if;
  end loop;
  execute format('grant select,insert,update,delete on app_private.%I to rxm_backend',n);
  execute format('drop policy if exists backend_access on app_private.%I',n);
  execute format('create policy backend_access on app_private.%I for all to rxm_backend using (true) with check (true)',n);
 end loop;
end $$;
