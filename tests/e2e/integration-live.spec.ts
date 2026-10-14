import { expect, test } from '@playwright/test';
import { authenticatedPost, loginIdentity } from './auth-helpers';

test('owner creates a real Postgres integration, sends a product and revokes access', async ({ page }) => {
  test.skip(!process.env.INTEGRATION_TEST_DATABASE_URL, 'Requires an isolated migrated Postgres test database.');
  const identity = await loginIdentity(page);
  expect(identity.response.status()).toBe(200);
  let storeId = '';
  try {
    await page.goto('/app/integracoes');
    await page.getByLabel('Nome da loja').fill('Loja sintética navegador');
    const creation = page.waitForResponse(response => response.url().endsWith('/api/integration') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Criar loja' }).click();
    const created = await creation; expect(created.status()).toBe(201); storeId = (await created.json()).id;
    await page.getByLabel('Nome do ERP ou conector').fill('ERP navegador');
    await page.getByRole('checkbox', { name: /Autorizo armazenar e processar/ }).check();
    await page.getByRole('button', { name: 'Autorizar e conectar' }).click();
    const issuance = page.waitForResponse(response => response.url().endsWith('/api/integration') && response.request().postData()?.includes('issueCredential') === true);
    await page.getByRole('button', { name: 'Emitir chave' }).click();
    const issued = await issuance; expect(issued.status()).toBe(201);
    const { secret } = await issued.json();
    await expect(page.getByRole('heading', { name: 'Copie sua chave agora' })).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(secret);
    const batch = await page.request.post(`/api/v1/stores/${storeId}/product-batches`, { headers: { Authorization: `Bearer ${secret}`, 'Idempotency-Key': 'browser-batch-1' }, data: { products: [{ externalId: 'BROWSER-001', sourceVersion: 1, name: 'Produto do conector', barcode: '000123', purchaseCostCents: 6000, salePriceCents: 10000, active: true }] } });
    expect(batch.status()).toBe(200);
    await page.getByRole('button', { name: 'Já guardei. Ocultar chave.' }).click();
    await page.getByRole('button', { name: 'Atualizar integrações' }).click();
    await expect(page.getByRole('cell', { name: 'Produto do conector BROWSER-001' })).toBeVisible();
    await page.getByRole('button', { name: 'Revogar', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('Revogada', { exact: true })).toBeVisible();
    const denied = await page.request.get('/api/v1/me', { headers: { Authorization: `Bearer ${secret}` } });
    expect(denied.status()).toBe(401);
    // Cookie authentication alone must never authorize the public ERP API.
    expect((await page.request.get('/api/v1/me')).status()).toBe(401);
    expect((await page.request.post('/api/integration', { data: { action: 'createStore', name: 'Sem CSRF' } })).status()).toBe(403);
  } finally {
    if (storeId) expect((await authenticatedPost(page, '/api/integration', { action: 'deleteStoreData', storeId })).status()).toBe(200);
    await identity.auth.deleteUser(identity.uid);
  }
});
