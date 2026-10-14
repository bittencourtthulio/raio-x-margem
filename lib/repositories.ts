import { PostgresRepository } from './postgres-repository';
import Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DiagnosticRequest, DiagnosticResult } from './contracts';
export const CONSENT_VERSION = '2026-10-14-v1';
export const CONSENT_TEXT = {privacy:'Li o aviso de tratamento dos dados para atender minha solicitação e gerar o diagnóstico.', commercial:'Aceito contato sobre o software de gestão', summary:'Aceito salvar o resumo agregado junto ao meu cadastro'};
export class AppError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export type Limit = { subject: string; kind: string; windowMs: number; max: number };
export const requestHash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
export class LocalRepository {
  db: Database.Database;
  constructor(path: string) {
    if(path !== ':memory:') mkdirSync(dirname(resolve(path)), {recursive:true, mode:0o700});
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON'); this.db.pragma('busy_timeout = 5000');
    this.db.exec(`CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, name TEXT NOT NULL, business_name TEXT NOT NULL, contact TEXT NOT NULL, sector TEXT NOT NULL, role TEXT NOT NULL, current_control TEXT NOT NULL, current_system TEXT, system_difficulty INTEGER NOT NULL, commercial_consent INTEGER NOT NULL, save_summary_consent INTEGER NOT NULL, privacy_acknowledged INTEGER NOT NULL, consent_version TEXT NOT NULL, consent_text TEXT NOT NULL, consent_at INTEGER NOT NULL, qualified INTEGER NOT NULL, commercial_eligible INTEGER NOT NULL, demo INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS diagnostics (id TEXT PRIMARY KEY, lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE, session_hash TEXT NOT NULL, summary_json TEXT, response_json TEXT, source TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS diagnostic_requests (session_hash TEXT NOT NULL, request_key TEXT NOT NULL, body_hash TEXT NOT NULL, diagnostic_id TEXT NOT NULL, status TEXT NOT NULL, response_json TEXT, created_at INTEGER NOT NULL, PRIMARY KEY(session_hash,request_key));
    CREATE TABLE IF NOT EXISTS request_limits (subject TEXT NOT NULL, kind TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(subject,kind,window_start));
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_hash TEXT NOT NULL, event TEXT NOT NULL, demo INTEGER NOT NULL, created_at INTEGER NOT NULL);`);
  }
  private reserveInside(limits: Limit[], now: number) {
    for(const l of limits) {
      const window = Math.floor(now/l.windowMs)*l.windowMs;
      const old = this.db.prepare('SELECT count FROM request_limits WHERE subject=? AND kind=? AND window_start=?').get(l.subject,l.kind,window) as {count:number}|undefined;
      if((old?.count??0)>=l.max) throw new AppError(429,'QUOTA','Limite temporário atingido. Tente novamente na próxima janela.');
      this.db.prepare('INSERT INTO request_limits VALUES (?,?,?,1) ON CONFLICT(subject,kind,window_start) DO UPDATE SET count=count+1').run(l.subject,l.kind,window);
    }
  }
  reserve(limits: Limit[], now = Date.now()) { this.db.transaction(()=>this.reserveInside(limits,now)).immediate(); }
  claim(session: string, body: DiagnosticRequest, limits: Limit[], now=Date.now()): {id:string; replay?:DiagnosticResult} {
    return this.db.transaction(()=>{
      const hash = requestHash(body);
      const existing = this.db.prepare('SELECT * FROM diagnostic_requests WHERE session_hash=? AND request_key=?').get(session,body.idempotencyKey) as {body_hash:string;status:string;response_json:string|null;diagnostic_id:string}|undefined;
      if(existing) {
        if(existing.body_hash!==hash) throw new AppError(409,'IDEMPOTENCY_CONFLICT','Esta chave já foi usada com outros dados.');
        if(existing.status==='pending') throw new AppError(409,'PROCESSING','Este pedido já está em processamento. Aguarde antes de tentar novamente.');
        if(existing.response_json) return {id:existing.diagnostic_id,replay:JSON.parse(existing.response_json)};
        throw new AppError(409,'COMPLETED_NO_REPLAY','O pedido foi concluído sem salvar resumo. Inicie explicitamente outro diagnóstico para gerar novamente.');
      }
      this.reserveInside(limits,now);
      const id=randomUUID(), leadId=randomUUID(), l=body.lead;
      const qualified=l.role!=='employee' && ['retail','food','services'].includes(l.sector) && (['spreadsheet','notebook'].includes(l.currentControl)||l.systemDifficulty);
      const contact=l.contact.includes('@') ? l.contact.toLowerCase() : l.contact.replace(/[^\d+]/g,'');
      this.db.prepare('INSERT INTO leads VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(leadId,session,l.name,l.businessName,contact,l.sector,l.role,l.currentControl,l.currentSystem??null,+l.systemDifficulty,+l.commercialConsent,+l.saveSummaryConsent,+l.privacyAcknowledged,CONSENT_VERSION,JSON.stringify(CONSENT_TEXT),now,+qualified,+(qualified&&l.commercialConsent),+body.demo,now);
      this.db.prepare('INSERT INTO diagnostics VALUES (?,?,?,?,?,?,?,?)').run(id,leadId,session,l.saveSummaryConsent?JSON.stringify({summary:body.summary,scenario:body.scenario}):null,null,null,'pending',now);
      this.db.prepare('INSERT INTO diagnostic_requests VALUES (?,?,?,?,?,?,?)').run(session,body.idempotencyKey,hash,id,'pending',null,now);
      return {id};
    }).immediate();
  }
  finish(session:string, key:string, result:DiagnosticResult, consent:boolean, demo:boolean) {
    this.db.transaction(()=>{
      this.db.prepare('UPDATE diagnostics SET source=?,status=?,response_json=? WHERE id=? AND session_hash=?').run(result.source,'completed',consent?JSON.stringify(result):null,result.id,session);
      this.db.prepare('UPDATE diagnostic_requests SET status=?,response_json=? WHERE session_hash=? AND request_key=?').run('completed',consent?JSON.stringify(result):null,session,key);
      this.eventInside(session,'lead_submitted',demo||result.source==='mock',Date.now());
      this.eventInside(session,'insights_generated',demo||result.source==='mock',Date.now());
    }).immediate();
  }
  private eventInside(session:string,event:string,demo:boolean,now:number){ this.db.prepare('INSERT INTO events VALUES (?,?,?,?,?)').run(randomUUID(),session,event,+demo,now); }
  event(session:string,event:string,demo:boolean,limits:Limit[],now=Date.now()){ this.db.transaction(()=>{this.reserveInside(limits,now);this.eventInside(session,event,demo,now);}).immediate(); }
  cleanup(now=Date.now()) {
    const day=86400000;
    return this.db.transaction(()=>({
      diagnostics:this.db.prepare('DELETE FROM diagnostics WHERE created_at<?').run(now-30*day).changes,
      leads:this.db.prepare('DELETE FROM leads WHERE created_at<?').run(now-90*day).changes,
      events:this.db.prepare('DELETE FROM events WHERE created_at<?').run(now-30*day).changes,
      requests:this.db.prepare('DELETE FROM diagnostic_requests WHERE created_at<?').run(now-2*day).changes,
      limits:this.db.prepare('DELETE FROM request_limits WHERE window_start<?').run(now-2*day).changes,
    })).immediate();
  }
}
let repository:LocalRepository|undefined;
export function getLocalRepository() {
  if(process.env.VERCEL) throw new AppError(503,'CONFIGURATION','Publicação requer adapter Supabase compartilhado; SQLite é exclusivo do piloto local.');
  if((process.env.STORAGE_DRIVER??'sqlite')!=='sqlite') throw new AppError(503,'CONFIGURATION','Use getRepository para acessar o adapter Postgres.');
  repository??=new LocalRepository(process.env.SQLITE_PATH??'.data/pilot.sqlite');
  return repository;
}

let postgresRepository: PostgresRepository | undefined;
export function getRepository() {
  if (process.env.STORAGE_DRIVER === "postgres") return postgresRepository ??= new PostgresRepository();
  return getLocalRepository();
}
