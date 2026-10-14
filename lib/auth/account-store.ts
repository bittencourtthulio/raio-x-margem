import { PostgresRepository } from '../postgres-repository';
import { randomUUID } from 'node:crypto';
import { getLocalRepository, AppError } from '../repositories';
import type { DiagnosticRequest } from '../contracts';

export type Account = { id: string; firebaseProjectId: string; firebaseUid: string; name: string; email: string; profile: DiagnosticRequest['lead'] | null; status: string };
type AccountRow = { id: string; project_id: string; firebase_uid: string; name: string; email: string; profile_json: string | null; status: string };
function database() {
  const db = getLocalRepository().db;
  db.exec(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, firebase_uid TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, profile_json TEXT, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(project_id,firebase_uid));
    CREATE TABLE IF NOT EXISTS account_leads (account_id TEXT PRIMARY KEY REFERENCES accounts(id), lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS account_consents (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), purpose TEXT NOT NULL, value INTEGER NOT NULL, version TEXT NOT NULL, text TEXT NOT NULL, recorded_at INTEGER NOT NULL);`);
  return db;
}
function account(row: AccountRow): Account { return { id: row.id, firebaseProjectId: row.project_id, firebaseUid: row.firebase_uid, name: row.name, email: row.email, profile: row.profile_json ? JSON.parse(row.profile_json) : null, status: row.status }; }
function findLocalAccount(project: string, uid: string) {
  const row = database().prepare('SELECT * FROM accounts WHERE project_id=? AND firebase_uid=?').get(project, uid) as AccountRow | undefined;
  return row ? account(row) : null;
}
function upsertLocalAccount(project: string, uid: string, name: string, email: string) {
  database().prepare(`INSERT INTO accounts (id,project_id,firebase_uid,name,email,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(project_id,firebase_uid) DO UPDATE SET email=excluded.email,updated_at=excluded.updated_at`).run(randomUUID(), project, uid, name, email, Date.now(), Date.now());
  const result = findLocalAccount(project, uid)!;
  if (result.status !== 'active') throw new AppError(403, 'ACCOUNT_BLOCKED', 'Esta conta não está disponível.');
  return result;
}
function completeLocalAccount(current: Account, profile: DiagnosticRequest['lead']) {
  const db = database(), now = Date.now();
  return db.transaction(() => {
    const existing = findLocalAccount(current.firebaseProjectId, current.firebaseUid);
    if (!existing || existing.status !== 'active') throw new AppError(403, 'ACCOUNT_BLOCKED', 'Esta conta não está disponível.');
    if (existing.profile) return existing;
    const leadId = randomUUID();
    const qualified = profile.role !== 'employee' && ['retail','food','services'].includes(profile.sector) && (['spreadsheet','notebook'].includes(profile.currentControl) || profile.systemDifficulty);
    const consentText = { privacy: 'Li o aviso de tratamento dos dados para criar minha conta e acessar a ferramenta.', commercial: 'Aceito contato sobre o software de gestão', summary: 'Não autorizei salvar o resumo na criação da conta.' };
    db.prepare('INSERT INTO leads VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(leadId, `account:${current.id}`, profile.name, profile.businessName, current.email, profile.sector, profile.role, profile.currentControl, profile.currentSystem ?? null, +profile.systemDifficulty, +profile.commercialConsent, 0, 1, '2026-10-14-account-v1', JSON.stringify(consentText), now, +qualified, +(qualified && profile.commercialConsent), 0, now);
    db.prepare('INSERT INTO account_leads VALUES (?,?)').run(current.id, leadId);
    for (const [purpose, value, text] of [['privacy', 1, consentText.privacy], ['commercial', +profile.commercialConsent, consentText.commercial]] as const) db.prepare('INSERT INTO account_consents VALUES (?,?,?,?,?,?,?)').run(randomUUID(), current.id, purpose, value, '2026-10-14-account-v1', text, now);
    db.prepare('UPDATE accounts SET name=?,profile_json=?,updated_at=? WHERE id=?').run(profile.name, JSON.stringify({ ...profile, contact: current.email, saveSummaryConsent: false }), now, current.id);
    return findLocalAccount(current.firebaseProjectId, current.firebaseUid)!;
  }).immediate();
}

const postgres = new PostgresRepository();
export async function findAccount(project: string, uid: string) {
  return process.env.STORAGE_DRIVER === 'postgres' ? postgres.findAccount(project, uid) : findLocalAccount(project, uid);
}
export async function upsertAccount(project: string, uid: string, name: string, email: string) {
  return process.env.STORAGE_DRIVER === 'postgres' ? postgres.upsertAccount(project, uid, name, email) : upsertLocalAccount(project, uid, name, email);
}
export async function completeAccount(current: Account, profile: DiagnosticRequest['lead']) {
  return process.env.STORAGE_DRIVER === 'postgres' ? postgres.completeAccount(current, profile) : completeLocalAccount(current, profile);
}
