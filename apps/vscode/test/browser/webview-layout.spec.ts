import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { threePagePdf } from '../../../../tests/browser-helpers/pdf';
import { pngPixels } from '../../../../tests/browser-helpers/pixels';
import { vscodeToolMetadata } from '../../src/extension/toolMetadata.generated';

const extensionRoot = join(process.cwd(), 'apps', 'vscode');
const assetRoot = join(extensionRoot, 'dist', 'webview', 'assets');
const defaultToolIds = [
  'base64-encode',
  'base64-decode',
  'slugify',
  'case-convert',
  'json-format',
  'json-tree',
  'random-token',
  'css-keyframes-generator',
  'pdf-page-numbers',
];

// Keep in step with the production policy; the nonce is for the stub and theme scripts.
const productionCsp =
  "default-src 'none'; img-src data: blob:; style-src 'nonce-test' 'self'; script-src 'nonce-test' 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src blob:";

const darkTheme = `
  --vscode-button-background: #0e639c;
  --vscode-button-foreground: #ffffff;
  --vscode-button-hoverBackground: #1177bb;
  --vscode-button-secondaryBackground: #3a3d41;
  --vscode-button-secondaryForeground: #ffffff;
  --vscode-button-secondaryHoverBackground: #45494e;
  --vscode-descriptionForeground: #a1a1a1;
  --vscode-editor-background: #1e1e1e;
  --vscode-editor-font-family: Menlo, Monaco, monospace;
  --vscode-editor-foreground: #d4d4d4;
  --vscode-errorForeground: #f48771;
  --vscode-focusBorder: #007fd4;
  --vscode-font-family: system-ui, sans-serif;
  --vscode-foreground: #cccccc;
  --vscode-input-background: #3c3c3c;
  --vscode-input-border: #555555;
  --vscode-input-foreground: #cccccc;
  --vscode-panel-border: #444444;
  --vscode-sideBar-background: #252526;
  --vscode-textCodeBlock-background: #1e1e1e;`;

const lightTheme = `
  --vscode-button-background: #007acc;
  --vscode-button-foreground: #ffffff;
  --vscode-button-hoverBackground: #0062a3;
  --vscode-button-secondaryBackground: #5f6a79;
  --vscode-button-secondaryForeground: #ffffff;
  --vscode-button-secondaryHoverBackground: #4c5561;
  --vscode-descriptionForeground: #717171;
  --vscode-editor-background: #ffffff;
  --vscode-editor-font-family: Menlo, Monaco, monospace;
  --vscode-editor-foreground: #000000;
  --vscode-errorForeground: #a1260d;
  --vscode-focusBorder: #0090f1;
  --vscode-font-family: system-ui, sans-serif;
  --vscode-foreground: #333333;
  --vscode-input-background: #ffffff;
  --vscode-input-border: #cecece;
  --vscode-input-foreground: #616161;
  --vscode-panel-border: #e5e5e5;
  --vscode-sideBar-background: #f3f3f3;
  --vscode-textCodeBlock-background: #f5f5f5;`;

const cspViolations: string[] = [];

test.beforeEach(async ({ page }) => {
  cspViolations.length = 0;

  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) cspViolations.push(message.text());
  });

  await page.route('**/vscode-webview-assets/**', async (route) => {
    const assetName = decodeURIComponent(
      new URL(route.request().url()).pathname.replace('/vscode-webview-assets/', ''),
    );
    const assetPath = normalize(join(assetRoot, assetName));

    if (!assetPath.startsWith(`${assetRoot}${sep}`) || !existsSync(assetPath)) {
      await route.fulfill({ status: 404, body: 'Not found' });

      return;
    }

    await route.fulfill({
      status: 200,
      contentType: contentType(assetPath),
      body: readFileSync(assetPath),
    });
  });

  await page.route('**/devtoolora-webview-*.html*', async (route) => {
    const fixtureUrl = new URL(route.request().url());
    const mode = fixtureUrl.pathname.includes('sidebar') ? 'sidebar' : 'editor';
    const requestedToolId = fixtureUrl.searchParams.get('tool');
    const toolIds = new Set(defaultToolIds);

    if (requestedToolId) toolIds.add(requestedToolId);

    const fixtureTools =
      fixtureUrl.searchParams.get('tools') === 'all'
        ? vscodeToolMetadata
        : vscodeToolMetadata.filter((tool) => toolIds.has(tool.id));
    const initialActiveToolId = requestedToolId ?? 'random-token';
    const isLight = fixtureUrl.searchParams.get('theme') === 'light';
    const theme = isLight ? lightTheme : darkTheme;
    let html = readFileSync(join(extensionRoot, 'dist', 'webview', 'index.html'), 'utf8')
      .replace('{{CSP}}', productionCsp)
      .replace('{{APP_CONFIG}}', () =>
        JSON.stringify({
          mode,
          initialActiveToolId,
          workerUri: '/vscode-webview-assets/worker.js',
        }).replace(/</g, '\\u003c'),
      )
      .replace('{{TOOL_DATA}}', () => JSON.stringify(fixtureTools).replace(/</g, '\\u003c'))
      .replaceAll('./assets/', '/vscode-webview-assets/')
      // The host marks the theme kind on body; native controls key their color-scheme on it.
      .replace('<body>', `<body class="${isLight ? 'vscode-light' : 'vscode-dark'}">`);

    html = html.replace('</head>', `<style nonce="test">:root {${theme}\n}</style></head>`);

    html = html.replace(
      '<script type="module"',
      `<script nonce="test">
      window.__messages = [];
      window.__state = JSON.parse(sessionStorage.getItem('vscodeState') ?? '{}');
      window.acquireVsCodeApi = () => ({
        getState: () => window.__state,
        setState: (state) => { window.__state = state; sessionStorage.setItem('vscodeState', JSON.stringify(state)); },
        postMessage: (message) => window.__messages.push(message),
      });
    </script><script nonce="test" type="module"`,
    );

    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });
});

