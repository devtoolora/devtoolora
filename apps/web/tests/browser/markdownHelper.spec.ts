import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Markdown Helper ${platform}: parsed counts, protected code, clean export, error and empty recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'markdown-helper');

    const run = page.getByRole('button', { exact: true, name: 'Run Markdown Helper' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Headings and reference links' });
    await run.click();
    await expect(output).toContainText('"headings": 2');
    const report = JSON.parse((await output.textContent()) ?? '{}');

    expect(report.links).toBe(2);
    expect(report.images).toBe(1);
    expect(report.codeBlocks).toBe(1);
    await samples.selectOption({ label: 'Protect HTML code examples' });
    await run.click();
    await expect(output).toContainText('<script>example()</script>');

    expect(await output.textContent()).toContain(
      '<script>example()</script>\n\n\n<div>Keep blank lines</div>',
    );

    await expect(page.getByTestId('output-panel').locator('script')).toHaveCount(0);
    const converted = await output.textContent();
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download cleaned.md' }).click();
    const file = await (await saving).path();

    if (!file) throw new Error('Clean Markdown was not downloaded.');

    expect(readFileSync(file, 'utf8')).toBe(converted);
    expect(converted).not.toContain('Headings:');
    await samples.selectOption({ label: 'Remove complete HTML blocks' });
    await run.click();
    await expect(output).toContainText('Ordinary Markdown remains.');
    expect(await output.textContent()).not.toContain('alert(');
    await samples.selectOption({ label: 'Retain raw HTML without rendering' });
    await run.click();
    await expect(output).toContainText('<em>HTML</em>');
    await expect(page.getByTestId('output-panel').locator('em')).toHaveCount(0);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`markdown-helper-${platform}.png`),
    });

    await samples.selectOption({ label: 'Remove complete HTML blocks' });
    await toolInput(page).fill('- a\n\t<b>next</b>\n');
    await run.click();
    await expect(output).toHaveText('- a\n\tnext\n');
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'Empty Markdown' });
    await expect(run).toBeEnabled();
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('empty result');
    const emptySaving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download cleaned.md' }).click();
    const emptyFile = await (await emptySaving).path();

    if (!emptyFile) throw new Error('Empty Markdown was not downloaded.');

    expect(readFileSync(emptyFile)).toHaveLength(0);
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is Markdown cleanup?',
      'When to use Markdown Helper',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
