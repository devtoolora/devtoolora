import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Deduplicate Lines ${platform}: comparison keys, retained order, blank policies and exact exports`, async ({
    page,
  }) => {
    await openTool(page, platform, 'deduplicate-lines');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Deduplicate Lines' });
    const output = toolOutput(page);

    await samples.selectOption({ label: 'First spelling wins' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('Alpha\nbeta\n');
    await expect(page.getByTestId('result-summary')).toContainText('1 duplicates removed');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`dedupe-${platform}.png`),
    });

    await page
      .getByRole('group', { exact: true, name: 'Keep occurrence' })
      .getByRole('button', { exact: true, name: 'Last occurrence' })
      .click();

    await expect(
      page.getByRole('button', { exact: true, name: 'Download deduplicated-lines.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('beta\nalpha');
    await samples.selectOption({ label: 'Case-sensitive identifiers' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('ID\nid\n');
    await samples.selectOption({ label: 'Compare padding without trimming' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  beta  \nalpha');
    await samples.selectOption({ label: 'Canonical Unicode comparison' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('cafe\u0301\ncafe');
    await page.getByRole('checkbox', { name: /^Normalize Unicode for comparison\b/ }).uncheck();
    await run.click();
    await expect.poll(() => output.textContent()).toBe('cafe\u0301\ncafé\ncafe');
    await samples.selectOption({ label: 'Keep blank spacing' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('alpha\n\n\nbeta\n');
    await page.getByRole('combobox', { name: /^Blank lines\b/ }).selectOption('deduplicate');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('alpha\n\nbeta\n');
    await samples.selectOption({ label: 'Retain raw line endings' });
    await run.click();
    const downloading = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download deduplicated-lines.txt' })
      .click();

    const path = await (await downloading).path();

    if (!path) throw new Error('Missing deduplicated TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('Alpha\r\nbeta\r');
    await samples.selectOption({ label: 'Remove blanks to empty' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('2 blank lines removed');
    const emptying = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download deduplicated-lines.txt' })
      .click();

    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty deduplicated TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await samples.selectOption({ label: 'Empty input is valid' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 input physical lines');
    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download deduplicated-lines.txt' }),
    ).toHaveCount(0);

    await samples.selectOption({ label: 'First spelling wins' });

    await toolInput(page).fill(
      '<script>window.injected=true</script>\n<script>window.injected=true</script>',
    );

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
      'What is line deduplication?',
      'When to use Deduplicate Lines',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