test.afterEach(() => {
  expect(cspViolations).toEqual([]);
});

const messages = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __messages: unknown[] }).__messages);
const savedState = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __state: Record<string, unknown> }).__state);

test('runs Base64 in the webview worker, reverses it and hands the result to the host', async ({
  page,
}) => {
  await page.goto('/devtoolora-webview-editor.html?tool=base64-encode');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Base64 Encode / Decode');
  await page.getByRole('textbox', { exact: true, name: 'UTF-8 text' }).fill('Dev Toolora');
  await page.getByRole('button', { exact: true, name: 'Encode input' }).click();
  await expect(page.getByTestId('output-panel').locator('code')).toHaveText('RGV2IFRvb2xvcmE=');
  await page.getByRole('button', { exact: true, name: 'Replace selection' }).click();

  expect((await messages(page)).at(-1)).toMatchObject({
    action: 'replace',
    result: { text: 'RGV2IFRvb2xvcmE=' },
    type: 'resultAction',
  });

  await page.getByRole('button', { name: 'Use result & reverse' }).click();

  await expect(page.getByRole('button', { exact: true, name: 'Decode' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await expect(page.getByRole('textbox', { exact: true, name: 'Base64 text' })).toHaveValue(
    'RGV2IFRvb2xvcmE=',
  );
});

test('restores the draft after the webview reloads', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=slugify');
  await page.getByRole('textbox', { exact: true, name: 'Text' }).fill('Dev Toolora Draft');

  await expect
    .poll(
      async () =>
        ((await savedState(page)).toolDrafts as Record<string, { input: string }>)?.slugify?.input,
    )
    .toBe('Dev Toolora Draft');

  await page.reload();

  await expect(page.getByRole('textbox', { exact: true, name: 'Text' })).toHaveValue(
    'Dev Toolora Draft',
  );
});

test('hands a JSON result to another tool without running it', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=json-format');
  await page.getByRole('textbox', { exact: true, name: 'Text' }).fill('{"name":"Ada"}');
  await page.getByRole('button', { exact: true, name: 'Run JSON Format' }).click();
  const handoff = page.getByRole('region', { name: 'Continue with result' });

  await expect(handoff).toContainText('Continue with result: Detected JSON.');
  await handoff.getByRole('button', { exact: true, name: 'JSON Tree' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('JSON Tree');

  await expect(page.getByRole('textbox', { exact: true, name: 'Text' })).toHaveValue(
    /"name": "Ada"/,
  );

  await expect(page.getByTestId('output-panel').locator('code')).toHaveCount(0);

  expect(await messages(page)).toContainEqual({
    keepSource: true,
    toolId: 'json-tree',
    type: 'openTool',
  });
});

test('resizes the split from the keyboard and stacks panels below 760 px', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=slugify');
  const separator = page.getByRole('separator', { name: 'Resize input and output panes' });

  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '52');
  await expect.poll(async () => (await savedState(page)).editorSplitPercent).toBe(52);

  await page.setViewportSize({ height: 900, width: 700 });
  await expect(separator).toBeHidden();
  const input = await page.getByTestId('input-panel').boundingBox();
  const output = await page.getByTestId('output-panel').boundingBox();

  expect(output && input && output.y >= input.y + input.height - 1).toBe(true);
});

test('reflows the editor at every width without horizontal scroll', async ({ page }) => {
  const mode = page.locator('.tool-segmented-control').first();
  const indentation = page.getByRole('combobox', { exact: true, name: 'Indentation' });

  await page.setViewportSize({ height: 640, width: 1000 });
  await page.goto('/devtoolora-webview-editor.html?tool=json-format');
  await expect(page.getByTestId('run-tool-button')).toBeInViewport();

  const wideMode = await mode.boundingBox();
  const wideIndentation = await indentation.boundingBox();

  expect(wideMode && wideIndentation && wideIndentation.x > wideMode.x).toBe(true);

  for (const width of [1280, 1000, 760, 759, 560, 340, 280]) {
    await page.setViewportSize({ height: 640, width });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);

    await expect(page.getByTestId('run-tool-button')).toBeInViewport();
  }

  const narrowMode = await mode.boundingBox();
  const narrowIndentation = await indentation.boundingBox();

  expect(narrowMode && narrowIndentation && narrowIndentation.y > narrowMode.y).toBe(true);
});

