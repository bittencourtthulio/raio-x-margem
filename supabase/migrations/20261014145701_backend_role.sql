-- Server-only role. Firebase sessions and store ownership are checked by the backend.
-- This role cannot create/drop tables, bypass RLS, or use the public Data API.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='rxm_backend') then
  create role rxm_backend nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
 end if;
end $$;
grant usage on schema app_private, integration to rxm_backend;
do $$ declare t record; begin
 for t in select schemaname,tablename from pg_tables
  where schemaname in ('app_private','integration') and tablename <> 'schema_migrations'
 loop
  execute format('grant select,insert,update,delete on %I.%I to rxm_backend',t.schemaname,t.tablename);
  execute format('create policy backend_access on %I.%I for all to rxm_backend using (true) with check (true)',t.schemaname,t.tablename);
 end loop;
end $$;
