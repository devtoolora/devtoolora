import { expect, openTool, platforms, test, toolGuide } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Text Diff ${platform}: aligned lines, exact exports, filtering and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'text-diff');
    const run = page.getByRole('button', { exact: true, name: 'Run Text Diff' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const report = page.getByRole('region', { name: 'Text difference report' });
    const before = page.getByRole('textbox', { exact: true, name: 'Before text' });
    const after = page.getByRole('textbox', { exact: true, name: 'After text' });

    await samples.selectOption({ label: 'Inserted line stays aligned' });
    await run.click();
    await expect(report.locator('article')).toHaveCount(3);
    await expect(report.locator('article h3')).toHaveText(['Unchanged', 'Added', 'Unchanged']);

    await expect(report.locator('article').last().locator('h4')).toHaveText([
      'Before 2 · LF',
      'After 3 · LF',
    ]);

    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download text-diff.json' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing JSON download.');

    const exported = JSON.parse(readFileSync(path, 'utf8'));

    expect(exported.before).toBe('one\nthree\n');
    expect(exported.after).toBe('one\ntwo\nthree\n');
    expect(exported.added).toBe(1);
    expect(exported.removed).toBe(0);
    const textDownloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download text-diff.txt' }).click();
    const textPath = await (await textDownloading).path();

    if (!textPath) throw new Error('Missing readable report download.');

    expect(readFileSync(textPath, 'utf8')).toContain('not an applyable patch');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`text-diff-${platform}.png`),
    });

    await samples.selectOption({ label: 'Changed configuration' });
    await run.click();
    await expect(report.locator('article[data-kind="changed"]')).toHaveCount(2);
    await expect(report.locator('mark')).toHaveText(['300', '808', 'fals', 'tru']);
    await samples.selectOption({ label: 'Unicode changed span' });
    await run.click();
    await expect(report.locator('mark')).toHaveText(['😀', '😃']);
    await samples.selectOption({ label: 'Equivalent under ignore options' });
    await run.click();
    await expect(report.locator('article h3')).toHaveText('Equivalent under ignore options');
    await report.getByRole('combobox', { name: 'Visible rows' }).selectOption('changes');
    await expect(report).toContainText('No changed rows under the selected comparison options.');
    await samples.selectOption({ label: 'Line endings and final newline' });
    await run.click();
    await expect(report.locator('article')).toHaveCount(2);

    await expect(report.locator('h4')).toHaveText([
      'Before 1 · CRLF',
      'After 1 · LF',
      'Before 2 · No newline',
      'After 2 · LF',
    ]);

    await samples.selectOption({ label: 'Removed line' });
    await run.click();
    const beforeBox = await report
      .locator('article')
      .first()
      .locator('[data-side="Before"]')
      .boundingBox();
    const afterBox = await report
      .locator('article')
      .first()
      .locator('[data-side="After"]')
      .boundingBox();

    expect(afterBox!.y).toBeGreaterThan(beforeBox!.y);
    await samples.selectOption({ label: 'Inserted line stays aligned' });
    const source = Array.from({ length: 150 }, (_, index) => `line ${index}\n`).join('');

    await before.fill(source);
    await after.fill(`inserted\n${source}`);
    await run.click();
    await expect(report.locator('article')).toHaveCount(100);
    await report.getByRole('button', { name: 'Show more rows' }).click();
    await expect(report.locator('article')).toHaveCount(151);
    await report.getByRole('combobox', { name: 'Visible rows' }).selectOption('changes');
    await expect(report.locator('article')).toHaveCount(1);
    await before.fill('<img src="https://example.test/secret" onerror="alert(1)">');
    await after.fill('<script>alert(2)</script>');
    await run.click();

    await expect(report).toContainText(
      '<img src="https://example.test/secret" onerror="alert(1)">',
    );

    await expect(report.locator('img, script, iframe')).toHaveCount(0);
    await samples.selectOption({ label: 'Both texts empty' });
    await run.click();
    await expect(report).toContainText('Both texts are empty. No differences.');
    await before.fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');
    await samples.selectOption({ label: 'Inserted line stays aligned' });
    await run.click();
    await expect(report.locator('article')).toHaveCount(3);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a text diff?',
      'When to use Text Diff',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
