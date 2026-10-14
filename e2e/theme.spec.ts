import { test, expect, request } from '@playwright/test';

/**
 * Regresión del tema claro/oscuro: el toggle debe cambiar data-theme
 * y las superficies (no solo el preview).
 */
test.describe('tema claro/oscuro', () => {
  test('toggle cambia data-theme y superficies', async ({ page }) => {
    const ctx = await request.newContext({ baseURL: 'http://localhost:3001' });
    const title = `Tema ${Date.now()}`;
    await ctx.post('/api/notes', { data: { title, content: '# Hola\n\nTexto' } });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notas App' })).toBeAttached();
    await page.getByRole('button', { name: new RegExp(title) }).first().click();

    const html = page.locator('html');
    const header = page.locator('header');
    const initial = await html.getAttribute('data-theme');
    expect(['dark', 'light']).toContain(initial);

    const toLight = initial !== 'light';
    await page
      .getByRole('button', { name: toLight ? /cambiar a tema claro/i : /cambiar a tema oscuro/i })
      .click();
    await expect(html).toHaveAttribute('data-theme', toLight ? 'light' : 'dark');
    await expect
      .poll(async () => header.evaluate((el) => getComputedStyle(el).backgroundColor), {
        timeout: 5000,
      })
      .toBe(toLight ? 'rgb(255, 255, 255)' : 'rgb(30, 41, 59)');

    // Volver al inicial
    await page
      .getByRole('button', { name: toLight ? /cambiar a tema oscuro/i : /cambiar a tema claro/i })
      .click();
    await expect(html).toHaveAttribute('data-theme', initial);
    await ctx.dispose();
  });
});
