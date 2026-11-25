import { expect, openTool, platforms, test, toolGuide } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Lorem Ipsum ${platform}: precise units, real preview, exact exports and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'lorem-ipsum');
    const preview = page.getByRole('region', { name: 'Lorem Ipsum preview' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const amount = page.getByRole('spinbutton', { name: /^Amount\b/ });

    await expect(preview.locator('article p')).toHaveCount(2);
    await expect(page.getByRole('button', { exact: true, name: 'Run Lorem Ipsum' })).toHaveCount(0);
    await samples.selectOption({ label: 'Three short paragraphs' });
    await expect(preview.locator('article p')).toHaveCount(3);
    await expect(preview.locator('article p').first()).toContainText('Sed do eiusmod');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`lorem-${platform}.png`),
    });

    await samples.selectOption({ label: 'Five-word card' });
    await expect(preview.locator('article p')).toHaveText(['Lorem ipsum dolor sit amet,']);

    await expect(page.getByRole('spinbutton', { name: /^Sentences per paragraph\b/ })).toHaveCount(
      0,
    );

    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download lorem-ipsum.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('Lorem ipsum dolor sit amet,');
    await amount.fill('5000');
    await expect(preview.locator('article p')).toHaveText([/^Lorem ipsum[\s\S]{20000,}$/]);
    expect((await preview.locator('article p').textContent())?.split(/\s+/)).toHaveLength(5000);
    await amount.fill('5001');
    await expect(page.getByRole('alert')).toContainText('5,000');
    await samples.selectOption({ label: 'HTML paragraphs' });

    await expect(page.getByTestId('output-panel').locator('pre code')).toContainText(
      '<p>Lorem ipsum',
    );

    await expect(preview).toHaveCount(0);
    const htmlDownloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download lorem-ipsum.html' }).click();
    const htmlPath = await (await htmlDownloading).path();

    if (!htmlPath) throw new Error('Missing HTML download.');

    const html = readFileSync(htmlPath, 'utf8');

    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).not.toContain('<html');
    expect(html).not.toContain('repeatable bundled content');
    await samples.selectOption({ label: 'Markdown paragraphs' });

    await expect(
      page.getByRole('button', { exact: true, name: 'Download lorem-ipsum.html' }),
    ).toHaveCount(0);

    await expect(
      page.getByRole('button', { exact: true, name: 'Download lorem-ipsum.md' }),
    ).toBeVisible();

    const markdownDownloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download lorem-ipsum.md' }).click();
    const markdownPath = await (await markdownDownloading).path();

    if (!markdownPath) throw new Error('Missing Markdown download.');

    expect(readFileSync(markdownPath, 'utf8').split('\n\n')).toHaveLength(2);
    await amount.fill('0');
    await expect(page.getByRole('alert')).toContainText('whole number');
    await samples.selectOption({ label: 'Short (3 sentences)' });
    await expect(preview.locator('article p')).toHaveCount(1);
    await expect(preview.locator('article p')).toContainText('Lorem ipsum');

    await expect(
      page.getByRole('spinbutton', { name: /^Sentences per paragraph\b/ }),
    ).toBeVisible();

    await expect(preview.locator('img, a, script, iframe')).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is Lorem Ipsum?',
      'When to use Lorem Ipsum',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
