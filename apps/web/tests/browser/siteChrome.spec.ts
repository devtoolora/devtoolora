import { version } from '../../package.json';
import { expect, test } from './fixtures';

test('mobile navigation drawer opens, closes on Escape and closes after a link', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools');

  const toggle = page.getByRole('button', { name: 'Open navigation menu' });
  const drawer = page.getByRole('navigation', { name: 'Mobile navigation' });

  await toggle.click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('link', { name: 'Tools' })).toHaveClass('is-active');

  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  await toggle.click();
  await drawer.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(drawer).toBeHidden();
});

test('home search moves the active result with the arrows and closes on Escape', async ({
  page,
}) => {
  await page.goto('/');

  const search = page.getByRole('combobox', { name: 'Search developer tools' });
  const results = page.getByRole('listbox', { name: 'Tool results' });

  await search.fill('json');
  await expect(results.getByRole('option').first()).toHaveAttribute('data-active', 'true');

  await search.press('ArrowDown');
  await expect(results.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');

  await expect(search).toHaveAttribute(
    'aria-activedescendant',
    (await results.getByRole('option').nth(1).getAttribute('id')) ?? '',
  );

  await expect(
    page.getByTestId('command-search').getByRole('link', { name: 'View all tools' }),
  ).toBeVisible();

  // Escape in a filled search input also clears it natively, which reopens the list.
  await search.fill('');
  await search.press('Escape');
  await expect(results).toBeHidden();
  await expect(search).toHaveAttribute('aria-expanded', 'false');
});

test('desktop search follows the arrows and the pointer and closes outside', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/desktop');

  const search = page.getByRole('combobox', { name: 'Search desktop tools' });
  const results = page.locator('#desktop-search-results');

  await search.fill('json');
  await search.press('ArrowDown');
  await expect(results.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');

  await results.getByRole('option').nth(2).hover();
  await expect(results.getByRole('option').nth(2)).toHaveAttribute('data-active', 'true');

  await search.fill('');
  await search.press('Escape');
  await expect(results).toBeHidden();

  await search.focus();
  await expect(results).toBeVisible();
  await page.getByTestId('desktop-brand').click();
  await expect(results).toBeHidden();

  await search.fill('zzzz-no-tool');
  await expect(results).toContainText('No matching local tool.');
});

test('desktop settings switch tabs, apply sidebar options and keep the tab after closing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/desktop');

  const dialog = page.getByRole('dialog');
  const recentSection = page
    .getByTestId('desktop-sidebar')
    .locator('section')
    .filter({ hasText: 'Recent' });

  await page.getByRole('button', { name: 'Desktop settings', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Appearance', level: 2 })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Appearance' })).toBeFocused();

  await expect(dialog.getByRole('radio', { name: 'System', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  const forest = dialog.getByRole('radio', { name: /Deep Forest/ });

  await forest.click();
  await expect(forest).toHaveAttribute('aria-checked', 'true');
  await dialog.getByPlaceholder('#0B172D').fill('#123456');
  await expect(forest).toHaveAttribute('aria-checked', 'false');
  await expect(dialog.getByLabel('Pick a custom color')).toHaveValue('#123456');
  await dialog.getByRole('button', { name: 'Reset appearance' }).click();
  await expect(dialog.getByPlaceholder('#0B172D')).toHaveValue('');
  await expect(dialog.getByLabel('Pick a custom color')).toHaveValue('#0b172d');

  await dialog.getByRole('tab', { name: 'Sidebar' }).click();
  await expect(dialog.getByRole('heading', { name: 'Sidebar' })).toBeVisible();
  await expect(recentSection).toHaveCount(1);

  await dialog
    .locator('label', { has: page.getByRole('checkbox', { name: /recent tools/ }) })
    .click();

  await expect(recentSection).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Clear recent tools' }).click();
  await expect(dialog.getByRole('button', { name: 'Cleared' })).toBeVisible();

  await dialog.getByRole('tab', { name: 'Sidebar' }).press('ArrowDown');
  await expect(dialog.getByRole('tab', { name: 'About' })).toBeFocused();
  await expect(dialog.getByRole('tabpanel', { name: 'About' })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'About Dev Toolora' })).toBeVisible();
  await expect(dialog).toContainText('Tauri v2 Native Shell');
  await expect(dialog).toContainText(`Dev Toolora Desktop v${version}`);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Desktop settings', exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'Desktop settings', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'About Dev Toolora' })).toBeVisible();
  await page.mouse.click(5, 795);
  await expect(dialog).toBeHidden();
});

