import { test, expect } from '@playwright/test';

test('simulador do hero recalcula as margens e os CTAs encaminham ao cadastro', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'E se você der um desconto?' });
  await slider.focus();
  await slider.press('Home');
  for (let i = 0; i < 10; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveValue('10');
  const dashboard = page.locator('[class*="dashboard"]').first();
  await expect(dashboard.getByText('33,3%', { exact: true })).toBeVisible();
  await expect(dashboard.getByText('10,5%', { exact: true })).toBeVisible();
  await expect(dashboard.getByText('-22,2%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Analisar meus produtos grátis' }).last().click();
  await expect(page).toHaveURL('/cadastro');
  await expect(page.getByRole('button', { name: 'Continuar com Google' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao site' }).click();
  await page.getByRole('button', { name: 'Experimentar uma demonstração' }).click();
  await expect(page).toHaveURL('/cadastro?modo=demo');
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL('/entrar?modo=demo');
});

test('menu, FAQ e arquivo modelo funcionam no celular sem overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Dúvidas' }).click();
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Minha planilha fica salva?' }).click();
  await expect(page.getByRole('region', { name: 'Minha planilha fica salva?' })).toContainText('sem upload do catálogo');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Baixar planilha modelo' }).click();
  expect((await download).suggestedFilename()).toBe('modelo-produtos.csv');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('movimento pode ser pausado e respeita a preferência do visitante', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const visual = page.locator('[class*="heroVisual"]').first();
  const bounds = await visual.boundingBox();
  if (!bounds) throw new Error('Hero não visível');
  await page.mouse.move(bounds.x + 30, bounds.y + 40);
  await expect.poll(() => visual.evaluate(el => el.style.getPropertyValue('--rotate-x'))).not.toBe('');
  await page.getByRole('button', { name: 'Pausar movimento' }).click();
  await expect(page.getByRole('button', { name: 'Ativar movimento' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('[class*="visualInner"]').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  expect(await page.locator('[class*="floatingNote"]').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.locator('#por-que-usar').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: /10% de desconto/ })).toBeVisible();
});
