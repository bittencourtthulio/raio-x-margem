create schema if not exists app_private;
revoke all on schema app_private from public;
set local search_path = app_private;
CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, name TEXT NOT NULL, business_name TEXT NOT NULL, contact TEXT NOT NULL, sector TEXT NOT NULL, role TEXT NOT NULL, current_control TEXT NOT NULL, current_system TEXT, system_difficulty BIGINT NOT NULL, commercial_consent BIGINT NOT NULL, save_summary_consent BIGINT NOT NULL, privacy_acknowledged BIGINT NOT NULL, consent_version TEXT NOT NULL, consent_text TEXT NOT NULL, consent_at BIGINT NOT NULL, qualified BIGINT NOT NULL, commercial_eligible BIGINT NOT NULL, demo BIGINT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS diagnostics (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE, session_hash TEXT NOT NULL, summary_json TEXT, response_json TEXT, source TEXT, status TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS diagnostic_requests (session_hash TEXT NOT NULL, request_key TEXT NOT NULL, body_hash TEXT NOT NULL, diagnostic_id TEXT NOT NULL, status TEXT NOT NULL, response_json TEXT, created_at BIGINT NOT NULL, PRIMARY KEY(session_hash,request_key));
CREATE TABLE IF NOT EXISTS request_limits (subject TEXT NOT NULL, kind TEXT NOT NULL, window_start BIGINT NOT NULL, count BIGINT NOT NULL, PRIMARY KEY(subject,kind,window_start));
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, event TEXT NOT NULL, demo BIGINT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, firebase_uid TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, profile_json TEXT, status TEXT NOT NULL DEFAULT 'active', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, UNIQUE(project_id,firebase_uid));
CREATE TABLE IF NOT EXISTS account_leads (account_id TEXT PRIMARY KEY REFERENCES accounts(id), lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS account_consents (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), purpose TEXT NOT NULL, value BIGINT NOT NULL, version TEXT NOT NULL, text TEXT NOT NULL, recorded_at BIGINT NOT NULL);

create index leads_retention on leads(created_at);
create index diagnostics_retention on diagnostics(created_at);
create index diagnostics_lead on diagnostics(lead_id);
create index events_retention on events(created_at);
create index requests_retention on diagnostic_requests(created_at);
create index limits_retention on request_limits(window_start);
create index account_leads_lead on account_leads(lead_id);
create index account_consents_account on account_consents(account_id);
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='app_private' loop
  execute format('alter table app_private.%I enable row level security', t.tablename);
 end loop;
end $$;
revoke all on all tables in schema app_private from public;
reset search_path;

do $$ declare r text; begin
 foreach r in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=r) then
   execute format('revoke all on schema app_private from %I',r);
   execute format('revoke all on all tables in schema app_private from %I',r);
  end if;
 end loop;
end $$;
