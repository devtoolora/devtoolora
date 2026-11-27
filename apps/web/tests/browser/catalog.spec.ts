import { expect, test, toolOutput } from './fixtures';
import { webToolMetadata } from '../../src/toolMetadata.generated';

function categoryCardCount(category: string): number {
  return webToolMetadata.filter((tool) => tool.category === category).length;
}

test('URL workspace distinguishes contexts and url-decode defaults to form decoding', async ({
  page,
}) => {
  await page.goto('/tools/url-encode');

  await expect(page.getByTestId('tool-information').locator('h3')).toHaveText([
    'What is URL encoding?',
    'When to use URL Encode / Decode',
    'How to use it',
    'Examples',
    'Notes',
  ]);

  await expect(
    page.getByTestId('tool-information').locator('p:not([data-testid="eyebrow"])'),
  ).toHaveCount(8);

  await expect(page.getByTestId('tool-information')).toContainText('č becomes %C4%8D');
  await page.getByRole('button', { name: 'Decode', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Encoded URL text', exact: true });

  await input.fill('a+b');
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('a+b');
  await page.getByRole('combobox', { name: 'URL context', exact: true }).selectOption('form');
  await expect(input).toHaveValue('a+b');
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('a b');
  await input.fill('a%2Bb+c');
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('a+b c');
  await page.getByRole('combobox', { name: 'URL context', exact: true }).selectOption('url');
  await input.fill('https://example.com/?q=A%26B');
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('https://example.com/?q=A%26B');
  await page.screenshot({ path: 'test-results/encoding-url-preview.png', fullPage: true });
  await input.fill('%E0%A4');
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('malformed percent');
  await page.goto('/tools/url-decode');

  await expect(page.getByRole('combobox', { name: 'URL context', exact: true })).toHaveValue(
    'form',
  );

  await page.getByRole('textbox', { name: 'Encoded URL text', exact: true }).fill('a+b');
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('a b');
});

test('conversion catalogs keep alias favorites and work at mobile width', async ({ page }) => {
  await page.goto('/tools');
  await page.evaluate(() => localStorage.setItem('dev-tools-favorites', '["base64-decode"]'));
  await page.goto('/tools?category=Encoders');
  await expect(page.locator('.tool-card')).toHaveCount(categoryCardCount('Encoders'));
  await expect(page.locator('.tool-card').filter({ hasText: 'Base64' })).toHaveCount(1);

  await expect(
    page
      .locator('.tool-card')
      .filter({ hasText: 'Base64' })
      .getByRole('button', { name: /favorites/i }),
  ).toHaveAttribute('aria-pressed', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/base64-decode');

  await expect(page.getByRole('button', { name: 'Decode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page
    .getByRole('combobox', { name: 'Apply sample' })
    .selectOption({ label: 'Decode greeting' });

  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('hello');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('desktop conversions open alias routes in their mode and expose the same documentation', async ({
  page,
}) => {
  await page.goto('/desktop?tool=url-decode');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('URL Decode');

  await expect(page.getByRole('button', { name: 'Decode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('textbox', { name: 'Encoded URL text', exact: true }).fill('a+b');
  await page.getByRole('button', { name: 'Decode input', exact: true }).click();
  await expect(toolOutput(page)).toHaveText('a b');
  await page.getByTestId('conversion-help').locator('summary').click();
  await expect(page.getByTestId('conversion-help')).toHaveAttribute('open', '');

  await expect(page.getByTestId('conversion-help').locator('h3')).toHaveText([
    'What is URL encoding?',
    'When to use URL Encode / Decode',
    'How to use it',
    'Examples',
    'Notes',
  ]);

  await expect(page.getByTestId('conversion-help').locator('p')).toHaveCount(8);
  await expect(page.getByTestId('conversion-help')).toContainText('exactly one pass');
  await page.getByRole('button', { name: 'Use result & reverse' }).click();

  await expect(page.getByRole('textbox', { name: 'Plain text / URL', exact: true })).toHaveValue(
    'a b',
  );
});

test('prerenders the tool guide, FAQ and FAQPage data into tool page HTML', async ({
  page,
  request,
}) => {
  const html = await (
    await request.get('/tools/base64-encode', { headers: { accept: 'text/html' } })
  ).text();

  expect(html).toContain('What is Base64?');
  expect(html).toContain('<summary>Is Base64 encryption?</summary>');
  expect(html).toContain('aria-label="Continue with"');
  const structured = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html);
  const faqPage = JSON.parse(structured?.[1] ?? '{}') as {
    '@type'?: string;
    mainEntity?: Array<{ acceptedAnswer: { text: string }; name: string }>;
  };

  expect(faqPage['@type']).toBe('FAQPage');
  expect(faqPage.mainEntity?.[0]?.name).toBe('Is Base64 encryption?');
  expect(faqPage.mainEntity?.[0]?.acceptedAnswer.text.length).toBeGreaterThan(20);

  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/tools/base64-encode');

  await expect(
    page.getByRole('heading', { level: 2, name: 'Questions about Base64 Encode / Decode' }),
  ).toBeVisible();

  await page
    .getByRole('region', { name: 'Continue with' })
    .getByRole('link', { name: /Hex/ })
    .click();

  await expect(page).toHaveURL(/\/tools\/hex-text$/);
  await expect(page.getByRole('heading', { level: 2, name: /^Questions about / })).toBeVisible();
  expect(errors).toEqual([]);
});

test('connects the catalog and detail routes while restoring catalog context', async ({ page }) => {
  await page.goto('/tools?category=Text');
  await expect(page.getByRole('heading', { level: 1, name: 'Every local tool.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Home');

  const cards = page.locator('.tool-card');

  await expect(cards).toHaveCount(categoryCardCount('Text'));

  await cards
    .first()
    .getByRole('button', { name: /favorites/i })
    .click();

  await expect(cards.first().getByRole('button', { name: /favorites/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.evaluate(() => {
    window.scrollTo(0, 650);
    (window as typeof window & { routerMarker?: string }).routerMarker = 'preserved';
  });

  const target = cards.nth(8).getByRole('link');
  const targetName = await target.getAttribute('aria-label');

  await target.click();
  await expect(page).toHaveURL(/\/tools\/[a-z0-9-]+$/);

  expect(
    await page.evaluate(() => (window as typeof window & { routerMarker?: string }).routerMarker),
  ).toBe('preserved');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    targetName?.replace('Open ', '') ?? '',
  );

  await page.getByRole('link', { name: 'Back to results' }).click();
  await expect(page).toHaveURL(/\/tools\?category=Text$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await expect(cards.first().getByRole('button', { name: /favorites/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await expect(page.getByRole('contentinfo')).toBeVisible();
});

test('runs JSON Format through the connected detail workspace', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/tools/json-format');
  await expect(page.getByRole('heading', { level: 1, name: 'JSON Format' })).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Text' });

  await expect(page.getByRole('button', { name: 'Run JSON Format' })).toBeDisabled();
  await input.fill('{"signal":"field"}');
  await page.getByRole('button', { name: 'Run JSON Format' }).click();
  await expect(toolOutput(page)).toContainText('"signal": "field"');
  await page.getByRole('button', { exact: true, name: 'Copy' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('"signal": "field"');

  await expect(page.getByTestId('output-panel').locator('[aria-live="polite"]')).toHaveText(
    'Copied.',
  );

  await expect(page.getByTestId('input-stats')).toHaveText('18 characters · 18 bytes · 1 line');
  await expect(page.getByTestId('output-stats')).toHaveText('23 characters · 23 bytes · 3 lines');
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Formatters');

  await page.getByRole('combobox', { name: 'Indentation' }).selectOption('4');
  await page.getByRole('button', { name: 'Copy settings link' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  const link = new URL(await page.evaluate(() => navigator.clipboard.readText()));

  expect(link.pathname).toBe('/tools/json-format');
  expect([...link.searchParams]).toEqual([['indentation', '4']]);
  await page.goto(`${link.pathname}${link.search}&lineEnding=crlf&mode=bogus&text=secret`);
  await expect(page.getByRole('combobox', { name: 'Indentation' })).toHaveValue('4');
  await expect(page.getByRole('combobox', { name: 'Line endings' })).toHaveValue('crlf');

  await expect(
    page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Format' }),
  ).toHaveAttribute('aria-pressed', 'true');

  await expect(input).toHaveValue('');
  await input.fill('{"signal":"field"}');
  await page.getByRole('button', { name: 'Run JSON Format' }).click();

  await expect(toolOutput(page)).toContainText('{\r\n    "signal": "field"\r\n}', {
    useInnerText: false,
  });

  await page.goto('/tools/not-a-real-tool');
  await expect(page.getByRole('heading', { name: 'Tool not found.' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('downloads an artifact from the generic tool detail page', async ({ page }) => {
  await page.goto('/tools/qr-code-generator');
  await page.getByRole('textbox', { name: 'Text' }).fill('devtoolora');
  await page.getByRole('button', { name: 'Run QR Code Generator' }).click();
  const downloadPromise = page.waitForEvent('download');

  await page.getByRole('button', { name: 'Download qr-code.svg' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('qr-code.svg');
});

test('recovers when the tool worker fails to load', async ({ page }) => {
  await page.route('**/assets/worker-*.js', (route) => route.abort());
  await page.goto('/tools/json-format');
  await expect(page.getByRole('heading', { name: 'This tool could not be loaded.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to tools' })).toBeVisible();
  await page.unroute('**/assets/worker-*.js');
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('textbox', { name: 'Text' })).toBeVisible();
});

test('supports samples, searchable selects, checkbox groups, and text downloads', async ({
  page,
}) => {
  await page.goto('/tools/ascii-text-generator');
  const font = page.getByRole('combobox', { name: 'Font', exact: true });

  await expect(font).toHaveValue('Standard');

  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ label: 'Dev Toolora' });

  await expect(page.getByRole('textbox', { name: 'Text' })).toHaveValue('Dev Toolora');
  await expect(font).toHaveValue('Big');
  await expect(toolOutput(page)).not.toBeEmpty();
  await expect(page.getByText('Auto-run', { exact: true })).toBeVisible();

  await page.goto('/tools/gitignore-generator');
  await page.getByRole('checkbox', { name: 'Node.js' }).check();
  await expect(toolOutput(page)).toContainText('node_modules/');
  const downloadPromise = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: 'Download .gitignore' }).click();
  // Chromium renames a leading-dot download such as .gitignore, so only the base name is checked.
  expect((await downloadPromise).suggestedFilename()).toContain('gitignore');
});

test('keeps checkbox controls and labels inside the input panel', async ({ page }) => {
  for (const path of ['/tools/slugify', '/tools/gitignore-generator']) {
    await page.goto(path);
    const panel = page.getByTestId('input-panel').locator('.panel-body');
    const checkboxes = panel.getByRole('checkbox');

    await expect(checkboxes.first()).toBeVisible();
    await expect(checkboxes.first()).toHaveCSS('width', '16px');

    expect(
      await checkboxes.evaluateAll(
        (inputs, panelBounds) => {
          const right = (panelBounds as { right: number }).right;

          return inputs.every((input) => input.getBoundingClientRect().right <= right + 1);
        },
        await panel.evaluate((element) => ({ right: element.getBoundingClientRect().right })),
      ),
    ).toBe(true);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/slugify');
  const mobilePanel = page.getByTestId('input-panel').locator('.panel-body');
  const mobileRight = await mobilePanel.evaluate(
    (element) => element.getBoundingClientRect().right,
  );

  expect(
    await mobilePanel
      .getByTestId('tool-checkbox')
      .evaluateAll(
        (labels, right) =>
          labels.every((label) => label.getBoundingClientRect().right <= Number(right) + 1),
        mobileRight,
      ),
  ).toBe(true);
});

test('omits run button for auto-run tools and keeps it for manual tools', async ({ page }) => {
  await page.goto('/tools/lorem-ipsum');
  await expect(page.getByText('Auto-run', { exact: true })).toBeVisible();
  await expect(page.getByTestId('run-tool-button')).toHaveCount(0);

  await page.goto('/tools/ascii-text-generator');
  await expect(page.getByText('Auto-run', { exact: true })).toBeVisible();
  await expect(page.getByTestId('run-tool-button')).toHaveCount(0);

  await page.goto('/tools/slugify');
  await expect(page.getByRole('button', { name: 'Run Slugify' })).toBeVisible();
});

test('shows only relevant fields for complex tools', async ({ page }) => {
  const cases = [
    ['/tools/random-token', 'Mode', 'bytes', 'Bytes', 'Length'],
    ['/tools/image-tools', 'Operation', 'rotate', 'Angle', 'Width'],
    ['/tools/batch-image-tools', 'Mode', 'collage', 'Collage layout', 'Export format'],
    ['/tools/web-pwa-icon-generator', 'Source', 'text', 'Text label', 'Source image'],
    ['/tools/percentage-calculator', 'Mode', 'percent-change', 'Old value', 'Percent'],
  ] as const;

  for (const [path, control, value, visibleField, hiddenField] of cases) {
    await page.goto(path);
    await page.getByRole('combobox', { name: control, exact: true }).selectOption(value);
    await expect(page.getByLabel(visibleField, { exact: true })).toBeVisible();
    await expect(page.getByLabel(hiddenField, { exact: true })).toHaveCount(0);
  }

  await page.goto('/tools/jwt-sign-verify');

  await expect(page.getByRole('button', { exact: true, name: 'Verify' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await expect(page.getByLabel('Secret or key', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Extra header JSON', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { exact: true, name: 'Sign' }).click();
  await expect(page.getByLabel('Payload JSON', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Expires in', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Clock tolerance (seconds)', { exact: true })).toHaveCount(0);

  await page.goto('/tools/http-request-builder');
  await page.getByLabel('Body format').selectOption('raw');
  await page.getByLabel('Authentication').selectOption('bearer');
  await expect(page.getByLabel('Raw content type')).toBeVisible();
  await expect(page.getByLabel('Bearer token')).toBeVisible();
  await expect(page.getByLabel('API key value')).toHaveCount(0);
});

test('renders batch failures without hiding successful downloads', async ({ page }) => {
  await page.goto('/tools/batch-image-tools');

  await page.getByLabel('Image files').setInputFiles([
    {
      name: 'one.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    },
    { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') },
  ]);

  await page.getByLabel('Include contact sheet').uncheck();
  await page.getByRole('button', { name: 'Run Batch Image Tools' }).click();
  await expect(page.getByTestId('batch-result')).toContainText('broken.png');
  await expect(page.getByRole('button', { name: 'Download images.zip' })).toBeVisible();
});

test('connects truthful public routes and registers the PWA from direct visits', async ({
  page,
}) => {
  for (const [path, heading] of [
    ['/extension', 'Run tools on your selection, inside your editor.'],
    ['/about', 'Developer tools that stay on your computer.'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText('Coming soon')).toHaveCount(path === '/about' ? 0 : 1);
    await expect(page.getByRole('link', { name: /download|install/i })).toHaveCount(0);
  }

  expect(
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;

      return registration.active?.scriptURL.endsWith('/sw.js');
    }),
  ).toBe(true);
});

test('pages hydrate without errors and keep styles across client navigation', async ({ page }) => {
  const errors: string[] = [];
  const bodyBackground = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const footerBorder = () =>
    page.locator('.site-footer').evaluate((footer) => getComputedStyle(footer).borderBottomWidth);

  // The build inlines route CSS; after load each page hands it back to the links React manages.
  const expectStylesheetsAdopted = async () => {
    await expect(page.locator('style[data-inline-href]')).toHaveCount(0);
    await expect(page.locator('link[rel="stylesheet"][media="print"]')).toHaveCount(0);
  };

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  const background = await bodyBackground();

  await expectStylesheetsAdopted();
  expect(await bodyBackground()).toBe(background);
  // A full page load would drop this marker, so it proves the clicks below navigate client-side.
  await page.evaluate(() => Object.assign(window, { clientNavigationMarker: true }));
  await page.getByTestId('featured-tool-link').first().click();
  await expect(page).toHaveURL(/\/tools\/[\w-]+$/);
  await expect(page.getByTestId('tool-information')).toBeVisible();
  await expect(page.locator('style[data-inline-href*="home-"]')).toHaveCount(0);
  expect(await bodyBackground()).toBe(background);

  const toolPath = new URL(page.url()).pathname;
  const navigatedFooterBorder = await footerBorder();

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: /Every tool/i })).toBeVisible();
  expect(await bodyBackground()).toBe(background);
  expect(await page.evaluate(() => 'clientNavigationMarker' in window)).toBe(true);

  for (const path of ['/tools', toolPath, '/about']) {
    await page.goto(path);
    expect(await bodyBackground()).toBe(background);
    await expectStylesheetsAdopted();
    expect(await bodyBackground()).toBe(background);
  }

  await page.goto(toolPath);
  await expect(page.getByTestId('tool-information')).toBeVisible();
  expect(await footerBorder()).toBe(navigatedFooterBorder);
  expect(errors).toEqual([]);
});

test('connects the desktop workspace without registering the public PWA', async ({ page }) => {
  const hydrationErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Hydration failed'))
      hydrationErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/desktop');
  await expect(page).toHaveURL(/\/desktop\?tool=json-format$/);
  await expect(page.getByRole('heading', { level: 1, name: 'JSON Format' })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistration())).toBeUndefined();

  const search = page.getByRole('combobox', { name: 'Search desktop tools' });

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
  await expect(search).toBeFocused();
  await search.fill('slugify');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/desktop\?tool=slugify$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Slugify' })).toBeVisible();

  await expect(
    page
      .getByTestId('desktop-sidebar')
      .locator('section')
      .filter({ hasText: 'Recent' })
      .getByRole('button', { name: /Slugify/ }),
  ).toBeVisible();

  await page.getByRole('textbox', { name: 'Text' }).fill('Dev Toolora Desktop');
  await page.getByRole('button', { name: 'Run Slugify' }).click();
  await expect(toolOutput(page)).toHaveText('dev-toolora-desktop');

  const panels = await page
    .getByTestId('desktop-workspace')
    .locator('.workspace-panel')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));

  expect(Math.abs(panels[0] - panels[1])).toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: 'Desktop settings', exact: true }).click();
  await page.getByRole('radio', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.goto('/desktop');
  await expect(page).toHaveURL(/\/desktop\?tool=slugify$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Slugify' })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
