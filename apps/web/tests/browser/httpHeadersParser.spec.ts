import { expect, openTool, platforms, test, toolGuide, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`HTTP headers parser ${platform}: repeated values, tree, exact export and body rejection`, async ({
    page,
  }) => {
    await openTool(page, platform, 'http-headers-parser');

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveCount(5);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Response headers' });

    await page.getByRole('button', { name: /^Run / }).click();
    await expect(page.getByLabel('Interactive JSON outline')).toBeVisible();
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download http-headers.json' }).click();
    const path = await (await pending).path();

    if (!path) throw new Error('Missing HTTP header report.');

    const report = JSON.parse(readFileSync(path, 'utf8'));

    expect(report.headers['set-cookie']).toEqual(['a=demo', 'b=demo']);

    expect(report.rawHeaders.map((header: { name: string }) => header.name)).toEqual([
      'content-type',
      'set-cookie',
      'set-cookie',
    ]);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`headers-${platform}.png`),
    });

    await toolInput(page).fill('Host: example.com\n\nprivate body');
    await expect(page.getByRole('button', { name: 'Download http-headers.json' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Run / }).click();
    await expect(page.getByRole('alert')).toContainText('paste headers only');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Absolute request target' });

    await page.getByRole('button', { name: /^Run / }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('Interactive JSON outline')).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
