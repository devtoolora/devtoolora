import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Prefix/Suffix Lines ${platform}: literal boundaries, indentation, blank policies and exact exports`, async ({
    page,
  }) => {
    await openTool(page, platform, 'prefix-suffix-lines');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Prefix/Suffix Lines' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Markdown bullets' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('- one\n- two\n');
    await expect(page.getByTestId('result-summary')).toContainText('2 changed lines');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`affix-${platform}.png`),
    });

    await page.getByRole('textbox', { name: /^Suffix\b/ }).fill(';');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download affixed-lines.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('- one;\n- two;\n');
    await samples.selectOption({ label: 'Comments after indentation' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  // first();\n\t// second();\n\n');
    await samples.selectOption({ label: 'Fill missing bullets' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('- one\n- two\n- three');
    await toolInput(page).fill('- one\n- two\n- three');
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 changed lines');
    await samples.selectOption({ label: 'Remove matching boundaries' });
    await expect(page.getByRole('group', { exact: true, name: 'Existing affixes' })).toHaveCount(0);
    await run.click();
    await expect.poll(() => output.textContent()).toBe('alpha\nbeta\ngamma\nplain');
    await samples.selectOption({ label: 'Include actual blank lines' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('> one\n> \n>  \n> two\n');

    await page
      .getByRole('group', { exact: true, name: 'Blank lines' })
      .getByRole('button', { exact: true, name: 'Skip' })
      .click();

    await run.click();
    await expect.poll(() => output.textContent()).toBe('> one\n\n \n> two\n');
    await samples.selectOption({ label: 'Keep mixed line endings' });
    await run.click();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download affixed-lines.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing affixed TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('- one;\r\n- two;\r- three;\n');
    await samples.selectOption({ label: 'Remove to empty' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('Warning:');
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download affixed-lines.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty affixed TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await samples.selectOption({ label: 'No-op with empty affixes' });
    await toolInput(page).fill(' \t');
    await run.click();
    await expect.poll(() => output.textContent()).toBe(' \t');
    await samples.selectOption({ label: 'Empty input is valid' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 input physical lines');
    await page.getByRole('textbox', { name: /^Prefix\b/ }).fill('x'.repeat(1_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('1,000');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download affixed-lines.txt' }),
    ).toHaveCount(0);

    await samples.selectOption({ label: 'Markdown bullets' });
    await page.getByRole('textbox', { name: /^Prefix\b/ }).fill('<script>');
    await run.click();
    await expect(output).toContainText('<script>one');
    await expect(output.locator('script, img, iframe')).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What are line prefixes and suffixes?',
      'When to use Prefix/Suffix Lines',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
