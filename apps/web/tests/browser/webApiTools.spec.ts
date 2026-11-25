import {
  expect,
  openTool,
  platforms,
  test,
  toolGuide,
  toolInput,
  toolOutput,
  type Page,
} from './fixtures';
import { readFileSync } from 'node:fs';

const secret = 'a-string-secret-at-least-256-bits-long';

async function downloadText(page: Page, fileName: string): Promise<string> {
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
  const download = await pending;

  expect(download.suggestedFilename()).toBe(fileName);
  const path = await download.path();

  if (!path) throw new Error(`${fileName} was not saved.`);

  return readFileSync(path, 'utf8');
}

for (const platform of platforms) {
  const guide = (page: Page) => toolGuide(page, platform);

  test(`JWT Debugger ${platform}: decode, verify, sign round trip, algorithm confusion and no saved secrets`, async ({
    page,
  }) => {
    await openTool(page, platform, 'jwt-parse');
    if (platform === 'desktop') await guide(page).locator('summary').click();

    await expect(guide(page).locator('h3')).toHaveText([
      'What is a JWT?',
      'When to use JWT Debugger',
      'Reading the result',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(page.getByText('Auto-run', { exact: true })).toBeVisible();
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const outline = page.getByLabel('Interactive JSON outline');
    const summary = page.getByTestId('result-summary');

    await samples.selectOption({ label: 'Decode an HS256 token' });
    await expect(summary).toContainText('Decoded, signature not verified');
    await expect(outline).toContainText('Ada Lovelace');
    await expect(page.getByLabel('Secret or key', { exact: true })).toHaveCount(0);

    await samples.selectOption({ label: 'Verify RS256 with a PEM public key' });
    await expect(summary).toContainText('Valid RS256 signature');
    await samples.selectOption({ label: 'Verify ES256 with a JWKS' });
    await expect(summary).toContainText('Valid ES256 signature');

    await samples.selectOption({ label: 'Verify HS256 with a secret' });
    await expect(summary).toContainText('Valid HS256 signature');
    const key = page.getByLabel('Secret or key', { exact: true });

    await key.fill(`${secret}-wrong`);
    await expect(summary).toContainText('Invalid');
    await page.getByLabel('Algorithm', { exact: true }).selectOption('RS256');
    await key.fill(secret);
    await expect(summary).toContainText('Invalid');

    await samples.selectOption({ label: 'Sign HS256 with iat and a 1 hour expiry' });
    await expect(page.getByTestId('primary-input').locator('> span')).toHaveText('Payload JSON');
    await expect(summary).toContainText('Signed with HS256 · expires');
    const token = (await toolOutput(page).textContent())?.trim() ?? '';

    expect(token.split('.')).toHaveLength(3);
    await page.getByRole('button', { exact: true, name: 'Verify' }).click();
    await expect(page.getByTestId('primary-input').locator('> span')).toHaveText('JWT');
    await toolInput(page).fill(`Bearer ${token}`);
    await page.getByLabel('Secret or key', { exact: true }).fill(secret);
    await expect(summary).toContainText('Valid HS256 signature');
    await expect(outline).toContainText('Ada Lovelace');

    await page.getByRole('button', { exact: true, name: 'Decode' }).click();
    await toolInput(page).fill('not-a-jwt');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(summary).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: `test-results/jwt-parse-${platform}.png` });
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(secret);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(token);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Timestamp converter ${platform}: now by default, zones, DST and table for many lines`, async ({
    page,
  }) => {
    await openTool(page, platform, 'timestamp-convert');
    if (platform === 'desktop') await guide(page).locator('summary').click();

    await expect(guide(page).locator('h3')).toHaveText([
      'What is a Unix timestamp?',
      'When to convert timestamps',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    const summary = page.getByTestId('result-summary');
    const outline = page.getByLabel('Interactive JSON outline');

    await expect(summary).toBeVisible();
    const samples = page.getByRole('combobox', { name: 'Apply sample' });

    await samples.selectOption({ label: 'Unix seconds' });
    await expect(outline).toContainText('2023-11-14T22:13:20.000Z');
    await page.getByLabel('Time zone', { exact: true }).fill('Asia/Tokyo');
    await expect(summary).toContainText('2023-11-15T07:13:20+09:00 in Asia/Tokyo');
    await samples.selectOption({ label: 'Milliseconds from Date.now()' });
    await expect(summary).toContainText('milliseconds');
    await samples.selectOption({ label: 'Local time on a DST change' });
    await expect(outline).toContainText('does not exist');
    await samples.selectOption({ label: 'Log column as a table' });
    const table = page.getByRole('region', { name: 'Data table' });

    await expect(table.locator('tbody tr')).toHaveCount(4);
    await expect(summary).toContainText('4 of 4 values converted');
    await toolInput(page).fill('1700000000\nnot a date');
    await expect(summary).toContainText('1 of 2 values converted');
    await expect(table.getByRole('columnheader', { name: 'error' })).toBeVisible();

    await page.screenshot({
      fullPage: true,
      path: `test-results/timestamp-convert-${platform}.png`,
    });

    await toolInput(page).fill('2026-02-30T10:00:00Z');
    await expect(page.getByRole('alert')).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Meta tag generator ${platform}: required fields, live preview, suggestions and exact HTML`, async ({
    page,
  }) => {
    await openTool(page, platform, 'meta-tag-generator');
    if (platform === 'desktop') await guide(page).locator('summary').click();

    await expect(guide(page).locator('h3')).toHaveText([
      'What are meta tags and Open Graph?',
      'When to generate meta tags',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(page.getByTestId('result-summary')).toHaveCount(0);
    await expect(page.getByLabel('Image alt text', { exact: true })).toHaveCount(0);
    const samples = page.getByRole('combobox', { name: 'Apply sample' });

    await samples.selectOption({ label: 'Landing page with image' });
    await expect(page.getByLabel('Image alt text', { exact: true })).toBeVisible();
    await expect(page.getByTestId('result-preview')).toBeVisible();
    await expect(page.getByTestId('result-summary')).toContainText('Nothing to improve');
    const output = toolOutput(page);

    await expect(output).toContainText(
      '<meta property="og:image:alt" content="Dev Toolora tool grid on a dark background">',
    );

    await expect(output).toContainText('<meta name="twitter:card" content="summary_large_image">');
    const html = await downloadText(page, 'meta-tags.html');

    expect(html).toBe(`${await output.textContent()}\n`);
    await samples.selectOption({ label: 'Long text with suggestions' });
    await expect(page.getByTestId('result-summary')).toContainText('suggestions');
    await page.getByLabel('Title', { exact: true }).fill('<script>alert(1)</script> & "quotes"');

    await expect(output).toContainText(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;',
    );

    await page.screenshot({
      fullPage: true,
      path: `test-results/meta-tag-generator-${platform}.png`,
    });

    await page.getByLabel('Title', { exact: true }).fill('');
    await expect(page.getByRole('button', { name: 'Download meta-tags.html' })).toHaveCount(0);
    await openTool(page, platform, 'open-graph-preview');
    await page.getByLabel('Title', { exact: true }).fill('Alias page');

    await page
      .getByLabel('Description', { exact: true })
      .fill('The former Open Graph Preview link keeps working.');

    await expect(page.getByTestId('result-preview')).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Color converter ${platform}: every notation, swatch, syntax switch and helpful errors`, async ({
    page,
  }) => {
    await openTool(page, platform, 'color-converter');
    if (platform === 'desktop') await guide(page).locator('summary').click();

    await expect(guide(page).locator('h3')).toHaveText([
      'What is a CSS color converter?',
      'When to convert colors',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const outline = page.getByLabel('Interactive JSON outline');

    await samples.selectOption({ label: 'Hex (#3b82f6)' });
    await expect(page.getByTestId('result-preview')).toBeVisible();
    await expect(outline).toContainText('rgb(59, 130, 246)');
    await expect(outline).toContainText('oklch(');
    await page.getByRole('button', { exact: true, name: 'Spaces' }).click();
    await expect(outline).toContainText('rgb(59 130 246)');
    await samples.selectOption({ label: 'Named color' });
    await expect(outline).toContainText('#663399');
    await samples.selectOption({ label: 'Outside the sRGB gamut' });
    await expect(outline).toContainText('gamut');
    await page.screenshot({ fullPage: true, path: `test-results/color-converter-${platform}.png` });
    await toolInput(page).fill('color(display-p3 1 0 0)');
    await expect(page.getByRole('alert')).toContainText('color() is not supported');
    await toolInput(page).fill('#12345');
    await expect(page.getByRole('alert')).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`HTTP request tools ${platform}: export formats, credentials warning and raw round trip`, async ({
    page,
  }) => {
    await openTool(page, platform, 'http-request-builder');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'API key in the query (Python)' });
    await expect(output).toContainText('import requests');
    await expect(output).toContainText('api_key=demo-key');
    await expect(page.getByTestId('result-summary')).toContainText('Contains credentials');
    const python = await downloadText(page, 'request.py');

    expect(python).toBe(await output.textContent());
    await samples.selectOption({ label: 'Raw text upload (raw HTTP)' });
    await expect(output).toContainText('PUT /notes/hello.txt HTTP/1.1');
    await expect(output).toContainText('Content-Length: 37');
    await openTool(page, platform, 'raw-http-request-inspector');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'GET with Authorization (cURL)' });

    await expect(output).toContainText(
      "curl --globoff -X 'GET' 'https://api.example.com/v1/orders?status=open'",
    );

    await expect(page.getByTestId('result-summary')).toContainText('Contains credentials');
    await toolInput(page).fill('GET /missing-host HTTP/1.1');
    await expect(page.getByRole('alert')).toContainText('Host header');
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
