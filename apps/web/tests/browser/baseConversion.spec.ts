import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Base Converter ${platform}: exact integers, guides, output modes and invalid-input recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'base-converter');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a numeral base?',
      'When to use Base Converter',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(
      guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
    ).toHaveCount(7);

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const output = toolOutput(page);
    const run = page.getByRole('button', { exact: true, name: 'Run Base Converter' });

    await samples.selectOption({ label: 'Exact 64-bit integer' });
    await run.click();
    await expect(output).toContainText('ffffffffffffffff');
    const report = JSON.parse((await output.textContent()) ?? '{}');

    expect(report.output).toBe('ffffffffffffffff');
    expect(report.decimal).toBe('18446744073709551615');
    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download base-conversion.json' }).click();
    const download = await downloadPromise;
    const path = await download.path();

    if (!path) throw new Error('Base conversion artifact was not saved.');

    expect(download.suggestedFilename()).toBe('base-conversion.json');
    expect(readFileSync(path, 'utf8')).toBe(await output.textContent());
    await samples.selectOption({ label: 'Negative integer' });

    await expect(
      page.getByRole('button', { exact: true, name: 'Converted value' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await run.click();
    await expect(output).toHaveText('-101010');
    await page.screenshot({ fullPage: true, path: `test-results/base-converter-${platform}.png` });
    await page.setViewportSize({ height: 844, width: 390 });

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await samples.selectOption({ label: 'Binary prefix' });
    await page.getByRole('textbox', { exact: true, name: 'Value' }).fill('102');
    await run.click();

    await expect(page.getByRole('alert')).toContainText(
      'Invalid digit "2" at position 3 in base 2',
    );

    await expect(output).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await page.getByRole('textbox', { exact: true, name: 'Value' }).fill('0b11111111');
    await run.click();
    await expect(output).toHaveText('ff');
  });
}