test('desktop Liquid Glass keeps its blur in the built CSS and every theme follows the mode', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/desktop');

  const root = page.locator('html');
  const toolbar = page.getByTestId('desktop-toolbar');
  const themeSwitch = toolbar.getByRole('switch', { name: 'Light theme' });
  const dialog = page.getByRole('dialog');

  await expect(themeSwitch).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: 'Desktop settings', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Dark', exact: true }).click();
  await dialog.getByRole('radio', { name: /Liquid Glass/ }).click();
  await expect(root).toHaveAttribute('data-surface', 'glass');
  await expect(toolbar).toHaveCSS('backdrop-filter', /blur/);

  await expect(page.getByRole('complementary', { name: 'Desktop tool navigation' })).toHaveCSS(
    'backdrop-filter',
    /blur/,
  );

  await dialog.getByRole('radio', { name: /Slate Graphite/ }).click();
  await expect(root).not.toHaveAttribute('data-surface', 'glass');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await dialog.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(toolbar).not.toHaveCSS('background-color', 'rgb(18, 24, 32)');
});

test('desktop marks an alias tool by its canonical tool in every sidebar section', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/desktop?tool=base64-decode');

  const favoriteButton = page.getByRole('button', { name: 'Add Base64 Decode to favorites' });

  await expect(favoriteButton).toHaveCSS('width', '36px');
  await expect(favoriteButton).toHaveCSS('border-top-width', '1px');
  await favoriteButton.click();

  await expect(
    page
      .getByTestId('desktop-sidebar')
      .locator('section')
      .filter({ hasText: 'Favorites' })
      .getByRole('button', { name: /Base64 Encode/ }),
  ).toHaveAttribute('data-active', 'true');
});

test('the tool page favorite button has the header look', async ({ page }) => {
  await page.goto('/tools/json-format');

  const favoriteButton = page.getByRole('button', { name: 'Add JSON Format to favorites' });

  await expect(favoriteButton).toHaveCSS('width', '44px');
  await expect(favoriteButton).toHaveCSS('border-top-width', '1px');
});

test.describe('off Apple platforms', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });

  test('search hints name Ctrl K and only where the shortcut works', async ({ page }) => {
    await page.goto('/');

    const search = page.getByTestId('command-search');

    await expect(search.locator('kbd').first()).toHaveText('Ctrl K');
    await expect(search).not.toContainText('⌘');

    await page.goto('/tools');
    await expect(page.getByTestId('catalog-intro').locator('kbd')).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/desktop');
    await expect(page.getByTestId('desktop-toolbar').locator('kbd')).toHaveText('Ctrl K');
  });
});

test('desktop settings radio groups move with the arrow keys and the hex field has a name', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/desktop');
  await page.getByRole('button', { name: 'Desktop settings', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const system = dialog.getByRole('radio', { name: 'System', exact: true });

  await expect(system).not.toHaveAttribute('aria-pressed');
  await system.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeFocused();

  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  await expect(dialog.getByRole('textbox', { name: 'Custom color hex code' })).toBeVisible();
});

test('the home header keeps a way to navigate between the tablet and phone layouts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto('/');

  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Tools' }),
  ).toBeVisible();
});

test('the home page keeps its banner and footer outside main', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toHaveCount(1);
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await expect(page.locator('main header, main footer')).toHaveCount(0);

  const firstRow = page.getByTestId('category-row').first();

  await expect(firstRow.locator('a:not([tabindex="-1"])').first()).toHaveAttribute(
    'data-testid',
    'category-main-link',
  );

  await expect(firstRow.locator('a[href^="/tools?category="]:not([tabindex="-1"])')).toHaveCount(1);
  await expect(page.getByTestId('core-orbit')).toHaveCSS('animation-name', 'none');
});

test('the catalog announces the result count and marks the active filter', async ({ page }) => {
  await page.goto('/tools');

  const filters = page.getByRole('complementary', { name: 'Tool categories' });

  await expect(page.getByTestId('tool-grid')).not.toHaveAttribute('aria-live');

  await expect(filters.getByRole('button', { name: /All tools/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('searchbox', { name: 'Search tools' }).fill('json format');
  await expect(page.getByRole('status')).toHaveText(/^\d+ tools?$/);
  await expect(page.getByRole('status')).not.toHaveText('0 tools');
});

test('the desktop sidebar marks the open tool as current', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/desktop?tool=json-format');

  await expect(
    page
      .getByRole('complementary', { name: 'Desktop tool navigation' })
      .locator('[aria-current="true"]')
      .first(),
  ).toContainText('JSON Format');
});
