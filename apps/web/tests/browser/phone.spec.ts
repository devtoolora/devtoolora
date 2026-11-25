import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Phone Formatter ${platform}: national rules, extension, guides, saved bytes and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'phone-formatter');

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is phone number formatting?',
      'When to format phone numbers',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(
      guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
    ).toHaveCount(7);

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Phone Formatter' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'UK trunk prefix' });
    await run.click();
    await expect(output).toContainText('+442079460018');
    const report = JSON.parse((await output.textContent()) ?? '{}');

    expect(report.country).toBe('GB');
    expect(report.national).toBe('020 7946 0018');
    expect(report.valid).toBe(true);
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download phone-report.json' }).click();
    const download = await saving;
    const path = await download.path();

    if (!path) throw new Error('Phone report was not saved.');

    expect(readFileSync(path, 'utf8')).toBe(await output.textContent());
    await samples.selectOption({ label: 'Czech national number' });
    await run.click();
    await expect(output).toHaveText('+420601123456');
    await samples.selectOption({ label: 'Desk extension' });
    await run.click();
    await expect(output).toHaveText('tel:+14155550134;ext=123');
    const savingUri = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download phone-number.txt' }).click();
    const uriDownload = await savingUri;
    const uriPath = await uriDownload.path();

    if (!uriPath) throw new Error('Phone URI was not saved.');

    expect(readFileSync(uriPath, 'utf8')).toBe('tel:+14155550134;ext=123');
    await page.screenshot({ fullPage: true, path: `test-results/phone-${platform}.png` });
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await toolInput(page).fill('Call +14155550134 now');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('not prose or a vanity number');
    await expect(output).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'Italy significant zero' });
    await run.click();
    await expect(output).toContainText('+390212345678');

    await expect(page.getByRole('button', { exact: true, name: 'Report' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
