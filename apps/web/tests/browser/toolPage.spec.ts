import { expect, test } from './fixtures';

test('tool guide: first section is open once the definition loads', async ({ page }) => {
  await page.goto('/tools/css-grid-generator');
  const guide = page.getByTestId('tool-information');

  await expect(guide.locator('h3')).toHaveCount(5);
  const expanded = guide.getByRole('button', { expanded: true });

  await expect(expanded).toHaveCount(1);
  await expect(expanded).toContainText('What is a CSS grid layout?');
});

test('auto-run tools: preview and output never blank between re-runs', async ({ page }) => {
  await page.goto('/tools/css-grid-generator');

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: 'Compact grid' });

  const stage = page.locator('[data-css-preview="grid"]');

  await expect(stage).toBeVisible();
  const blanked = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const start = performance.now();

        const tick = () => {
          if (
            document
              .querySelector('[aria-label="Live CSS preview"]')
              ?.textContent?.includes('Waiting')
          )
            return resolve(true);
          if (document.querySelector('[data-testid="output-placeholder"]')) return resolve(true);
          if (performance.now() - start > 800) return resolve(false);

          requestAnimationFrame(tick);
        };

        tick();
      }),
  );
  const columns = page.getByRole('spinbutton', { exact: true, name: 'Columns' });
  const next = Number(await columns.inputValue()) + 1;

  await columns.fill(String(next));

  await expect
    .poll(() => stage.evaluate((element) => (element as HTMLElement).style.gridTemplateColumns))
    .toContain(`repeat(${next},`);

  expect(await blanked).toBe(false);
  await columns.fill('1.5');
  await expect(page.getByRole('alert')).toContainText('whole number');

  await expect(page.locator('[aria-label="Live CSS preview"]')).toContainText(
    'Waiting for valid CSS',
  );
});

test('tool documentation uses the full width without a privacy sidebar', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ height: 844, width });

    for (const path of ['/tools/base64-encode', '/tools/url-encode', '/tools/json-format']) {
      await page.goto(path);
      const documentation = page.getByTestId('tool-information');
      const article = documentation.locator('article');

      await expect(article).toBeVisible();
      await expect(documentation.locator('aside')).toHaveCount(0);

      expect(await article.evaluate((element) => element.getBoundingClientRect().width)).toBe(
        await documentation.evaluate((element) => element.getBoundingClientRect().width),
      );
    }
  }
});

for (const viewport of [
  { height: 915, width: 412 },
  { height: 900, width: 1440 },
]) {
  test(`tool page layout stays put at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    await page.addInitScript(() => {
      const layoutShift = { total: 0 };

      Object.assign(window, { layoutShift });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { hadRecentInput: boolean; value: number }
        >) {
          if (!entry.hadRecentInput) layoutShift.total += entry.value;
        }
      }).observe({ buffered: true, type: 'layout-shift' });
    });

    await page.goto('/tools/json-format', { waitUntil: 'load' });
    // Layout shifts have no end event to wait for, so sample a fixed window after load.
    await page.waitForTimeout(3000);

    const layoutShift = await page.evaluate(
      () => (window as unknown as { layoutShift: { total: number } }).layoutShift,
    );

    expect(layoutShift.total).toBeLessThan(0.02);
  });
}
