import { expect, test } from '@playwright/test';
import { loginIdentity } from './auth-helpers';

for (const width of [1440, 390]) {
  test(`API documentation works without login at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs/api');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu catálogo.');
    await page.getByRole('searchbox').fill('sourceVersion');
    await expect(page.getByRole('navigation', { name: 'Documentação da API' }).getByRole('link').first()).toBeVisible();
    await page.getByRole('searchbox').fill('no-such-operation-12345');
    await expect(page.getByRole('status')).toHaveText('Nenhum resultado. Tente um campo ou caminho.');
    await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tema claro', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const spec = await page.request.get('/openapi.json');
    expect(spec.status()).toBe(200);
    expect((await spec.json()).openapi).toBe('3.1.1');
  });
}

test('integration administration requires a human session', async ({ page }) => {
  await page.goto('/app/integracoes');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('verified owner authorizes the source and sees a credential only in memory', async ({ page }) => {
  const identity = await loginIdentity(page);
  expect(identity.response.status()).toBe(200);
  const store = { id: '43e72cd3-50a7-4efe-ab9b-0bc73bfe8d44', name: 'Loja de teste', role: 'owner', environment: 'sandbox' };
  const noticeVersion = '2026-10-14-integration-v1';
  const sources: { id: string; name: string; active: boolean }[] = [];
  const credentials: object[] = [];
  const mutations: Record<string, unknown>[] = [];
  const secret = 'rx_sandbox_fictional_key_only_for_browser_test';
  await page.route('**/api/integration*', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      mutations.push(body);
      if (body.action === 'createSource') sources.push({ id: 'ad5b955e-e1e7-433b-a2b8-d0257e219888', name: body.name, active: true });
      if (body.action === 'issueCredential') {
        const credential = { id: '832f3c87-e66e-4010-8fcf-56909ccb594f', prefix: 'rx_sandbox_fictional', scopes: body.scopes, expiresAt: '2099-01-01T00:00:00Z', createdAt: '2026-10-14T00:00:00Z', revokedAt: null };
        credentials.push(credential);
        await route.fulfill({ json: { credential, secret } });
      } else await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({ json: route.request().url().includes('storeId=')
      ? { store, sources, credentials, products: [], analyses: [], productCount: 0, lastSyncedAt: null, noticeVersion }
      : { stores: [store], environment: 'sandbox', noticeVersion } });
  });
  await page.goto('/app/integracoes');
  await page.getByLabel('Nome do ERP ou conector').fill('Conector de teste');
  await expect(page.getByRole('button', { name: 'Autorizar e conectar' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Autorizo armazenar e processar/ }).check();
  await page.getByRole('button', { name: 'Autorizar e conectar' }).click();
  await page.getByRole('button', { name: 'Emitir chave' }).click();
  await expect(page.getByText(secret, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(secret);
  expect(mutations[0]).toMatchObject({ action: 'createSource', authorized: true, noticeVersion });
  await page.getByRole('button', { name: 'Já guardei. Ocultar chave.' }).click();
  await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('integration setup failure explains how to recover', async ({ page }) => {
  const identity = await loginIdentity(page);
  expect(identity.response.status()).toBe(200);
  await page.route('**/api/integration*', route => route.fulfill({ status: 503, json: { detail: 'Unavailable' } }));
  await page.goto('/app/integracoes');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('configurar o Postgres');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
});
