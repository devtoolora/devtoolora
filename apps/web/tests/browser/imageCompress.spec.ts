import { expect, openTool, platforms, test } from './fixtures';

for (const platform of platforms) {
  test(`Image Tools ${platform}: compression presets report the size before and after`, async ({
    page,
  }) => {
    await openTool(page, platform, 'image-tools');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Export to WebP (quality 85%)' });

    await page.getByRole('combobox', { name: 'Operation' }).selectOption({ label: 'Compress' });
    const compression = page.getByRole('group', { name: 'Compression' });

    await expect(compression.getByRole('button', { name: 'Balanced' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await expect(page.getByRole('spinbutton', { name: 'Quality' })).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Width' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Export format' }).selectOption({ label: 'JPEG' });
    await compression.getByRole('button', { name: 'Smallest' }).click();
    await page.getByRole('button', { name: /^Run / }).click();
    const summary = page.getByTestId('result-summary');

    await expect(summary).toContainText('Compressed at quality 55.');

    await expect(summary).toHaveText(
      /\d+(\.\d)? (B|KiB|MiB) → \d+(\.\d)? (B|KiB|MiB), (\d+% (smaller|larger)|about the same size)\./,
    );

    await expect(page.getByTestId('result-preview')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Download .*\.jpe?g$/ })).toBeVisible();
    await compression.getByRole('button', { name: 'Custom' }).click();
    await expect(page.getByTestId('result-summary')).toHaveCount(0);
    await page.getByRole('spinbutton', { name: 'Quality' }).fill('40');
    await page.getByRole('button', { name: /^Run / }).click();
    await expect(page.getByTestId('result-summary')).toContainText('Compressed at quality 40.');
    await page.getByRole('combobox', { name: 'Export format' }).selectOption({ label: 'PNG' });
    await page.getByRole('button', { name: /^Run / }).click();

    await expect(page.getByTestId('result-summary')).toContainText(
      'PNG is lossless; choose JPEG or WebP for a smaller file.',
    );

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
