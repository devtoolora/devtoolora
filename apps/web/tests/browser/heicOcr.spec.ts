import { expect, openTool, openToolWithSample, platforms, test, type Page } from './fixtures';
import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    autoRun: false,
    id: 'heic-converter',
    inputless: true,
    name: 'HEIC to JPG & PNG',
    result: /Converted/,
  },
  {
    autoRun: false,
    id: 'image-ocr',
    inputless: true,
    name: 'Image to Text (OCR)',
    result: /Dev Toolora 2026/,
  },
];

defineToolSmokeTests('HEIC and OCR tools', tools);

const OCR_NOTE =
  'Downloads about 5.8 MB on first use (engine 2.9 MB + English 3.0 MB; ' +
  'Czech 2.2 MB more when selected). Cached for offline use.';

const HEIC_NOTE = 'Downloads about 1.5 MB on first use. Cached for offline use.';

const GLUE_MARKERS = ['getWordFontAttributes', 'heif_context_get_primary_image_handle'];

const RUNTIME_PATH = '/assets/runtime/';

const result = (page: Page) => page.getByRole('region', { name: 'Result' });
const runButton = (page: Page, name: string) =>
  page.getByRole('button', { exact: true, name: `Run ${name}` });

function runtimeRequests(page: Page): string[] {
  const paths: string[] = [];

  page.on('request', (request) => {
    const { pathname } = new URL(request.url());

    if (pathname.startsWith(RUNTIME_PATH)) paths.push(pathname);
  });

  return paths;
}

async function runOcr(page: Page, text: RegExp | string): Promise<void> {
  await runButton(page, 'Image to Text (OCR)').click();
  await expect(result(page)).toContainText(text, { timeout: 20_000 });
}

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;

    if (navigator.serviceWorker.controller) return;

    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
        once: true,
      });
    });
  });
}

for (const platform of platforms) {
  test(`HEIC and OCR tools ${platform}: the size line shows the manifest numbers`, async ({
    page,
  }) => {
    for (const [id, name, note] of [
      ['image-ocr', 'Image to Text (OCR)', OCR_NOTE],
      ['heic-converter', 'HEIC to JPG & PNG', HEIC_NOTE],
    ]) {
      await openTool(page, platform, id);
      await expect(runButton(page, name)).toBeVisible();

      // Desktop bundles the runtime, so nothing is downloaded and no size is shown.
      if (platform === 'web') await expect(page.getByText(note, { exact: true })).toBeVisible();
      else await expect(page.getByText(/Downloads about/)).toHaveCount(0);
    }
  });

  test(`HEIC and OCR tools ${platform}: selecting Czech fetches ces.traineddata.gzip exactly once`, async ({
    page,
  }) => {
    const requests = runtimeRequests(page);

    await openToolWithSample(page, platform, 'image-ocr', 'Czech text');
    await runOcr(page, 'Příliš žluťoučký kůň');

    expect(requests.filter((path) => path.endsWith('/ces.traineddata.gzip'))).toHaveLength(1);
  });

  test(`HEIC and OCR tools ${platform}: a second run does not fetch again`, async ({ page }) => {
    const requests = runtimeRequests(page);

    await openToolWithSample(page, platform, 'image-ocr', 'Czech text');
    await runOcr(page, 'Příliš žluťoučký kůň');
    const firstRun = requests.length;

    // A changed field clears the result, so the second run's text is its own.
    await page.getByRole('combobox', { name: 'Layout' }).selectOption({ label: 'Single line' });
    await expect(result(page)).not.toContainText('Příliš');
    await runOcr(page, 'Příliš žluťoučký kůň');

    expect(firstRun).toBeGreaterThan(0);
    expect(requests.slice(firstRun)).toEqual([]);
  });

  test(`HEIC and OCR tools ${platform}: tools fit a 390 px viewport`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });

    for (const [id, name, text] of [
      ['heic-converter', 'HEIC to JPG & PNG', /Converted/],
      ['image-ocr', 'Image to Text (OCR)', /Dev Toolora 2026/],
    ] as const) {
      await openToolWithSample(page, platform, id);
      await runButton(page, name).click();
      await expect(result(page)).toContainText(text, { timeout: 20_000 });

      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
  });

  test(`HEIC and OCR tools ${platform}: glue loads from assets/runtime`, async ({ page }) => {
    const requests = runtimeRequests(page);
    const scripts = new Set<string>();
    const cspErrors: string[] = [];

    const recordCsp = (text: string): void => {
      if (/Content Security Policy/i.test(text)) cspErrors.push(text);
    };

    page.on('request', (request) => {
      const { pathname } = new URL(request.url());

      if (pathname.endsWith('.js') && !pathname.startsWith(RUNTIME_PATH)) scripts.add(pathname);
    });

    page.on('console', (message) => recordCsp(message.text()));
    page.on('worker', (worker) => worker.on('console', (message) => recordCsp(message.text())));
    page.on('pageerror', (error) => recordCsp(error.message));

    await openToolWithSample(page, platform, 'image-ocr');
    await runOcr(page, 'Dev Toolora 2026');
    expect(requests).toContain(`${RUNTIME_PATH}tesseract-core-simd-lstm.js`);

    await openToolWithSample(page, platform, 'heic-converter');
    await runButton(page, 'HEIC to JPG & PNG').click();
    await expect(result(page)).toContainText('Converted');
    expect(requests).toContain(`${RUNTIME_PATH}libheif.js`);

    expect(scripts.size).toBeGreaterThan(0);

    for (const path of scripts) {
      const source = await (await page.request.get(path)).text();

      for (const marker of GLUE_MARKERS) expect(source, path).not.toContain(marker);
    }

    expect(cspErrors).toEqual([]);
  });
}

test('HEIC and OCR tools web: works offline through the service worker', async ({
  context,
  page,
}) => {
  await page.goto('/');
  await waitForServiceWorker(page);

  // The page is now controlled, so the runtime files of the first run land in the cache.
  await openToolWithSample(page, 'web', 'image-ocr');
  await runOcr(page, 'Dev Toolora 2026');

  await context.setOffline(true);
  await page.reload();

  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });
  await runOcr(page, 'Dev Toolora 2026');
});
