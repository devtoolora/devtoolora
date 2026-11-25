import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Number Lines ${platform}: exact sequences, padding, blank gaps, raw endings and exports`, async ({
    page,
  }) => {
    await openTool(page, platform, 'number-lines');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Number Lines' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Simple numbered list' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('1. one\n2. two\n');
    await expect(page.getByTestId('result-summary')).toContainText('numbers 1 → 2');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`number-${platform}.png`),
    });

    await page.getByRole('spinbutton', { name: /^Step\b/ }).fill('2');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download numbered-lines.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('1. one\n3. two\n');
    await samples.selectOption({ label: 'Zero-padded labels' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('007_alpha\n008_beta');
    await samples.selectOption({ label: 'Descending labels' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('3. a\n2. b\n1. c');
    await samples.selectOption({ label: 'Negative labels through zero' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('-002. a\n000. b\n002. c');
    await samples.selectOption({ label: 'Keep blank gaps unnumbered' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('1. one\n\n \n2. two\n');
    await expect(page.getByTestId('result-summary')).toContainText('2 blank lines skipped');
    await samples.selectOption({ label: 'Number actual blank rows' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('1. one\n2. \n3. two\n');
    await samples.selectOption({ label: 'Labels after indentation' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  1: alpha\n\t2: beta\n');
    await samples.selectOption({ label: 'Deliberately repeated label' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('10. one\n10. two');
    await samples.selectOption({ label: 'Preserve mixed line endings' });
    await run.click();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download numbered-lines.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing numbered TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('1. one\r\n2. two\r3. three\n');
    await samples.selectOption({ label: 'Empty input is valid' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 input physical lines');
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download numbered-lines.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty numbered TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await samples.selectOption({ label: 'Keep blank gaps unnumbered' });
    await toolInput(page).fill(' \t');
    await run.click();
    await expect.poll(() => output.textContent()).toBe(' \t');
    await expect(page.getByTestId('result-summary')).toContainText('numbers none → none');
    await samples.selectOption({ label: 'Simple numbered list' });
    await page.getByRole('spinbutton', { name: /^Start number\b/ }).fill('9007199254740991');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('safe integer range');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download numbered-lines.txt' }),
    ).toHaveCount(0);

    await page.getByRole('spinbutton', { name: /^Start number\b/ }).fill('1.5');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('decimal safe integer');
    await samples.selectOption({ label: 'Simple numbered list' });
    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');
    await samples.selectOption({ label: 'Simple numbered list' });
    await page.getByRole('textbox', { name: /^Separator\b/ }).fill('<script>');
    await run.click();
    await expect(output).toContainText('1<script>one');
    await expect(output.locator('script, img, iframe')).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is line numbering?',
      'When to use Number Lines',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
