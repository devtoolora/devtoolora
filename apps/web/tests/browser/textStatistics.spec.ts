import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Text statistics ${platform}: Unicode counts, full export, empty input and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'text-statistics');

    const run = page.getByRole('button', { exact: true, name: 'Run Text Statistics' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Emoji and joined family' });
    await run.click();
    await expect(output).toContainText('"graphemes": 3');
    let stats = JSON.parse((await output.textContent()) ?? '{}');

    expect(stats.characters).toBe(9);
    expect(stats.utf16Units).toBe(14);
    expect(stats.bytes).toBe(30);
    expect(stats.readingTimeSeconds).toBe(0);
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download text-statistics.json' }).click();
    const file = await (await saving).path();

    if (!file) throw new Error('Text statistics export was not saved.');

    expect(readFileSync(file, 'utf8')).toBe(await output.textContent());
    await samples.selectOption({ label: 'Blank lines and trailing newline' });
    await run.click();
    await expect(output).toContainText('"lines": 5');
    stats = JSON.parse((await output.textContent()) ?? '{}');
    expect(stats.nonEmptyLines).toBe(2);
    expect(stats.wordsPerMinute).toBe(100);
    await samples.selectOption({ label: 'Czech and combining accents' });
    await run.click();
    await expect(output).toContainText('Visible characters (graphemes):');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`text-statistics-${platform}.png`),
    });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('spinbutton', { name: 'Reading speed (words/minute)' }).fill('49');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('Reading speed');
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'Empty text' });
    await expect(run).toBeEnabled();
    await run.click();
    await expect(output).toContainText('Words: 0');
    await expect(output).toContainText('Estimated reading time: 0 seconds');
    await page.getByRole('button', { exact: true, name: 'JSON' }).click();
    await run.click();
    await expect(output).toContainText('"graphemes": 0');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What are text statistics?',
      'When to measure text',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
