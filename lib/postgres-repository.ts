import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getIntegrationPool, transaction } from './integration/db';
import { AppError, CONSENT_TEXT, CONSENT_VERSION, requestHash, type Limit } from './repositories';
import type { DiagnosticRequest, DiagnosticResult } from './contracts';
import type { Account } from './auth/account-store';

type AccountRow = { id: string; project_id: string; firebase_uid: string; name: string; email: string; profile_json: string | null; status: string };
const account = (r: AccountRow): Account => ({ id: r.id, firebaseProjectId: r.project_id, firebaseUid: r.firebase_uid, name: r.name, email: r.email, profile: r.profile_json ? JSON.parse(r.profile_json) : null, status: r.status });
const qualified = (l: DiagnosticRequest['lead']) => l.role !== 'employee' && ['retail', 'food', 'services'].includes(l.sector) && (['spreadsheet', 'notebook'].includes(l.currentControl) || l.systemDifficulty);
async function reserveInside(c: PoolClient, limits: Limit[], now: number) {
  // Stable ordering avoids deadlocks between requests reserving overlapping quotas.
  for (const l of [...limits].sort((a, b) => `${a.subject}:${a.kind}`.localeCompare(`${b.subject}:${b.kind}`))) {
    const r = await c.query(`insert into app_private.request_limits values ($1,$2,$3,1)
      on conflict(subject,kind,window_start) do update set count=request_limits.count+1
      where request_limits.count < $4 returning count`, [l.subject, l.kind, Math.floor(now / l.windowMs) * l.windowMs, l.max]);
    if (!r.rowCount) throw new AppError(429, 'QUOTA', 'Limite temporário atingido. Tente novamente na próxima janela.');
  }
}
async function insertLead(c: PoolClient, id: string, session: string, l: DiagnosticRequest['lead'], demo: boolean, now: number, version = CONSENT_VERSION, text: object = CONSENT_TEXT) {
  const contact = l.contact.includes('@') ? l.contact.toLowerCase() : l.contact.replace(/[^\d+]/g, '');
  const q = qualified(l);
  await c.query(`insert into app_private.leads values (${Array.from({length:20}, (_,i) => `$${i+1}`).join(',')})`, [id, session, l.name, l.businessName, contact, l.sector, l.role, l.currentControl, l.currentSystem ?? null, +l.systemDifficulty, +l.commercialConsent, +l.saveSummaryConsent, +l.privacyAcknowledged, version, JSON.stringify(text), now, +q, +(q && l.commercialConsent), +demo, now]);
}
async function eventInside(c: PoolClient, session: string, event: string, demo: boolean, now: number) {
  await c.query('insert into app_private.events values ($1,$2,$3,$4,$5)', [randomUUID(), session, event, +demo, now]);
}
export class PostgresRepository {
  async reserve(limits: Limit[], now = Date.now()) { await transaction(c => reserveInside(c, limits, now)); }
  async claim(session: string, body: DiagnosticRequest, limits: Limit[], now = Date.now()): Promise<{id: string; replay?: DiagnosticResult}> {
    return transaction(async c => {
      await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify(['diagnostic', session, body.idempotencyKey])]);
      const hash = requestHash(body);
      const existing = (await c.query('select * from app_private.diagnostic_requests where session_hash=$1 and request_key=$2', [session, body.idempotencyKey])).rows[0];
      if (existing) {
        if (existing.body_hash !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave já foi usada com outros dados.');
        if (existing.status === 'pending') throw new AppError(409, 'PROCESSING', 'Este pedido já está em processamento.');
        if (existing.response_json) return {id: existing.diagnostic_id, replay: JSON.parse(existing.response_json)};
        throw new AppError(409, 'COMPLETED_NO_REPLAY', 'O pedido foi concluído sem salvar resumo. Inicie explicitamente outro diagnóstico.');
      }
      await reserveInside(c, limits, now);
      const id = randomUUID(), leadId = randomUUID();
      await insertLead(c, leadId, session, body.lead, body.demo, now);
      await c.query('insert into app_private.diagnostics values ($1,$2,$3,$4,null,null,$5,$6)', [id, leadId, session, body.lead.saveSummaryConsent ? JSON.stringify({summary: body.summary, scenario: body.scenario}) : null, 'pending', now]);
      await c.query('insert into app_private.diagnostic_requests values ($1,$2,$3,$4,$5,null,$6)', [session, body.idempotencyKey, hash, id, 'pending', now]);
      return {id};
    });
  }
  async finish(session: string, key: string, result: DiagnosticResult, consent: boolean, demo: boolean) {
    await transaction(async c => {
      const payload = consent ? JSON.stringify(result) : null;
      await c.query("update app_private.diagnostics set source=$1,status='completed',response_json=$2 where id=$3 and session_hash=$4", [result.source, payload, result.id, session]);
      await c.query("update app_private.diagnostic_requests set status='completed',response_json=$1 where session_hash=$2 and request_key=$3", [payload, session, key]);
      await eventInside(c, session, 'lead_submitted', demo || result.source === 'mock', Date.now());
      await eventInside(c, session, 'insights_generated', demo || result.source === 'mock', Date.now());
    });
  }
  async event(session: string, event: string, demo: boolean, limits: Limit[], now = Date.now()) {
    await transaction(async c => { await reserveInside(c, limits, now); await eventInside(c, session, event, demo, now); });
  }
  async cleanup(now = Date.now()) {
    return transaction(async c => {
      const counts: Record<string, number> = {};
      for (const [key, table, column, days] of [['diagnostics','diagnostics','created_at',30],['leads','leads','created_at',90],['events','events','created_at',30],['requests','diagnostic_requests','created_at',2],['limits','request_limits','window_start',2]] as const) {
        counts[key] = (await c.query(`delete from app_private.${table} where ${column} < $1`, [now - days * 86400000])).rowCount ?? 0;
      }
      return counts;
    });
  }
  async findAccount(project: string, uid: string) {
    const row = (await getIntegrationPool().query('select * from app_private.accounts where project_id=$1 and firebase_uid=$2', [project, uid])).rows[0];
    return row ? account(row) : null;
  }
  async upsertAccount(project: string, uid: string, name: string, email: string) {
    const row = (await getIntegrationPool().query(`insert into app_private.accounts (id,project_id,firebase_uid,name,email,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$6)
      on conflict(project_id,firebase_uid) do update set email=excluded.email,updated_at=excluded.updated_at returning *`, [randomUUID(), project, uid, name, email, Date.now()])).rows[0];
    if (row.status !== 'active') throw new AppError(403, 'ACCOUNT_BLOCKED', 'Esta conta não está disponível.');
    return account(row);
  }
  async completeAccount(current: Account, profile: DiagnosticRequest['lead']) {
    return transaction(async c => {
      const row = (await c.query('select * from app_private.accounts where id=$1 and project_id=$2 and firebase_uid=$3 for update', [current.id, current.firebaseProjectId, current.firebaseUid])).rows[0];
      if (!row || row.status !== 'active') throw new AppError(403, 'ACCOUNT_BLOCKED', 'Esta conta não está disponível.');
      if (row.profile_json) return account(row);
      const now = Date.now(), leadId = randomUUID();
      const safe = {...profile, contact: row.email, saveSummaryConsent: false};
      const text = {privacy:'Li o aviso de tratamento dos dados para criar minha conta e acessar a ferramenta.', commercial:CONSENT_TEXT.commercial, summary:'Não autorizei salvar o resumo na criação da conta.'};
      await insertLead(c, leadId, `account:${current.id}`, safe, false, now, '2026-10-14-account-v1', text);
      await c.query('insert into app_private.account_leads values ($1,$2)', [current.id, leadId]);
      for (const [purpose, value, label] of [['privacy',1,text.privacy],['commercial',+safe.commercialConsent,text.commercial]]) {
        await c.query('insert into app_private.account_consents values ($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), current.id, purpose, value, '2026-10-14-account-v1', label, now]);
      }
      const updated = (await c.query('update app_private.accounts set name=$1,profile_json=$2,updated_at=$3 where id=$4 returning *', [safe.name, JSON.stringify(safe), now, current.id])).rows[0];
      return account(updated);
    });
  }
}
