import { expect, openTool, platforms, test, toolOutput, type Page } from './fixtures';
import { readFileSync } from 'node:fs';

async function download(page: Page, name: string): Promise<string> {
  const pending = page.waitForEvent('download');

  await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
  const path = await (await pending).path();

  if (!path) throw new Error('Missing palette/motion download.');

  return readFileSync(path, 'utf8');
}

for (const platform of platforms) {
  test(`CSS Keyframes ${platform}: reduced motion, playback, fractions and exact exports`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTool(page, platform, 'css-keyframes-generator');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });

    await samples.selectOption({ label: 'Pulse loop' });
    await page.keyboard.press('Control+Enter');
    const card = page.locator('[data-css-preview="keyframes"]');

    await expect(card).toHaveCSS('animation-play-state', 'paused');
    await page.getByRole('button', { exact: true, name: 'Play' }).click();
    await expect(card).toHaveCSS('animation-play-state', 'running');
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(card).toHaveCSS('animation-play-state', 'paused');
    await samples.selectOption({ label: 'Half iteration' });
    await page.keyboard.press('Control+Enter');
    await expect(card).toHaveCSS('animation-iteration-count', '0.5');
    const css = await download(page, 'keyframes.css');

    expect(css).toBe(await toolOutput(page).textContent());
    expect(JSON.parse(await download(page, 'css-keyframes-report.json')).css).toBe(css);
    await page.getByRole('button', { exact: true, name: 'Play' }).click();

    await expect
      .poll(() => card.evaluate((element) => Number(getComputedStyle(element).opacity)))
      .toBeGreaterThan(0.2);

    await page.getByRole('button', { name: 'Pause' }).click();

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-motion-${platform}.png`),
    });

    await page.getByRole('textbox', { exact: true, name: 'Animation name' }).fill('none');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('identifier');
    await expect(page.getByRole('button', { name: 'Download keyframes.css' })).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`CSS Palette ${platform}: exact base, real swatches, neutral hues and exports`, async ({
    page,
  }) => {
    await openTool(page, platform, 'color-palette');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });

    await samples.selectOption({ label: 'Tailwind blue' });
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('[data-palette-token="base-500"]')).toContainText('#2563eb');
    const report = JSON.parse(await download(page, 'color-palette.json'));

    expect(report.palette.base.shades['500']).toBe('#2563eb');
    expect(await download(page, 'color-palette.css')).toContain('--base-500: #2563eb;');

    await expect(page.getByRole('region', { name: 'Palette preview' })).toContainText(
      'normal text AA pass',
    );

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`css-palette-${platform}.png`),
    });

    await samples.selectOption({ label: 'Neutral gray' });
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('[data-palette-token="accent1-500"]')).toContainText('#808080');
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('textbox', { exact: true, name: 'Base color' }).fill('rgba(0,0,0,0.5)');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('[data-palette-token]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download color-palette.css' })).toHaveCount(0);
  });
}
