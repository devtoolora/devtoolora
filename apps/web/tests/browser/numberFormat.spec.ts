import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Number Formatter ${platform}: exact decimal, locale parts, precision, guides and saved bytes`, async ({
    page,
  }) => {
    await openTool(page, platform, 'number-formatter');

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is number formatting?',
      'When to format numbers',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(
      guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
    ).toHaveCount(7);

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Number Formatter' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Exact large decimal' });
    await run.click();
    await expect(output).toContainText('9007199254740993.125');
    expect(JSON.parse((await output.textContent()) ?? '{}').formatted).toBe('9007199254740993.125');
    const saving = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download number-format-report.json' })
      .click();

    const download = await saving;
    const path = await download.path();

    if (!path) throw new Error('Number formatting report was not saved.');

    expect(readFileSync(path, 'utf8')).toBe(await output.textContent());
    await samples.selectOption({ label: 'Czech price and separator report' });
    await run.click();
    await expect(output).toContainText('cs-CZ');
    const report = JSON.parse((await output.textContent()) ?? '{}');

    expect(report.formatted).toBe('1\u00a0234\u00a0567,89\u00a0Kč');

    expect(
      report.parts.find((part: { type: string; value: string }) => part.type === 'group').value,
    ).toBe('\u00a0');

    await page.screenshot({ fullPage: true, path: `test-results/number-format-${platform}.png` });
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await samples.selectOption({ label: 'Percentage 0.856' });
    await run.click();
    await expect(output).toHaveText('85.6%');
    await samples.selectOption({ label: 'Fixed trailing zeroes' });
    await run.click();
    await expect(output).toHaveText('1.500');
    await page.getByRole('button', { exact: true, name: 'Maximum' }).click();
    await run.click();
    await expect(output).toHaveText('1.5');
    const savingText = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download formatted-number.txt' }).click();
    const textDownload = await savingText;
    const textPath = await textDownload.path();

    if (!textPath) throw new Error('Formatted number was not saved.');

    expect(readFileSync(textPath, 'utf8')).toBe('1.5');
    await toolInput(page).fill('1,5');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('one ungrouped decimal number');
    await expect(output).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'Exact large decimal' });
    await run.click();
    await expect(output).toContainText('9007199254740993.125');
  });
}
