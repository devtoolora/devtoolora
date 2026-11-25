import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Zero-Width Character Detector ${platform}: source positions, scoped cleanup, raw exports and audit`, async ({
    page,
  }) => {
    await openTool(page, platform, 'zero-width-detector');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', {
      exact: true,
      name: 'Run Zero-Width Character Detector',
    });
    const output = toolOutput(page);
    const table = page.getByRole('region', { name: 'Interactive JSON table' });

    async function textSample(label: string): Promise<void> {
      await samples.selectOption({ label });

      await page
        .getByRole('group', { exact: true, name: 'Removal preview' })
        .getByRole('button', { exact: true, name: 'Cleaned text' })
        .click();
    }

    async function download(name: string): Promise<string> {
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing invisible-character download.');

      return readFileSync(path, 'utf8');
    }

    await samples.selectOption({ label: 'Emoji before hidden character' });
    await run.click();

    await expect(table.locator('tbody tr').first().getByRole('cell')).toHaveText([
      '"U+200B"',
      '"ZERO WIDTH SPACE"',
      '"common"',
      '2',
      '1',
      '3',
      '"😀[ZWSP]x"',
    ]);

    await expect(page.getByRole('combobox', { name: /^Removal scope/ })).toHaveCount(0);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`invisibles-${platform}.png`),
    });

    await toolInput(page).fill('x\u200B'.repeat(105));
    await run.click();
    await expect(table.locator('tbody tr')).toHaveCount(100);
    await table.getByRole('button', { name: /Show more/ }).click();
    await expect(table.locator('tbody tr')).toHaveCount(105);
    await table.getByRole('searchbox', { name: 'Search row values' }).fill('not-a-character');
    await expect(table.locator('tbody tr')).toHaveCount(0);
    await samples.selectOption({ label: 'Bidi display controls' });

    await page
      .getByRole('group', { exact: true, name: 'Detection output' })
      .getByRole('button', { exact: true, name: 'JSON audit' })
      .click();

    await run.click();
    const json = await download('invisible-characters.json');

    expect(json).toContain('\\u202E');
    expect(json).not.toContain('\u202E');
    expect(JSON.parse(json).result.count).toBe(4);
    expect(JSON.parse(json).originalText).toBe('name\u202Etxt\u202C\n\u2066isolated\u2069');
    await samples.selectOption({ label: 'Targeted cleanup keeps emoji' });
    await run.click();
    const changes = page.getByRole('region', { name: 'Text difference report' });

    await expect(changes).toContainText('[ZWSP]');
    await expect(changes).toContainText('[ZWJ]');

    await expect(page.getByTestId('result-summary')).toContainText(
      '6 declared characters found · 2 removed · 4 retained',
    );

    expect(await download('cleaned-invisibles.txt')).toBe('zerowidth 👨‍👩‍👧‍👦 ♥️\n');
    await textSample('Explicit joiner removal');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('👨👩👧👦');
    await page.getByRole('combobox', { name: /^Removal scope/ }).selectOption('common');

    await expect(page.getByRole('button', { name: 'Download cleaned-invisibles.txt' })).toHaveCount(
      0,
    );

    await run.click();
    await expect.poll(() => output.textContent()).toBe('👨‍👩‍👧‍👦');
    await textSample('Preserve mixed line endings');
    await run.click();
    expect(await download('cleaned-invisibles.txt')).toBe('one\r\ntwo\rthree\n');
    await textSample('Remove to empty');
    await run.click();
    expect(await download('cleaned-invisibles.txt')).toBe('');
    await expect(page.getByTestId('result-summary')).toContainText('Warning:');
    await toolInput(page).fill(' \t');
    await run.click();
    await expect.poll(() => output.textContent()).toBe(' \t');
    await toolInput(page).fill('\u200B'.repeat(10001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('10,000');

    await expect(page.getByRole('button', { name: 'Download cleaned-invisibles.txt' })).toHaveCount(
      0,
    );

    await toolInput(page).fill('<script>\u200B</script>');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('<script></script>');
    await expect(output.locator('script, img, iframe')).toHaveCount(0);
    await samples.selectOption({ label: 'Find a zero-width space' });
    await run.click();
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What are zero-width and formatting characters?',
      'When to use Zero-Width Character Detector',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
