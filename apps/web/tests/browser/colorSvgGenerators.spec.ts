import { expect, openTool, platforms, test, toolInput } from './fixtures';
import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const generator = (id: string, name: string, result: RegExp): SmokeTool => ({
  autoRun: true,
  id,
  inputless: true,
  name,
  result,
});

const tools: SmokeTool[] = [
  {
    autoRun: true,
    id: 'color-scale-generator',
    name: 'Color Scale Generator',
    result: /--color-brand-50/,
  },
  generator('color-mixer', 'Color Mixer', /#[0-9a-f]{6}/i),
  {
    autoRun: true,
    id: 'color-name-lookup',
    name: 'CSS Color Name Lookup',
    result: /Exact match: aqua, cyan\./,
  },
  {
    autoRun: true,
    id: 'color-blindness-palette-simulator',
    name: 'Color Blindness Palette Simulator',
    result: /normal[\s\S]*protan/,
  },
  generator('mesh-gradient-generator', 'Mesh Gradient Generator', /\.mesh|radial-gradient/),
  generator('svg-blob-generator', 'SVG Blob Generator', /<svg /),
  generator('svg-wave-generator', 'SVG Wave Generator', /<svg /),
  generator('svg-pattern-generator', 'SVG Pattern Generator', /\.pattern \{/),
  {
    autoRun: true,
    id: 'svg-to-data-uri',
    name: 'SVG to Data URI, CSS & JSX Converter',
    result: /data:image\/svg\+xml/,
  },
  { autoRun: true, id: 'barcode-generator', name: 'Barcode Generator', result: /<svg / },
];

defineToolSmokeTests('Color and SVG generators', tools);

// The summary of each tool's first sample, so the check proves the sample's own run finished.
const svgTools = [
  ['svg-blob-generator', /seed 42\./],
  ['svg-wave-generator', /seed 11\./],
  ['svg-pattern-generator', /dots pattern with a 24px tile/],
  ['svg-to-data-uri', /^URL-encoded data URI/],
  ['barcode-generator', /^Code 128, \d+ modules\./],
] as const;

for (const platform of platforms) {
  for (const [id, summary] of svgTools) {
    test(`Color and SVG generators ${platform}: ${id} shows an SVG preview`, async ({ page }) => {
      await openTool(page, platform, id);
      await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });

      // A stale image stays visible (dimmed, aria-busy) while a re-run is pending.
      const preview = page.locator(
        'img[data-testid="result-preview"][src^="data:image/svg+xml"]:not([aria-busy])',
      );

      await expect(preview).toBeVisible();
      await expect(page.getByTestId('result-summary')).toHaveText(summary);
      await expect(page.getByRole('alert')).toHaveCount(0);

      await expect
        .poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0);
    });
  }

  test(`Color and SVG generators ${platform}: mesh gradient preview`, async ({ page }) => {
    await openTool(page, platform, 'mesh-gradient-generator');

    await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });
    await expect(page.locator('[data-css-preview]').first()).toBeVisible();
  });
}

test('Color and SVG generators: color mixer renders range and color inputs', async ({ page }) => {
  await page.goto('/tools/color-mixer');
  await expect(page.locator('input[type=range]').first()).toBeVisible();
  await expect(page.locator('input[type=color]').first()).toBeVisible();
});

test('Color and SVG generators: color scale fits a 390 px viewport', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/tools/color-scale-generator');
  await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });
  await expect(page.getByRole('region', { name: 'Result' })).toContainText(/--color-brand-50/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390)).toBe(true);
});

const fieldRecoveries = [
  ['color-mixer', /^Weight of A/, '101', '50', /#[0-9a-f]{6}/i],
  ['svg-blob-generator', /^Size/, '0', '400', /<svg /],
  ['svg-pattern-generator', /^Stroke size/, '50', '2', /\.pattern \{/],
] as const;

for (const [id, label, bad, good, result] of fieldRecoveries) {
  test(`Color and SVG generators: ${id} recovers after an invalid value`, async ({ page }) => {
    await page.goto(`/tools/${id}`);
    const field = page.getByRole('spinbutton', { name: label });

    await field.fill(bad);
    await expect(page.getByRole('alert')).toBeVisible();
    await field.fill(good);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Result' })).toContainText(result);
  });
}

const inputRecoveries = [
  // The default css format prints --brand-50; the tailwind-v4 sample above prints --color-brand-50.
  ['color-scale-generator', 'rgb(0 0 0 / 0.5)', '#2563eb', /:root \{\s*--brand-50: #/],
  [
    'svg-to-data-uri',
    '<html/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>',
    /data:image/,
  ],
] as const;

for (const [id, bad, good, result] of inputRecoveries) {
  test(`Color and SVG generators: ${id} recovers after invalid input`, async ({ page }) => {
    await page.goto(`/tools/${id}`);
    const input = toolInput(page);

    await input.fill(bad);
    await expect(page.getByRole('alert')).toBeVisible();
    await input.fill(good);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Result' })).toContainText(result);
  });
}

test('Color and SVG generators: barcode-generator recovers after a wrong EAN check digit', async ({
  page,
}) => {
  await page.goto('/tools/barcode-generator');
  const input = toolInput(page);

  await page.getByRole('group', { name: 'Format' }).getByRole('button', { name: 'EAN-13' }).click();
  await input.fill('4006381333932');
  await expect(page.getByRole('alert')).toContainText('Check digit should be 1');
  await input.fill('4006381333931');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Result' })).toContainText(/<svg /);
});
