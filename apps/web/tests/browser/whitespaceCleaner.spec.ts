import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Whitespace Cleaner ${platform}: visible changes, raw terminators, exact empty exports and report`, async ({
    page,
  }) => {
    await openTool(page, platform, 'whitespace-cleaner');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Whitespace Cleaner' });
    const report = page.getByRole('region', { name: 'Text difference report' });

    await samples.selectOption({ label: 'Preserve code indentation' });
    await run.click();
    await expect(report).toContainText('↹console.log');
    await expect(report).toContainText('greet()·{··');
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download cleaned-text.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing cleaned TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('function greet() {\n\tconsole.log("Hello");\n}\n');
    await samples.selectOption({ label: 'Normalize mixed CRLF and CR to LF' });

    await expect(
      page.getByRole('button', { exact: true, name: 'Download cleaned-text.txt' }),
    ).toHaveCount(0);

    await run.click();

    await expect(report.locator('[data-side="Before"] h4')).toHaveText([
      'Before 1 · CRLF',
      'Before 2 · CR',
      'Before 3 · LF',
    ]);

    await expect(report.locator('[data-side="After"] h4')).toHaveText([
      'After 1 · LF',
      'After 2 · LF',
      'After 3 · LF',
    ]);

    await page.getByRole('button', { exact: true, name: 'Preserve' }).click();
    await run.click();
    const preserving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download cleaned-text.txt' }).click();
    const preservedPath = await (await preserving).path();

    if (!preservedPath) throw new Error('Missing preserved TXT download.');

    expect(readFileSync(preservedPath, 'utf8')).toBe('one\r\ntwo\rthree\n');
    await samples.selectOption({ label: 'Full audit report' });
    await run.click();
    await expect(toolOutput(page)).toContainText('"originalText"');
    const auditing = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download whitespace-report.json' })
      .click();

    const reportPath = await (await auditing).path();

    if (!reportPath) throw new Error('Missing audit JSON download.');

    const audit = JSON.parse(readFileSync(reportPath, 'utf8'));

    expect(audit.originalText).toBe('  one  \r\n\ttwo \r\n');
    expect(audit.cleanedText).toBe('  one\r\n\ttwo\r\n');
    expect(audit.comparison.rows[0].before.text).toBe('  one  ');
    await samples.selectOption({ label: 'Whitespace-only becomes empty' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('→ 0 code points');
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download cleaned-text.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download cleaned-text.txt' }),
    ).toHaveCount(0);

    await samples.selectOption({ label: 'Keep Markdown hard breaks' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('Unchanged');
    await page.getByRole('button', { exact: true, name: 'Cleaned text' }).click();
    await run.click();

    await expect.poll(() => toolOutput(page).textContent()).toBe('First line  \nSecond line\n');

    await samples.selectOption({ label: 'Preserve code indentation' });

    await toolInput(page).fill(
      Array.from({ length: 125 }, (_, index) => `row${index}  `).join('\n'),
    );

    await run.click();
    await expect(report.locator('article')).toHaveCount(100);
    await report.getByRole('button', { exact: true, name: 'Show more rows' }).click();
    await expect(report.locator('article')).toHaveCount(125);
    await toolInput(page).fill('<script>window.injected=true</script>  ');
    await run.click();
    await expect(report).toContainText('<script>');
    await expect(report.locator('script, img, iframe')).toHaveCount(0);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`whitespace-${platform}.png`),
    });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is whitespace cleaning?',
      'When to use Whitespace Cleaner',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
