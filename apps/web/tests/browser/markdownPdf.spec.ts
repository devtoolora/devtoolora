import { expect, openTool, platforms, test, toolGuide, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

for (const platform of platforms) {
  test(`Markdown PDF ${platform}: offline Latin fonts, guides, actual PDF download and glyph errors`, async ({
    page,
  }) => {
    await openTool(page, platform, 'markdown-to-pdf');

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is Markdown to PDF?',
      'When to use Markdown to PDF',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Markdown to PDF' });

    await samples.selectOption({ label: 'Czech diacritics' });
    await run.click();
    const save = page.getByRole('button', { exact: true, name: 'Download document.pdf' });

    await expect(save).toBeVisible();
    const saving = page.waitForEvent('download');

    await save.click();
    const path = await (await saving).path();

    if (!path) throw new Error('Markdown PDF was not saved.');

    const pdf = await PDFDocument.load(readFileSync(path));

    expect(pdf.getTitle()).toBe('Český přehled');
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBe(595.28);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`markdown-${platform}.png`),
    });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await toolInput(page).fill('🙂');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('Unsupported character U+1F642');
    await expect(save).toHaveCount(0);
    await samples.selectOption({ label: 'Czech diacritics' });
    await run.click();
    await expect(save).toBeVisible();
  });
}
