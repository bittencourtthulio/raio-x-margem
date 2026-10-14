import { test, expect } from '@playwright/test';
import { authenticatedPost, loginIdentity, loginCompleteAccount } from './auth-helpers';

test('sem conta, acesso direto e API ficam bloqueados; links levam à entrada', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL('/entrar');
  await expect(page.getByRole('button', { name: 'Continuar com Google' })).toBeEnabled();
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  expect((await page.request.post('/api/diagnostics', { headers: { Origin: 'http://127.0.0.1:3100' }, data: {} })).status()).toBe(401);
  await page.context().addCookies([{ name: 'rxm_auth', value: 'forged-session', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/app?modo=demo');
  await expect(page).toHaveURL('/entrar?modo=demo');
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL('/entrar');
  await page.goto('/login');
  await expect(page).toHaveURL('/entrar');
});

test('cadastro exige negócio, mantém contato comercial opcional e libera acesso; sair bloqueia novamente', async ({ page }) => {
  const { response } = await loginIdentity(page);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ profileComplete: false });
  const cookie = (await page.context().cookies()).find(c => c.name === 'rxm_auth');
  expect(cookie?.httpOnly).toBe(true); expect(cookie?.sameSite).toBe('Lax');
  await page.goto('/app?modo=demo');
  await expect(page).toHaveURL('/completar-cadastro?modo=demo');
  expect((await page.request.post('/api/diagnostics', { headers: { Origin: 'http://127.0.0.1:3100' }, data: {} })).status()).toBe(403);
  await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa do Cadastro');
  await page.getByLabel('Nome do negócio', { exact: true }).fill('Mercado de Teste');
  await expect(page.getByLabel(/Aceito contato/)).not.toBeChecked();
  await page.getByLabel(/Li o aviso de privacidade/).check();
  await page.getByRole('button', { name: 'Concluir cadastro e acessar' }).click();
  await expect(page).toHaveURL('/app?modo=demo');
  await expect(page.getByRole('dialog', { name: 'Seu primeiro Raio-X.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar para a ferramenta' }).click();
  await expect(page.getByRole('heading', { name: 'Veja o que os números dizem.' })).toBeVisible();
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Veja o que os números dizem.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL('/entrar');
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.goto('/app');
  await expect(page).toHaveURL('/entrar');
});

test('recusa token inválido, email não verificado, requisições sem CSRF e sessões revogadas', async ({ page }) => {
  expect((await page.request.post('/api/auth/session', { data: { idToken: 'forged' } })).status()).toBe(403);
  expect((await authenticatedPost(page, '/api/auth/session', { idToken: 'forged' })).status()).toBe(401);
  expect((await loginIdentity(page, false)).response.status()).toBe(403);
  const { auth, uid } = await loginCompleteAccount(page);
  expect((await page.request.post('/api/auth/logout', { headers: { Origin: 'http://127.0.0.1:3100' }, data: {} })).status()).toBe(403);
  await auth.updateUser(uid, { disabled: true });
  expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  await page.goto('/app');
  await expect(page).toHaveURL('/entrar');
});
