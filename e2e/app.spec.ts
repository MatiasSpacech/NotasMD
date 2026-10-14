import { test, expect } from '@playwright/test';

/**
 * Humo de UI (Fase 10): carga, crear nota desde plantilla y autocompletado [[.
 */
test.describe('app: humo de UI', () => {
  test('carga, crea nota y autocompleta [[', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Notas App' })).toBeAttached();

    // Crear nota desde el modal de plantillas
    await page.getByRole('button', { name: /nueva nota/i }).click();
    await expect(page.getByText('Nueva nota', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: /crear nota/i }).click();

    // La nota aparece en el sidebar y el editor está visible
    await expect(page.locator('.w-md-editor-text-input')).toBeVisible();

    // Autocompletado [[...]]: escribir trigger y aceptar con Enter
    const editor = page.locator('.w-md-editor-text-input');
    await editor.click();
    await page.keyboard.type('Enlace a [[', { delay: 20 });
    const suggestion = page.getByRole('button', { name: /\[\[/ }).first();
    await expect(suggestion).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Enter');
    await expect(editor).toHaveValue(/\[\[/);
  });

  test('sidebar redimensionable por teclado y con memoria', async ({ page }) => {
    await page.goto('/');
    const sep = page.getByRole('separator', { name: /redimensionar sidebar/i });
    await expect(sep).toBeVisible();
    const aside = page.locator('aside[aria-label="Notas y carpetas"]');
    const before = await aside.evaluate((el) => el.getBoundingClientRect().width);
    await sep.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const after = await aside.evaluate((el) => el.getBoundingClientRect().width);
    expect(after).toBeGreaterThan(before);
    await page.reload();
    const persisted = await page
      .locator('aside[aria-label="Notas y carpetas"]')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(persisted).toBe(after);
  });
});
