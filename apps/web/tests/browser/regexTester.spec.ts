import { expect, openTool, platforms, test, toolGuide, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Regex Tester ${platform}: visual groups, exact exports, errors, deadline and fresh-worker recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'regex-test');
    const run = page.getByRole('button', { exact: true, name: 'Run Regex Tester' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const report = page.getByRole('region', { name: 'Regex match report' });

    await samples.selectOption({ label: 'Named key-value groups' });
    await run.click();
    await expect(report.locator('mark')).toHaveCount(3);
    await expect(report).toContainText('"key": "PORT"');

    await expect(page.getByRole('region', { name: 'Replacement preview' })).toContainText(
      'PORT: "3000"',
    );

    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download regex-report.json' }).click();
    const file = await (await saving).path();

    if (!file) throw new Error('Regex report was not downloaded.');

    const exported = JSON.parse(readFileSync(file, 'utf8'));

    expect(exported.count).toBe(3);
    expect(exported.source).toBe('PORT=3000\nHOST=localhost\nDEBUG=true');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`regex-${platform}.png`),
    });

    await samples.selectOption({ label: 'Only the first match' });
    await run.click();
    await expect(report.locator('mark')).toHaveCount(1);

    await expect(page.getByRole('textbox', { name: 'Replacement text', exact: true })).toHaveCount(
      0,
    );

    await samples.selectOption({ label: 'Unicode zero-width matches' });
    await run.click();
    await expect(report.locator('mark')).toHaveText(['∅', '∅', '∅']);

    await expect(page.getByRole('region', { name: 'Replacement preview' })).toContainText(
      '|😀|😀|',
    );

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('textbox', { exact: true, name: 'Flags' }).fill('gg');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('Flags must be unique');
    await expect(report).toHaveCount(0);
    await samples.selectOption({ label: 'Empty replacement removes matches' });
    await toolInput(page).fill('123');
    await run.click();

    await expect(page.getByRole('region', { name: 'Replacement preview' })).toContainText(
      'empty replacement result',
    );

    const emptySaving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download replaced.txt' }).click();
    const emptyFile = await (await emptySaving).path();

    if (!emptyFile) throw new Error('Empty replacement was not downloaded.');

    expect(readFileSync(emptyFile)).toHaveLength(0);
    await page.getByRole('checkbox', { name: 'Preview replacement' }).uncheck();
    await page.getByRole('textbox', { exact: true, name: 'Pattern' }).fill('.+');

    await toolInput(page).fill('<img src=x onerror=alert(1)> <script>example()</script>');

    await run.click();
    await expect(report.locator('mark')).toHaveCount(1);
    await expect(report.locator('img, script')).toHaveCount(0);
    await page.getByRole('textbox', { exact: true, name: 'Pattern' }).fill('.');
    await toolInput(page).fill('a'.repeat(150));
    await run.click();
    await expect(report.locator('article')).toHaveCount(100);
    await page.getByRole('button', { exact: true, name: 'Show more matches' }).click();
    await expect(report.locator('article')).toHaveCount(150);
    const fullSaving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download regex-report.json' }).click();
    const fullFile = await (await fullSaving).path();

    if (!fullFile) throw new Error('Full regex report was not downloaded.');

    expect(JSON.parse(readFileSync(fullFile, 'utf8')).matches).toHaveLength(150);
    await page.getByRole('textbox', { exact: true, name: 'Pattern' }).fill('(a+)+$');
    await toolInput(page).fill('a'.repeat(40) + '!');
    await run.click();

    await expect(page.getByRole('alert')).toContainText('2-second execution limit', {
      timeout: 8000,
    });

    await samples.selectOption({ label: 'Only the first match' });
    await run.click();
    await expect(report.locator('mark')).toHaveCount(1);
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a regular expression?',
      'When to use Regex Tester',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
