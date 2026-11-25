import { expect, test, toolOutput } from './fixtures';

function tokenToRgb(hex: string): string {
  return `rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`;
}

for (const theme of ['dark', 'light']) {
  test(`output text and run button follow the ${theme} theme tokens`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('dev-tools-theme', value), theme);
    await page.goto('/tools/base64-encode');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.getByRole('textbox', { name: 'UTF-8 text', exact: true }).fill('signal');
    await page.getByRole('button', { name: 'Encode input', exact: true }).click();
    await expect(toolOutput(page)).toHaveText('c2lnbmFs');

    const tokens = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);

      return {
        ink: rootStyle.getPropertyValue('--color-void').trim(),
        text: rootStyle.getPropertyValue('--color-text').trim(),
      };
    });

    await expect(page.getByTestId('output-panel').locator('pre')).toHaveCSS(
      'color',
      tokenToRgb(tokens.text),
    );

    await expect(page.getByTestId('run-tool-button')).toHaveCSS('color', tokenToRgb(tokens.ink));
  });
}

test('the light theme survives hydrating a filtered category page', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dev-tools-theme', 'light'));
  await page.goto('/tools?category=Crypto');
  await expect(page.locator('.tool-card').first()).toBeVisible();
  await expect(page.locator('.tool-card').filter({ hasText: 'Base64' })).toHaveCount(0);
  await page.waitForLoadState('networkidle');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await expect(page.getByRole('switch', { name: 'Light theme' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  expect(errors).toEqual([]);
});

test('an unknown route renders the not-found page without hydration errors', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dev-tools-theme', 'light'));
  const response = await page.goto('/nope');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('the light theme survives a page that fails to hydrate', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dev-tools-theme', 'light'));

  // Serve the home page HTML for an unknown route, as a misconfigured host would.
  await page.route('**/nope', async (route) =>
    route.fulfill({
      response: await route.fetch({ url: route.request().url().replace('/nope', '/') }),
    }),
  );

  await page.goto('/nope');
  await page.waitForLoadState('networkidle');

  expect(errors.some((message) => message.includes('#418'))).toBe(true);

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f2f6f8');

  await expect(page.getByRole('switch', { name: 'Light theme' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
