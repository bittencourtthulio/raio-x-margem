import { test, expect } from '@playwright/test';
import { loginCompleteAccount } from './auth-helpers';

test('primeiro acesso abre a aula; fechar persiste e Como usar reabre com teclado', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await loginCompleteAccount(page, { dismissTutorial: false });
  await page.goto('/app');
  const dialog = page.getByRole('dialog', { name: 'Seu primeiro Raio-X.' });
  await expect(dialog).toBeVisible();
  const video = dialog.locator('video');
  await expect(video).toHaveAttribute('preload', 'metadata');
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.getByRole('button', { name: 'Continuar para a ferramenta' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Como usar' })).toBeFocused();
  await expect(page.locator('video')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Vamos conhecer seus produtos.' })).toBeVisible();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Como usar' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('vídeo público carrega e reproduz; modal cabe na tela do celular', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginCompleteAccount(page, { dismissTutorial: false });
  await page.goto('/app');
  const dialog = page.getByRole('dialog', { name: 'Seu primeiro Raio-X.' });
  await expect(dialog).toBeVisible();
  const video = dialog.locator('video');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => ({ duration: element.duration, error: element.error?.code ?? null })), { timeout: 60000 }).toMatchObject({ duration: expect.any(Number), error: null });
  await page.waitForFunction(() => { const video = document.querySelector('video'); return !!video && Number.isFinite(video.duration) && video.duration > 290; }, null, { timeout: 60000 });
  await video.evaluate(async (element: HTMLVideoElement) => { element.muted = true; await element.play(); });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime), { timeout: 20000 }).toBeGreaterThan(0);
  expect(await dialog.evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight; })).toBe(true);
  await page.screenshot({ path: 'test-results/tutorial-mobile.png' });
  await page.getByRole('button', { name: 'Fechar aula' }).click();
  await expect(page.locator('video')).toHaveCount(0);
});