test('runs the active tool with Shift+Cmd+R', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=random-token');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Token Generator');
  await expect(page.getByTestId('output-panel')).toBeVisible();
  await page.keyboard.press(process.platform === 'darwin' ? 'Shift+Meta+R' : 'Shift+Control+R');
  await expect(page.getByTestId('output-panel').locator('code')).not.toBeEmpty();
});

test('shows documentation tabs and remembers that Tool info is open', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=base64-encode');
  await page.getByText('Tool info', { exact: true }).click();
  const tabs = page.getByRole('tablist', { name: 'Tool documentation' }).getByRole('tab');

  await expect(tabs).toHaveText([
    'What is Base64?',
    'When to use Base64 Encode / Decode',
    'How it works',
    'Examples',
    'Notes',
    'FAQ',
  ]);

  await expect(page.getByRole('tabpanel')).toContainText('printable ASCII text');
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await savedState(page)).isToolInfoOpen).toBe(true);
});

test('keeps the keyframes and PDF previews alive under the production CSP', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/devtoolora-webview-editor.html?tool=css-keyframes-generator');
  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });
  const sample = page
    .getByRole('region', { name: 'Animation preview' })
    .locator('[data-css-preview="keyframes"]');

  await expect(sample).toBeVisible();

  await expect
    .poll(() => sample.evaluate((element) => element.getAnimations().length))
    .toBeGreaterThan(0);

  await page.goto('/devtoolora-webview-editor.html?tool=pdf-page-numbers');

  await page.getByLabel('PDF file', { exact: true }).setInputFiles({
    buffer: await threePagePdf(),
    mimeType: 'application/pdf',
    name: 'letters.pdf',
  });

  await expect(
    page.getByRole('img', { name: 'Page 1 with the header, footer and watermark' }),
  ).toBeVisible({ timeout: 15_000 });
});

test('draws SVG to PNG on the page under the production CSP', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=svg-to-png');

  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({
    label: 'Group, gradient and text',
  });

  await page.getByRole('button', { exact: true, name: 'Run SVG to PNG' }).click();
  await expect(page.getByTestId('output-panel').locator('img')).toBeVisible();

  const dataUri = await page.getByTestId('output-panel').locator('img').first().getAttribute('src');
  const png = Buffer.from(dataUri?.split(',')[1] ?? '', 'base64');
  const [gradient, empty] = await pngPixels(page, png, [
    [150, 50],
    [5, 5],
  ]);

  expect(gradient?.[2]).toBeGreaterThan(50);
  expect(gradient?.[1]).toBeGreaterThan(50);
  expect(empty).toEqual([0, 0, 0, 0]);
});

test('loads the OCR runtime in the editor and recognizes the sample', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=image-ocr');
  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });
  await page.getByRole('button', { exact: true, name: 'Run Image to Text (OCR)' }).click();

  await expect(page.getByTestId('output-panel')).toContainText('Dev Toolora 2026', {
    timeout: 30_000,
  });
});

test('keeps the output gutter inside the scrolling result for long output', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=json-format');
  const big = JSON.stringify(
    Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`key${index}`, index])),
  );

  await page.getByRole('textbox', { exact: true, name: 'Text' }).fill(big);
  await page.getByRole('button', { exact: true, name: 'Run JSON Format' }).click();
  const pre = page.getByTestId('output-panel').locator('pre');

  await expect(pre).toContainText('"key299"');
  const preBox = await pre.boundingBox();
  const gutterBox = await page
    .getByTestId('output-panel')
    .locator('[data-testid="line-gutter"]')
    .boundingBox();

  expect(preBox && preBox.height).toBeLessThanOrEqual(600);
  expect(gutterBox && preBox && Math.abs(gutterBox.height - preBox.height) <= 1).toBe(true);
});

