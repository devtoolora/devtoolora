import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Text Reverser ${platform}: graphemes, separator choices, raw line endings, exact exports and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'text-reverser');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Text Reverser' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Accents and joined emoji' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('👩🏽‍💻 e\u0301faC');
    await expect(page.getByRole('group', { exact: true, name: 'Word spacing' })).toHaveCount(0);
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download reversed-text.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing reversed TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('👩🏽‍💻 e\u0301faC');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`reverser-${platform}.png`),
    });

    await samples.selectOption({ label: 'Inspect decomposed code points' });

    await expect(
      page.getByRole('button', { exact: true, name: 'Download reversed-text.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('\u0301e');
    await samples.selectOption({ label: 'Words with exact separators' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  three   two\tone ');
    await expect(page.getByRole('group', { exact: true, name: 'Character unit' })).toHaveCount(0);
    await page.getByRole('button', { exact: true, name: 'Reverse separators too' }).click();
    await run.click();
    await expect.poll(() => output.textContent()).toBe(' three\ttwo   one  ');
    await samples.selectOption({ label: 'Characters within CRLF lines' });
    await run.click();
    const lineDownloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download reversed-text.txt' }).click();
    const linePath = await (await lineDownloading).path();

    if (!linePath) throw new Error('Missing line-body TXT download.');

    expect(readFileSync(linePath, 'utf8')).toBe('cba\r\nfed\n');
    await samples.selectOption({ label: 'Reverse mixed-ending lines' });
    await run.click();
    await expect(page.getByRole('group', { exact: true, name: 'Scope' })).toHaveCount(0);
    await expect(page.getByRole('group', { exact: true, name: 'Character unit' })).toHaveCount(0);
    await expect(page.getByRole('group', { exact: true, name: 'Word spacing' })).toHaveCount(0);
    const mixedDownloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download reversed-text.txt' }).click();
    const mixedPath = await (await mixedDownloading).path();

    if (!mixedPath) throw new Error('Missing mixed-ending TXT download.');

    expect(readFileSync(mixedPath, 'utf8')).toBe('three\r\ntwo\rone\n');
    await samples.selectOption({ label: 'Whitespace stays exact' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('\r\n\t ');
    await samples.selectOption({ label: 'Empty input is valid' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 graphemes');
    const emptyDownloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download reversed-text.txt' }).click();
    const emptyPath = await (await emptyDownloading).path();

    if (!emptyPath) throw new Error('Missing empty TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');
    await samples.selectOption({ label: 'Simple letters' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('cba');

    await page
      .getByRole('group', { exact: true, name: 'Reverse' })
      .getByRole('button', { exact: true, name: 'Words' })
      .click();

    await toolInput(page).fill('<script>window.injected=true</script>');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('<script>window.injected=true</script>');
    await expect(output.locator('script, img, iframe')).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is text reversal?',
      'When to use Text Reverser',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
