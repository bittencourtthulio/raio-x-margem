import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { upsertAccount, completeAccount, findAccount } from '../lib/auth/account-store';
import { verifyCsrf, serializeCookie, safeDestination } from '../lib/auth/server';
import { getLocalRepository } from '../lib/repositories';

test('cadastro persiste um único lead, email verificado e consentimentos separados', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'raiox-account-'));
  const old = process.env.SQLITE_PATH; process.env.SQLITE_PATH = join(dir, 'test.db');
  try {
    const account = await upsertAccount('demo-unit', 'uid-a', 'Pessoa', 'verified@example.com');
    assert.equal(account.profile, null);
    const profile = { name: 'Pessoa', businessName: 'Loja', contact: 'untrusted@example.com', sector: 'retail' as const, role: 'owner' as const, currentControl: 'spreadsheet' as const, systemDifficulty: false, commercialConsent: false, saveSummaryConsent: true, privacyAcknowledged: true };
    const completed = await completeAccount(account, profile);
    assert.equal(completed.profile?.contact, 'verified@example.com');
    assert.equal(completed.profile?.saveSummaryConsent, false);
    await completeAccount(account, { ...profile, commercialConsent: true });
    const db = getLocalRepository().db;
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM leads').get() as { n: number }).n, 1);
    assert.deepEqual(db.prepare('SELECT contact, commercial_consent, save_summary_consent FROM leads').get(), { contact: 'verified@example.com', commercial_consent: 0, save_summary_consent: 0 });
    assert.deepEqual(db.prepare('SELECT purpose,value FROM account_consents ORDER BY purpose').all(), [{ purpose: 'commercial', value: 0 }, { purpose: 'privacy', value: 1 }]);
    assert.equal((await upsertAccount('demo-unit', 'uid-a', 'Pessoa', 'verified@example.com')).id, account.id);
    assert.notEqual((await upsertAccount('other-project', 'uid-a', 'Pessoa', 'verified@example.com')).id, account.id);
    db.prepare("UPDATE accounts SET status='blocked' WHERE id=?").run(account.id);
    await assert.rejects(() => completeAccount(account, profile), /conta/);
    await assert.rejects(() => upsertAccount('demo-unit', 'uid-a', 'Pessoa', 'verified@example.com'), /conta/);
    assert.equal((await findAccount('demo-unit', 'uid-a'))?.status, 'blocked');
    db.close();
  } finally { if (old === undefined) delete process.env.SQLITE_PATH; else process.env.SQLITE_PATH = old; rmSync(dir, { recursive: true, force: true }); }
});

test('CSRF recusa origem e tokens inválidos; cookie de HTTPS é protegido', () => {
  const token = 'a'.repeat(64);
  const request = (origin: string, header: string) => new Request('https://example.com/api/auth/session', { headers: { Origin: origin, Cookie: `rxm_csrf=${token}`, 'X-CSRF-Token': header } });
  assert.doesNotThrow(() => verifyCsrf(request('https://example.com', token)));
  assert.throws(() => verifyCsrf(request('https://attacker.example', token)), /Origem/);
  assert.throws(() => verifyCsrf(request('https://example.com', 'b'.repeat(64))), /Recarregue/);
  assert.throws(() => verifyCsrf(request('https://example.com', 'é'.repeat(64))), /Recarregue/);
  const cookie = serializeCookie('rxm_auth', 'session', 100, request('https://example.com', token));
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=100; Secure/);
  assert.equal(safeDestination('https://attacker.example'), '/app');
  assert.equal(safeDestination('demo'), '/app?modo=demo');
});