test('maps a light VS Code theme onto the runner', async ({ page }) => {
  await page.goto('/devtoolora-webview-editor.html?tool=slugify&theme=light');
  await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(243, 243, 243)');

  await expect(page.getByTestId('input-panel').locator('textarea')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );

  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(51, 51, 51)');
  const border = await page
    .getByTestId('input-panel')
    .locator('textarea')
    .evaluate((element) => getComputedStyle(element).borderColor);

  expect(border).not.toBe('rgb(255, 255, 255)');
});

test('opens a tool from the sidebar search with the keyboard', async ({ page }) => {
  await page.goto('/devtoolora-webview-sidebar.html');
  await expect(page.getByText('Dev Toolora', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  const search = page.getByRole('searchbox', { name: 'Search tools' });

  await search.fill('slug');
  await expect(page.getByRole('region', { name: 'Search results' })).toContainText('Slugify');
  await search.press('Enter');
  expect(await messages(page)).toContainEqual({ toolId: 'slugify', type: 'openTool' });
});

test('shows favorites, recents and the active tool from navigationState', async ({ page }) => {
  await page.goto('/devtoolora-webview-sidebar.html');
  await expect(page.getByRole('searchbox', { name: 'Search tools' })).toBeVisible();

  await page.evaluate(() =>
    window.postMessage(
      {
        state: {
          activeToolId: 'base64-decode',
          favoriteToolIds: ['slugify'],
          recentTools: [{ timestamp: Date.now() - 120_000, toolId: 'json-format' }],
        },
        type: 'navigationState',
      },
      '*',
    ),
  );

  const favorites = page.getByRole('region', { name: 'Favorites' });

  await expect(favorites.getByRole('button', { exact: true, name: 'Slugify' })).toBeVisible();
  const recent = page.getByRole('region', { name: 'Recent' });

  await expect(recent.getByRole('button', { exact: true, name: 'JSON Format' })).toBeVisible();
  await expect(recent).toContainText('2m ago');

  await expect(page.locator('[data-active="true"] button[data-tool-id]')).toHaveAttribute(
    'data-tool-id',
    'base64-encode',
  );

  await favorites.getByRole('button', { name: 'Remove Slugify from favorites' }).click();
  expect((await messages(page)).at(-1)).toEqual({ toolId: 'slugify', type: 'toggleFavorite' });
});

test('collapses every category from one toggle and keeps it after reload', async ({ page }) => {
  await page.goto('/devtoolora-webview-sidebar.html');
  await page.getByRole('button', { name: 'Collapse all' }).click();
  const headers = page.locator('button[aria-expanded]:not([disabled])');

  await expect(headers).not.toHaveCount(0);
  for (const header of await headers.all())
    await expect(header).toHaveAttribute('aria-expanded', 'false');

  await expect
    .poll(async () => (await savedState(page)).collapsedCategories as string[])
    .toContain('Text');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand all' })).toBeVisible();
  for (const header of await page.locator('button[aria-expanded]:not([disabled])').all())
    await expect(header).toHaveAttribute('aria-expanded', 'false');
});

test('fits a 320 px sidebar without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ height: 760, width: 320 });
  await page.goto('/devtoolora-webview-sidebar.html');

  await expect(
    page.getByRole('button', { exact: true, name: 'Base64 Encode / Decode' }),
  ).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const shell = await page.locator('aside').boundingBox();

  expect(shell && shell.width).toBeLessThanOrEqual(320);
  // Native controls follow the VS Code theme class, not the OS scheme.
  expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme)).toBe('dark');
});

test('scrolls the list inside the sidebar, never the page', async ({ page }) => {
  await page.setViewportSize({ height: 300, width: 320 });
  await page.goto('/devtoolora-webview-sidebar.html?tools=all');
  await expect(page.getByText('Dev Toolora', { exact: true })).toBeVisible();
  const list = page.locator('[aria-label="Developer tools"]');

  expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    ),
  ).toBe(true);
});

test('maps a light VS Code theme onto the sidebar', async ({ page }) => {
  await page.goto('/devtoolora-webview-sidebar.html?theme=light');
  await expect(page.locator('aside')).toHaveCSS('background-color', 'rgb(243, 243, 243)');

  await expect(page.getByRole('searchbox', { name: 'Search tools' })).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );

  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

  for (const selector of [
    'button[data-tool-id]',
    'button[aria-expanded]',
    'button[aria-label="Collapse all"]',
  ]) {
    await expect(page.locator(selector).first()).toHaveCSS('font-family', bodyFont);
  }

  expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme)).toBe('light');
});

function contentType(path: string): string {
  if (extname(path) === '.css') return 'text/css';
  if (extname(path) === '.js' || extname(path) === '.mjs') return 'text/javascript';

  return 'application/octet-stream';
}
