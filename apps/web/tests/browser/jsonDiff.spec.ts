import { expect, openTool, platforms, test, toolGuide } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`JSON Diff ${platform}: structural changes, filters, exact decimals, full export and error recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'json-diff');
    const run = page.getByRole('button', { exact: true, name: 'Run JSON Diff' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });

    await samples.selectOption({ label: 'Added removed and array index changes' });
    await run.click();
    const report = page.getByRole('region', { name: 'JSON difference report' });

    await expect(report.locator('article')).toHaveCount(5);
    await expect(report.locator('article[data-kind="added"]')).toHaveCount(2);
    await expect(report.locator('article[data-kind="removed"]')).toHaveCount(1);
    await report.getByRole('combobox', { name: 'Show changes' }).selectOption('removed');
    await expect(report.locator('article')).toHaveCount(1);
    await expect(report).toContainText('null');
    await expect(report).toContainText('Missing');
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download json-diff.txt' }).click();
    const path = await (await saving).path();

    if (!path) throw new Error('JSON diff text was not saved.');

    const text = readFileSync(path, 'utf8');

    expect(text).toContain('Added "/added"');
    expect(text).toContain('Changed "/tags/1"');
    await samples.selectOption({ label: 'Precise IDs and equivalent decimals' });
    await run.click();
    await expect(report.locator('article')).toHaveCount(1);
    await expect(report).toContainText('9007199254740993');
    await page.getByRole('button', { exact: true, name: 'Exact token' }).click();
    await run.click();
    await expect(report.locator('article')).toHaveCount(2);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`json-diff-${platform}.png`),
    });

    await samples.selectOption({ label: 'Equivalent reordered JSON' });
    await run.click();
    await expect(report).toContainText('No differences.');
    await samples.selectOption({ label: 'Escaped JSON Pointers' });
    await run.click();
    const savingJson = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download json-diff.json' }).click();
    const jsonPath = await (await savingJson).path();

    if (!jsonPath) throw new Error('JSON diff report was not saved.');

    expect(
      JSON.parse(readFileSync(jsonPath, 'utf8')).changes.map(
        (entry: { pointer: string }) => entry.pointer,
      ),
    ).toEqual(['/', '/a~1b~0c']);

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('textbox', { name: 'Right JSON', exact: true }).fill('{\n"a":1,\n}');
    await run.click();

    await expect(page.getByRole('alert')).toContainText(
      'Right JSON: Invalid JSON at line 3, column 1',
    );

    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'HTML is only text' });
    await run.click();
    await expect(report.locator('img,script')).toHaveCount(0);
    await expect(report).toContainText('<script>alert(1)</script>');

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page
      .getByRole('textbox', { name: 'Left JSON', exact: true })
      .fill(JSON.stringify(Array(300).fill(0)));

    await page
      .getByRole('textbox', { name: 'Right JSON', exact: true })
      .fill(JSON.stringify(Array(300).fill(1)));

    await run.click();
    await expect(report.locator('article')).toHaveCount(200);
    await report.getByRole('button', { exact: true, name: 'Show more' }).click();
    await expect(report.locator('article')).toHaveCount(300);
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a JSON diff?',
      'When to compare JSON',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
