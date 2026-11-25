import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';

for (const platform of platforms) {
  test(`Images & Codes ${platform} image-tools: interactive preview, custom crop, and stale result clearing`, async ({
    page,
  }) => {
    await openTool(page, platform, 'image-tools');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveCount(5);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Inspect metadata & dimensions' });

    const preview = page.locator('#imageSourcePreview');

    await expect(preview).toBeVisible();
    await expect(page.locator('#sourceImage')).toBeVisible();

    await page.getByRole('button', { name: /^Run / }).click();
    const summary = page.getByTestId('result-summary');

    await expect(summary).toBeVisible();

    await page
      .getByRole('combobox', { name: 'Operation' })
      .selectOption({ label: 'Resize / crop / convert' });

    await expect(page.getByTestId('result-summary')).toHaveCount(0);

    await expect(page.getByTestId('output-placeholder')).toContainText(
      'Your result will appear here.',
    );

    await page
      .getByRole('combobox', { exact: true, name: 'Crop' })
      .selectOption({ label: 'Custom crop' });

    await expect(page.locator('#cropBox')).toBeVisible();
    await expect(page.locator('#resetCrop')).toBeVisible();
    await expect(page.locator('#cancelCrop')).toBeVisible();

    await page.getByRole('button', { name: /^Run / }).click();
    await expect(page.getByTestId('result-summary')).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`Images & Codes ${platform} wifi-qr: payload, SVG export, and fresh results`, async ({
    page,
  }) => {
    await openTool(page, platform, 'wifi-qr');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveCount(5);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Standard home WPA network' });

    await page.getByRole('button', { name: /^Run / }).click();

    const output = toolOutput(page);

    await expect(output).toContainText('WIFI:T:WPA;S:Home-WiFi;P:secret-passphrase-123;');
    const downloadBtn = page.getByRole('button', { name: /^Download / });

    await expect(downloadBtn).toBeVisible();

    await page.getByPlaceholder('Network name').fill('UpdatedNetwork');
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);

    await expect(page.getByTestId('output-placeholder')).toContainText(
      'Your result will appear here.',
    );

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
