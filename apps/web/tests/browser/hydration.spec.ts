import { expect, test, toolInput } from './fixtures';

test('page.goto waits for hydration, so the first input is not lost', async ({ page }) => {
  await page.route('**/assets/entry.client-*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });

  await page.goto('/tools/redirect-rules');
  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });

  await expect(toolInput(page)).not.toHaveValue('');
});

test('the desktop route hydrates without a mismatch', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('dev-tools-theme', 'light'));
  await page.goto('/desktop?tool=base64-encode');

  await expect(page.getByRole('button', { exact: true, name: 'Encode input' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});
