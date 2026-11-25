import { expect, openTool, platforms, test, toolGuide, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Markdown to HTML ${platform}: actual document preview, passive URLs, exact export and recovery`, async ({
    page,
  }) => {
    const requests: string[] = [];

    page.on('request', (request) => {
      if (request.url().includes('example.test')) requests.push(request.url());
    });

    await openTool(page, platform, 'markdown-to-html');

    const run = page.getByRole('button', { exact: true, name: 'Run Markdown to HTML' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const preview = page.getByRole('region', { name: 'Rendered Markdown' });

    await samples.selectOption({ label: 'Document structure' });
    await run.click();
    await expect(preview.locator('h1')).toHaveText('Release notes');
    await expect(preview.locator('ul ul li')).toHaveText('Local processing');
    await expect(preview.locator('blockquote')).toContainText('Review');
    await expect(preview.locator('pre code')).toHaveText('const ready = true;\n');
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download markdown.html' }).click();
    const file = await (await saving).path();

    if (!file) throw new Error('HTML export was not downloaded.');

    expect(readFileSync(file, 'utf8')).toContain(
      '<code class="language-js">const ready = true;\n</code>',
    );

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`markdown-html-${platform}.png`),
    });

    await samples.selectOption({ label: 'Table and strikethrough' });
    await run.click();
    await expect(preview.locator('table')).toHaveCount(1);
    await expect(preview.locator('s')).toHaveText('Old parser');
    await expect(preview.locator('th').nth(1)).toHaveCSS('text-align', 'right');
    await page.getByRole('combobox', { exact: true, name: 'Syntax' }).selectOption('commonmark');
    await run.click();
    await expect(preview.locator('table')).toHaveCount(0);
    await samples.selectOption({ label: 'References and image' });
    await run.click();
    await expect(preview).toContainText('Image: Diagram');
    await expect(preview.locator('[title="https://example.test/docs"]')).toHaveText('the guide');
    await expect(preview.locator('img, a, script, iframe')).toHaveCount(0);
    expect(requests).toEqual([]);
    await samples.selectOption({ label: 'HTML remains text' });
    await run.click();
    await expect(preview).toContainText('<script>alert("not executed")</script>');
    await expect(preview.locator('img, script, iframe, a')).toHaveCount(0);
    expect(requests).toEqual([]);
    await samples.selectOption({ label: 'Soft and hard breaks' });
    await run.click();
    await expect(preview.locator('br')).toHaveCount(2);
    await samples.selectOption({ label: 'Standalone HTML document' });

    await expect(page.getByRole('textbox', { exact: true, name: 'Document title' })).toHaveValue(
      'Notes & examples',
    );

    await run.click();

    await expect(page.getByTestId('output-panel').locator('pre code')).toContainText(
      '<title>Notes &amp; examples</title>',
    );

    const standaloneSaving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download markdown.html' }).click();
    const standaloneFile = await (await standaloneSaving).path();

    if (!standaloneFile) throw new Error('Standalone document was not downloaded.');

    expect(readFileSync(standaloneFile, 'utf8')).toContain('<!doctype html>\n<html>');
    await samples.selectOption({ label: 'Empty Markdown' });
    await expect(page.getByRole('textbox', { exact: true, name: 'Document title' })).toHaveCount(0);
    await run.click();
    await expect(preview).toContainText('Empty Markdown produces empty HTML.');
    const emptySaving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download markdown.html' }).click();
    const emptyFile = await (await emptySaving).path();

    if (!emptyFile) throw new Error('Empty HTML was not downloaded.');

    expect(readFileSync(emptyFile)).toHaveLength(0);
    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');
    await samples.selectOption({ label: 'Table and strikethrough' });
    await run.click();
    await expect(preview.locator('table')).toHaveCount(1);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is Markdown to HTML?',
      'When to use Markdown to HTML',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
