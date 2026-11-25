import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`IBAN Validator ${platform}: registry checks, invalid reports, copy formats and saved bytes`, async ({
    page,
  }) => {
    await openTool(page, platform, 'iban-validator');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is an IBAN?',
      'When to validate an IBAN',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(
      guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
    ).toHaveCount(7);

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run IBAN Validator' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Brazil 2026 format' });
    await run.click();
    await expect(output).toContainText('BR6699999A03000010009795493C1');
    const valid = JSON.parse((await output.textContent()) ?? '{}');

    expect(valid.valid).toBe(true);
    expect(valid.structure).toBe('BR2!n8!c5!n10!n1!c1!c');
    expect(valid.registry).toContain('September 2026');
    await samples.selectOption({ label: 'Wrong check digits' });
    await run.click();
    await expect(output).toContainText('INVALID_CHECKSUM');
    const invalid = JSON.parse((await output.textContent()) ?? '{}');

    expect(invalid.valid).toBe(false);
    expect(invalid.checks.structure).toBe('pass');
    expect(invalid.checks.checksum).toBe('fail');
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download iban-report.json' }).click();
    const download = await downloading;
    const path = await download.path();

    if (!path) throw new Error('IBAN report was not saved.');

    expect(readFileSync(path, 'utf8')).toBe(await output.textContent());
    await page.screenshot({ fullPage: true, path: `test-results/iban-${platform}.png` });
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('button', { exact: true, name: 'Electronic' }).click();
    await run.click();
    await expect(page.getByRole('alert')).toContainText('IBAN is invalid. Choose Report');
    await expect(output).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'Czech registry example' });
    await run.click();
    await expect(output).toHaveText('CZ6508000000192000145399');
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download iban.txt' }).click();
    const textDownload = await saving;
    const textPath = await textDownload.path();

    if (!textPath) throw new Error('Electronic IBAN was not saved.');

    expect(readFileSync(textPath, 'utf8')).toBe('CZ6508000000192000145399');
    await samples.selectOption({ label: 'French alphanumeric BBAN' });
    await run.click();
    await expect(output).toHaveText('FR14 2004 1010 0505 0001 3M02 606');
    await samples.selectOption({ label: 'Wrong country length' });
    await run.click();
    await expect(output).toContainText('INVALID_LENGTH');
    expect(JSON.parse((await output.textContent()) ?? '{}').valid).toBe(false);
  });
}
