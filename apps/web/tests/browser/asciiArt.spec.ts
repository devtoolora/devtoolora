import { expect, openTool, platforms, test, toolGuide, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`ASCII banners ${platform}: spacing, exact exports, Unicode errors and unwrapped narrow preview`, async ({
    page,
  }) => {
    await openTool(page, platform, 'ascii-text-generator');

    const preview = page.getByRole('region', { name: 'ASCII art preview' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const input = toolInput(page);

    await samples.selectOption({ label: 'Hello' });
    await expect(preview).toContainText('_');

    await expect(
      page.getByRole('button', { exact: true, name: 'Run ASCII Text Generator' }),
    ).toHaveCount(0);

    const original = await preview.textContent();

    await page
      .getByRole('group', { name: 'Horizontal spacing', exact: true })
      .getByRole('button', { name: 'Full spacing', exact: true })
      .click();

    await expect(preview).not.toHaveText(original ?? '');
    const expanded = await preview.textContent();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download ascii-art.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing ASCII TXT download.');

    expect(readFileSync(path, 'utf8')).toBe(expanded);
    await samples.selectOption({ label: 'Stacked labels' });
    await expect(preview).toHaveText(/[\s\S]*\n[\s\S]*\n[\s\S]*/);

    await expect(
      page
        .getByRole('group', { name: 'Vertical spacing', exact: true })
        .getByRole('button', { name: 'Full spacing', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');

    await samples.selectOption({ label: 'Czech accents explicitly removed' });
    await expect(preview).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Exact text' }).click();
    await expect(page.getByRole('alert')).toContainText('cannot render');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download ascii-art.txt' }),
    ).toHaveCount(0);

    await input.fill('Hi😀');
    await expect(page.getByRole('alert')).toContainText('U+1F600');
    await samples.selectOption({ label: 'Unicode block font' });
    await expect(preview).toContainText('█');
    await samples.selectOption({ label: 'Hello' });
    await expect(preview).toBeVisible();
    await input.fill('W'.repeat(60));
    await expect(page.getByTestId('result-summary')).toContainText('exact input characters');
    await expect(preview).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    expect(await preview.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('pre');

    expect(await preview.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );

    await preview.evaluate((element) => {
      element.scrollLeft = 100;
    });

    expect(await preview.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await samples.selectOption({ label: 'Hello' });
    await expect(preview).toContainText('_');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`ascii-${platform}.png`),
    });

    await input.fill('');
    await expect(preview).toHaveCount(0);

    await expect(
      page.getByRole('button', { exact: true, name: 'Download ascii-art.txt' }),
    ).toHaveCount(0);

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a FIGlet text banner?',
      'When to use ASCII Text Generator',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
