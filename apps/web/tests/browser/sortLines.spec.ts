import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Sort Lines ${platform}: stable ties, explicit locales, blank policies, raw endings and exact exports`, async ({
    page,
  }) => {
    await openTool(page, platform, 'sort-lines');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Sort Lines' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Natural filenames' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('item1\nitem2\nitem10');
    await page.getByRole('checkbox', { name: /^Natural number groups\b/ }).uncheck();

    await expect(
      page.getByRole('button', { exact: true, name: 'Download sorted-lines.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('item1\nitem10\nitem2');
    await samples.selectOption({ label: 'Czech collation' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('cena\nčaj\nhad\nchata\nžába');
    await expect(page.getByTestId('result-summary')).toContainText('locale cs');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`sort-${platform}.png`),
    });

    await samples.selectOption({ label: 'Stable descending ties' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('zebra\nrésumé\nresume\nRESUME');
    await samples.selectOption({ label: 'Sort keys without trimming text' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('alpha\n  beta  \n\tgamma\t');
    await samples.selectOption({ label: 'Keep mixed line endings' });
    await run.click();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download sorted-lines.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing sorted TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('alpha\r\nbeta\rzebra\n');
    await samples.selectOption({ label: 'Preserve blank gap positions' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('alpha\n\nbeta\n  \nzebra\n');
    await page.getByRole('combobox', { name: /^Blank lines\b/ }).selectOption('last');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('alpha\nbeta\nzebra\n\n  \n');
    await toolInput(page).fill('\na');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('a\n');

    await expect(page.getByTestId('result-summary')).toContainText(
      '2 input physical lines · 1 output physical lines',
    );

    await expect(page.getByTestId('result-summary')).toContainText('Warning:');
    await samples.selectOption({ label: 'Exact code-point order' });
    await expect(page.getByRole('textbox', { name: /^Collation locale\b/ })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /^Natural number groups\b/ })).toHaveCount(0);
    await run.click();
    await expect.poll(() => output.textContent()).toBe('A\na\n\uE000\n😀');
    await samples.selectOption({ label: 'Natural filenames' });
    await page.getByRole('textbox', { name: /^Collation locale\b/ }).fill('en_US');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('valid, supported');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download sorted-lines.txt' }),
    ).toHaveCount(0);

    await samples.selectOption({ label: 'Remove blanks to empty' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('2 blank lines removed');
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download sorted-lines.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty sorted TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await samples.selectOption({ label: 'Empty input is valid' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 input physical lines');
    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');
    await samples.selectOption({ label: 'Natural filenames' });
    await toolInput(page).fill('<script>window.injected=true</script>\na');
    await run.click();
    await expect(output).toContainText('<script>');
    await expect(output.locator('script, img, iframe')).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is line sorting?',
      'When to use Sort Lines',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
