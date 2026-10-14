-- Private, backend-only integration storage. No Data API grants or public policies.
create schema if not exists integration;
revoke all on schema integration from public;
create table integration.organizations (id uuid primary key, name text not null, created_at timestamptz not null default now());
create table integration.stores (id uuid primary key, organization_id uuid not null references integration.organizations(id) on delete cascade, name text not null, environment text not null check(environment in ('sandbox','production')), revision bigint not null default 0 check(revision >= 0), feed_floor bigint not null default 0, disconnected_at timestamptz, created_at timestamptz not null default now());
create table integration.memberships (organization_id uuid not null references integration.organizations(id) on delete cascade, user_id text not null, role text not null check(role in ('owner','viewer')), primary key(organization_id,user_id));
create index memberships_user on integration.memberships(user_id,organization_id);
create table integration.sources (id uuid primary key, store_id uuid not null references integration.stores(id) on delete cascade, name text not null, active boolean not null default true, notice_version text not null, authorized_by text not null, purpose text not null default 'Armazenar catálogo e calcular análises de margem para a integração autorizada.', authorized_at timestamptz not null default now(), unique(store_id,id));
create unique index one_active_source on integration.sources(store_id) where active;
create table integration.credentials (id uuid primary key, store_id uuid not null, source_id uuid not null, token_hash text not null unique, prefix text not null, label text not null, scopes text[] not null, expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(), foreign key(store_id,source_id) references integration.sources(store_id,id) on delete cascade);
create index credentials_store on integration.credentials(store_id,source_id);
create table integration.products (id uuid primary key, store_id uuid not null, source_id uuid not null, external_id text not null collate "C", source_version bigint not null check(source_version between 1 and 9007199254740991), revision bigint not null, active boolean not null, barcode text, input jsonb not null, data jsonb not null, unique(store_id,id), unique(store_id,source_id,external_id), foreign key(store_id,source_id) references integration.sources(store_id,id) on delete cascade);
create index products_store_active on integration.products(store_id,active,id);
create index products_barcode on integration.products(store_id,barcode) where barcode is not null;
create table integration.changes (store_id uuid not null references integration.stores(id) on delete cascade, revision bigint not null, data jsonb not null, created_at timestamptz not null default now(), primary key(store_id,revision));
create index changes_retention on integration.changes(created_at);
create table integration.snapshots (id uuid primary key, store_id uuid not null references integration.stores(id) on delete cascade, revision bigint not null, data jsonb not null, expires_at timestamptz not null);
create index snapshots_store on integration.snapshots(store_id);
create table integration.cursors (token_hash text primary key, store_id uuid not null references integration.stores(id) on delete cascade, environment text not null, kind text not null, data jsonb not null, expires_at timestamptz not null);
create index cursors_store on integration.cursors(store_id);
create index cursors_expiry on integration.cursors(expires_at);
create table integration.analyses (id uuid primary key, store_id uuid not null references integration.stores(id) on delete cascade, source_id uuid not null, status text not null check(status in ('queued','running','completed','failed')), scenario jsonb not null, catalog_revision bigint not null, calculation_version text not null, snapshot jsonb not null, summary jsonb, items jsonb, error text, created_at timestamptz not null default now(), completed_at timestamptz, unique(store_id,id), foreign key(store_id,source_id) references integration.sources(store_id,id) on delete cascade);
create index analyses_store_order on integration.analyses(store_id,created_at,id);
create table integration.jobs (id uuid primary key, store_id uuid not null, analysis_id uuid not null unique, status text not null check(status in ('queued','running','completed','failed')), attempts integer not null default 0, available_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz, created_at timestamptz not null default now(), completed_at timestamptz, foreign key(store_id,analysis_id) references integration.analyses(store_id,id) on delete cascade);
create index jobs_claim on integration.jobs(available_at,created_at) where status in ('queued','running');
create table integration.idempotency (store_id uuid not null, source_id uuid not null, operation text not null, key text not null, body_hash text not null, response jsonb not null, expires_at timestamptz not null default now()+interval '7 days', primary key(store_id,source_id,operation,key), foreign key(store_id,source_id) references integration.sources(store_id,id) on delete cascade);
create table integration.limits (store_id uuid not null references integration.stores(id) on delete cascade, bucket text not null, window_start timestamptz not null, count integer not null, primary key(store_id,bucket,window_start));
create table integration.audit (id uuid primary key, store_id uuid not null references integration.stores(id) on delete cascade, actor_id text not null, action text not null, resource_id text, created_at timestamptz not null default now());
create index audit_store on integration.audit(store_id,created_at);
-- Private schema: owner backend connection only. RLS is defense in depth; no client policies.
do $$ declare t record; r text; begin
  for t in select tablename from pg_tables where schemaname='integration' loop
    execute format('alter table integration.%I enable row level security',t.tablename);
    execute format('revoke all on table integration.%I from public',t.tablename);
  end loop;
  foreach r in array array['anon','authenticated'] loop
    if exists(select 1 from pg_roles where rolname=r) then
      execute format('revoke all on schema integration from %I',r);
      execute format('revoke all on all tables in schema integration from %I',r);
    end if;
  end loop;
end $$;
