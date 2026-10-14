import { expect, type Page } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { randomUUID } from 'node:crypto';

export async function authenticatedPost(page: Page, path: string, data: unknown = {}) {
  const csrf = await page.request.get('/api/auth/csrf');
  expect(csrf.ok()).toBeTruthy();
  return page.request.post(path, { headers: { Origin: 'http://127.0.0.1:3100', 'X-CSRF-Token': (await csrf.json()).token }, data });
}
export async function loginIdentity(page: Page, verified = true) {
  // Tests can only create identities in the local emulator, never in the pilot project.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local auth emulator required');
  const app = getApps().find(a => a.name === 'e2e') ?? initializeApp({ projectId: 'demo-raiox' }, 'e2e');
  const auth = getAuth(app), uid = `e2e-${randomUUID()}`;
  await auth.createUser({ uid, email: `${uid}@example.com`, emailVerified: verified, displayName: 'Pessoa Teste' });
  const exchange = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await auth.createCustomToken(uid), returnSecureToken: true }) });
  expect(exchange.ok).toBeTruthy();
  const response = await authenticatedPost(page, '/api/auth/session', { idToken: (await exchange.json()).idToken });
  return { response, auth, uid };
}
export async function loginCompleteAccount(page: Page, { dismissTutorial = true } = {}) {
  const identity = await loginIdentity(page);
  expect(identity.response.status()).toBe(200);
  const response = await authenticatedPost(page, '/api/auth/profile', { name: 'Pessoa Teste', businessName: 'Loja Teste', contact: `${identity.uid}@example.com`, sector: 'retail', role: 'owner', currentControl: 'spreadsheet', systemDifficulty: false, commercialConsent: false, saveSummaryConsent: false, privacyAcknowledged: true });
  expect(response.status()).toBe(200);
  if (dismissTutorial) {
    await page.goto('/app');
    await expect(page.getByRole('dialog', { name: 'Seu primeiro Raio-X.' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar para a ferramenta' }).click();
    await expect(page.locator('video')).toHaveCount(0);
  }
  return identity;
}
