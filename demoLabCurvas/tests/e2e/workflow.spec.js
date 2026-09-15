import { expect, test } from '@playwright/test';

test('flujos docentes, creación, exportación y QA visual', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Laboratorio de curvas Bézier' })).toBeVisible();
  await expect(page.locator('.exact-curve')).toHaveCount(1);

  await test.step('bases, continuidad y exportación SVG', async () => {
    await page.getByRole('button', { name: 'Bases' }).click();
    await expect(page.getByText('Funciones base')).toBeVisible();
    await expect(page.locator('.chart')).toBeVisible();
    await page.getByRole('button', { name: 'Continuidad' }).click();
    await page.getByRole('combobox', { name: 'Ejemplos incorporados' }).selectOption('07-c1-sin-c2');
    await expect(page.getByRole('dialog')).toContainText('Las posiciones y primeras derivadas coinciden');
    await expect(page.getByRole('dialog')).toContainText('Resultado esperado');
    await page.screenshot({ path: 'docs/qa/example-info.png', fullPage: true });
    await page.getByRole('button', { name: 'Cerrar explicación' }).click();
    await expect(page.locator('.exact-curve')).toHaveCount(2);
    await expect(page.locator('.continuity-table')).toContainText('✓');
    await expect(page.locator('.continuity-table')).toContainText('×');
    await page.getByRole('button', { name: 'Exportar' }).click();
    const download = page.waitForEvent('download');
    await page.locator('.modal').getByRole('button', { name: 'Exportar' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.svg$/);
    await page.getByRole('button', { name: 'Controles' }).click();
    await page.getByRole('checkbox', { name: "Primera derivada C'" }).check();
    await expect(page.locator('.first-derivative-vector')).toHaveCount(1);
    await expect(page.locator('.unit-tangent-vector')).toHaveCount(1);
    const vectorLengths = await page.locator('.first-derivative-vector, .unit-tangent-vector').evaluateAll((lines) => lines.map((line) => Math.hypot(Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')), Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')))));
    expect(Math.abs(vectorLengths[0] - vectorLengths[1])).toBeGreaterThan(5);
    await page.getByLabel('Representación').selectOption('manual');
    await expect(page.locator('.sampled-curve').first()).toHaveAttribute('stroke', '#db2777');
    await expect(page.locator('.exact-curve').first()).toHaveAttribute('stroke', '#bfdbfe');
  });

  await test.step('creación cúbica independiente y borrador', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTitle('Nueva escena').click();
    await page.getByRole('button', { name: 'Agregar' }).click();
    const viewport = page.locator('.viewport'); const box = await viewport.boundingBox();
    for (const [x, y] of [[140, 180], [220, 100], [300, 100], [380, 180], [460, 240], [520, 160]]) await page.mouse.click(box.x + x, box.y + y);
    await expect(page.locator('.exact-curve')).toHaveCount(1);
    await expect(page.locator('.draft-layer')).toHaveCount(1);
    await expect(page.locator('.draft-label')).toContainText('Faltan 2 puntos');
  });

  await test.step('capturas a 1280 y 1920', async () => {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('combobox', { name: 'Ejemplos incorporados' }).selectOption('03-cubica-casteljau');
    await page.getByRole('button', { name: 'Cerrar explicación' }).click();
    await page.getByRole('button', { name: 'Controles' }).click();
    await page.getByRole('checkbox', { name: 'De Casteljau' }).check();
    await page.screenshot({ path: 'docs/qa/1280-casteljau.png', fullPage: true });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole('button', { name: 'Continuidad' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('combobox', { name: 'Ejemplos incorporados' }).selectOption('08-c2');
    await page.getByRole('button', { name: 'Cerrar explicación' }).click();
    await expect(page.locator('.exact-curve')).toHaveCount(2);
    await page.screenshot({ path: 'docs/qa/1920-continuidad.png', fullPage: true });
  });
});
