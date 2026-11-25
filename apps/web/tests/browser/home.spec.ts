import { expect, test } from './fixtures';
import { webToolMetadata } from '../../src/toolMetadata.generated';

test('renders the homepage and searches generated tool metadata', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /Every tool/i })).toBeVisible();

  await expect(page.locator('main')).toHaveAttribute(
    'data-tool-count',
    String(webToolMetadata.length),
  );

  const search = page.getByRole('combobox', { name: 'Search developer tools' });

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await expect(search).toBeFocused();
  await search.fill('json format');
  await expect(page.getByRole('option').first()).toContainText('JSON Format');
  await search.press('Enter');
  // The tool route lazy-loads its chunk and prerendered data; with four workers on one preview
  // server that can exceed 5 s.
  await expect(page).toHaveURL(/\/tools\/json-format$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'JSON Format' })).toBeVisible();
});

test('home search loads the full tool metadata on demand', async ({ page }) => {
  await page.goto('/');

  const search = page.getByRole('combobox', { name: 'Search developer tools' });

  await search.focus();
  // The prerendered defaults lack it; the base58-encode alias is never a search result.
  await search.fill('base58');

  await expect(
    page.getByRole('listbox', { name: 'Tool results' }).locator('a[href="/tools/base-n-encoder"]'),
  ).toBeVisible();
});

test.describe('without the service worker', () => {
  // page.route cannot see requests the service worker answers.
  test.use({ serviceWorkers: 'block' });

  test('home search reports a failed tool metadata load', async ({ page }) => {
    const metadataChunk = /\/assets\/toolMetadata\.generated-[\w-]+\.js$/;

    await page.route(metadataChunk, (route) => route.abort());
    await page.goto('/');

    const search = page.getByRole('combobox', { name: 'Search developer tools' });
    const results = page.getByRole('listbox', { name: 'Tool results' });

    await search.fill('base58');
    await expect(results).toContainText('Search is unavailable. Reload the page to try again.');
    // Typing retries the import; Chromium keeps the failed module, so the message stays.
    await search.fill('base5');
    await expect(results).toContainText('Search is unavailable. Reload the page to try again.');
  });
});

test('search results listbox only contains options', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tool-search-results')).toBeVisible();

  const roles = await page
    .locator('#tool-search-results > *')
    .evaluateAll((children) => children.map((child) => child.getAttribute('role')));

  expect(roles.length).toBeGreaterThan(0);
  expect(roles.every((role) => role === 'option')).toBe(true);
});

test('home links meet the 24px target size', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto('/');

  const links = page.locator(
    '[data-testid="featured-tool-link"], [data-testid="category-arrow-link"]',
  );

  expect(await links.count()).toBeGreaterThan(0);

  for (const link of await links.all()) {
    const box = await link.boundingBox();

    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
});

test('wrapped featured links keep their targets apart', async ({ page }) => {
  // Lighthouse desktop width, where the longest featured lists wrap onto a second line.
  await page.setViewportSize({ height: 940, width: 1350 });
  await page.goto('/');
  // Wrapping depends on the web font's metrics.
  await page.evaluate(() => document.fonts.ready);

  // Hit areas may overlap a few pixels across lines, but each target must keep a 24px band of its
  // own (axe target-size measures the unobscured area), so overlapping targets start 24px apart.
  const crowded = await page.getByTestId('category-featured').evaluateAll((lists) =>
    lists.flatMap((list) => {
      const targets = [
        ...list.querySelectorAll(
          '[data-testid="featured-tool-link"], [data-testid="category-arrow-link"]',
        ),
      ];
      const boxes = targets.map((target) => target.getBoundingClientRect());

      return boxes.flatMap((a, index) =>
        boxes
          .slice(index + 1)
          .filter((b) => a.left < b.right && b.left < a.right && a.top < b.bottom)
          .filter((b) => b.top < a.bottom && Math.abs(a.top - b.top) < 24)
          .map(() => list.textContent?.trim()),
      );
    }),
  );
  const lineCounts = await page
    .getByTestId('category-featured')
    .evaluateAll((lists) =>
      lists.map(
        (list) => new Set([...list.children].map((item) => item.getBoundingClientRect().top)).size,
      ),
    );

  expect(Math.max(...lineCounts)).toBeGreaterThan(1);
  expect(crowded).toEqual([]);
});

test('brand link name contains its visible text', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('header').getByRole('link', { name: 'Dev Toolora' })).toBeVisible();
});
