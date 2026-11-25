import { expect, openTool, platforms, test } from './fixtures';
import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const generator = (id: string, name: string, result: RegExp): SmokeTool => ({
  autoRun: true,
  id,
  inputless: true,
  name,
  result,
});

const tools: SmokeTool[] = [
  generator('css-gradient-generator', 'CSS Gradient Generator', /\.gradient \{/),
  generator('css-text-shadow-generator', 'CSS Text Shadow Generator', /\.text \{/),
  generator('css-filter-generator', 'CSS Filter Generator', /\.filter \{/),
  generator('css-transform-generator', 'CSS Transform Generator', /\.transform \{/),
  generator('css-glassmorphism-generator', 'Glassmorphism Generator', /\.glass \{/),
  generator('css-neumorphism-generator', 'Neumorphism Generator', /\.neumorphism \{/),
  generator('css-cubic-bezier-generator', 'Cubic-Bezier & Easing Editor', /--easing/),
  generator('css-loader-generator', 'CSS Loader Generator', /class="loader"/),
  {
    alert: /Minimum size/,
    autoRun: true,
    fields: [{ kind: 'number', label: /^Minimum size/, value: '0' }],
    id: 'css-clamp-generator',
    inputless: true,
    name: 'Fluid Type / clamp() Generator',
    result: /clamp\(1rem, 0\.9167rem \+ 0\.4167vw, 1\.25rem\)/,
  },
  {
    autoRun: true,
    id: 'css-unit-converter',
    inputless: true,
    name: 'CSS Unit Converter',
    result: /24px[\s\S]*18pt/,
  },
  {
    autoRun: true,
    id: 'aspect-ratio-calculator',
    inputless: true,
    name: 'Aspect Ratio Calculator',
    result: /16 \/ 9[\s\S]*56\.25%/,
  },
  {
    alert: /Missing "\]" to close the attribute selector/,
    autoRun: true,
    id: 'css-specificity-calculator',
    invalidText: 'div[',
    name: 'CSS Specificity Calculator',
    result: /1,2,1/,
  },
];

defineToolSmokeTests('CSS generators', tools);

const previews: Array<[string, string]> = [
  ['css-gradient-generator', 'gradient'],
  ['css-text-shadow-generator', 'text-shadow'],
  ['css-filter-generator', 'filter'],
  ['css-transform-generator', 'transform'],
  ['css-glassmorphism-generator', 'glass'],
  ['css-neumorphism-generator', 'neumorphism'],
  ['css-cubic-bezier-generator', 'easing'],
  ['css-loader-generator', 'loader'],
];

for (const platform of platforms) {
  for (const [id, kind] of previews) {
    test(`CSS generators ${platform}: ${id} preview`, async ({ page }) => {
      await openTool(page, platform, id);
      await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({ index: 1 });
      await expect(page.locator(`[data-css-preview="${kind}"]`)).toBeVisible();
    });
  }
}

test('CSS generators: gradient fits a 390 px viewport', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto('/tools/css-gradient-generator');
  await expect(page.locator('[data-css-preview="gradient"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390)).toBe(true);
});

const recoveries = [
  ['css-gradient-generator', /^Angle/, '999', '90', /90deg/],
  ['css-filter-generator', /^Blur/, '999', '4', /blur\(4px\)/],
  ['css-cubic-bezier-generator', /^X1/, '9', '0.5', /0\.5/],
  ['css-clamp-generator', /^Minimum size/, '0', '16', /clamp\(/],
  ['css-transform-generator', /^Translate X/, '999', '10', /translate\(10px, 0px\)/],
  ['css-glassmorphism-generator', /^Blur/, '999', '8', /\.glass \{/],
  ['css-loader-generator', /^Size/, '999', '40', /class="loader"/],
] as const;

for (const [id, label, bad, good, result] of recoveries) {
  test(`CSS generators: ${id} recovers after an out-of-range value`, async ({ page }) => {
    await page.goto(`/tools/${id}`);
    const field = page.getByRole('spinbutton', { name: label });

    await field.fill(bad);
    await expect(page.getByRole('alert')).toBeVisible();
    await field.fill(good);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Result' })).toContainText(result);
  });
}
