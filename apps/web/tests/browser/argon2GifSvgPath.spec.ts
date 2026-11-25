import {
  expect,
  openToolWithSample,
  platforms,
  test,
  toolInput,
  toolOutput,
  type Page,
} from './fixtures';
import { readFileSync } from 'node:fs';
import { decodeGif } from '../../../../packages/functions/src/image/gif';
import { defineToolSmokeTests, type SmokeTool } from './toolSmokeTests';

const tools: SmokeTool[] = [
  {
    autoRun: false,
    id: 'argon2-hash',
    inputless: true,
    name: 'Argon2 Hash & Verify',
    result: /\$argon2id\$v=19\$/,
  },
  {
    autoRun: false,
    id: 'gif-maker',
    inputless: true,
    name: 'Images to GIF',
    result: /frames/,
  },
  { autoRun: true, id: 'svg-path-editor', name: 'SVG Path Editor' },
];

defineToolSmokeTests('Argon2, GIF and SVG path tools', tools);

const result = (page: Page) => page.getByRole('region', { name: 'Result' });
const runButton = (page: Page, name: string) =>
  page.getByRole('button', { exact: true, name: `Run ${name}` });

for (const platform of platforms) {
  test(`Argon2, GIF and SVG path tools ${platform}: gif sample downloads a GIF that decodes to 3 frames`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'gif-maker');
    await runButton(page, 'Images to GIF').click();
    await expect(result(page)).toContainText(/frames · .* · \d+\.\d kB\./);
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download 01.gif' }).click();
    const download = await pending;
    const gif = decodeGif(new Uint8Array(readFileSync(await download.path())));

    expect(download.suggestedFilename()).toBe('01.gif');
    expect(gif.frameCount).toBe(3);
  });

  test(`Argon2, GIF and SVG path tools ${platform}: argon2 verify of the known hash matches`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'argon2-hash', 'Verify a known hash');
    await runButton(page, 'Argon2 Hash & Verify').click();
    await expect(result(page)).toContainText('Match');
    await expect(result(page)).not.toContainText('No match');
    await expect(result(page).getByRole('status')).toContainText('Match');
  });

  test(`Argon2, GIF and SVG path tools ${platform}: path preview draws point markers`, async ({
    page,
  }) => {
    await openToolWithSample(page, platform, 'svg-path-editor');
    const preview = page.getByRole('region', { name: 'Path preview' });
    const points = preview.getByRole('listitem');

    await expect(preview.locator('svg g circle').first()).toBeVisible();
    const kinds = await points.allTextContents();
    const ends = kinds.filter((text) => /^Point \d+: end /.test(text)).length;
    const controls = kinds.filter((text) => /^Point \d+: control /.test(text)).length;

    expect(ends).toBeGreaterThanOrEqual(1);
    expect(controls).toBeGreaterThanOrEqual(1);
    await expect(preview.locator('svg g circle')).toHaveCount(ends);
    await expect(preview.locator('svg g rect')).toHaveCount(controls);
  });

  test(`Argon2, GIF and SVG path tools ${platform}: invalid input recovers`, async ({ page }) => {
    await openToolWithSample(page, platform, 'argon2-hash', 'Verify a known hash');
    const hash = page.getByLabel('Hash', { exact: true });
    const valid = await hash.inputValue();
    const run = runButton(page, 'Argon2 Hash & Verify');

    await hash.fill(valid.replace('$v=19$', '$v=16$'));
    await run.click();

    await expect(page.getByRole('alert')).toContainText(
      'Argon2 version 16 (1.0) is not supported.',
    );

    await hash.fill(valid);
    await run.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(result(page)).toContainText('Match');

    await openToolWithSample(page, platform, 'gif-maker');
    const delay = page.getByRole('spinbutton', { name: /Delay/ });
    const gifRun = runButton(page, 'Images to GIF');

    await delay.fill('10');
    await gifRun.click();
    await expect(page.getByRole('alert')).toBeVisible();
    await delay.fill('100');
    await gifRun.click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(result(page)).toContainText('frames');

    await openToolWithSample(page, platform, 'svg-path-editor');
    const input = toolInput(page);
    const path = await input.inputValue();
    const output = toolOutput(page);

    await expect(output).not.toBeEmpty();
    const expected = (await output.textContent()) ?? '';

    await input.fill('M0 0 L1');

    await expect(page.getByRole('alert')).toContainText(
      'Invalid path data at character 8: expected a number.',
    );

    await input.fill(path);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(output).toHaveText(expected);
    await expect(page.getByRole('region', { name: 'Path preview' }).locator('svg')).toBeVisible();
  });

  test(`Argon2, GIF and SVG path tools ${platform}: a Run error scrolls into view and takes focus`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 720, width: 1280 });
    await openToolWithSample(page, platform, 'gif-maker');
    await expect(page.locator('.selected-file-name')).toHaveText('3 files selected');
    await page.getByRole('spinbutton', { name: 'Delay (ms)' }).fill('10');
    await runButton(page, 'Images to GIF').click();
    const alert = page.getByRole('alert');

    await expect(alert).toContainText('Each delay must be from 20 to 60,000 ms.');
    await expect(alert).toBeInViewport();
    await expect(alert).toBeFocused();
  });

  test(`Argon2, GIF and SVG path tools ${platform}: tools fit a 390 px viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });

    const cases: [string, string, RegExp, boolean][] = [
      ['argon2-hash', 'Argon2 Hash & Verify', /\$argon2id\$v=19\$/, false],
      ['gif-maker', 'Images to GIF', /frames/, false],
      ['svg-path-editor', 'SVG Path Editor', /M/, true],
    ];

    for (const [id, name, text, autoRun] of cases) {
      await openToolWithSample(page, platform, id);
      if (!autoRun) await runButton(page, name).click();

      await expect(result(page)).toContainText(text);

      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
  });
}
