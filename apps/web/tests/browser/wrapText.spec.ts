import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Wrap/Unwrap Text ${platform}: graphemes, paragraph rules, raw terminators, exact export and audit`, async ({
    page,
  }) => {
    await openTool(page, platform, 'wrap-text');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Wrap/Unwrap Text' });
    const output = toolOutput(page);

    const input = toolInput(page);

    async function applyTextSample(label: string): Promise<void> {
      const before = await input.inputValue();

      await samples.selectOption({ label });
      // Running before the sample reaches the input state reads the previous text.
      await expect(input).not.toHaveValue(before);

      await page
        .getByRole('group', { exact: true, name: 'Preview' })
        .getByRole('button', { exact: true, name: 'Result text' })
        .click();
    }

    await samples.selectOption({ label: 'Wrap plain prose' });
    // Running before the sample reaches the input state leaves an empty diff report.
    await expect(input).not.toHaveValue('');
    await run.click();
    const changes = page.getByRole('region', { name: 'Text difference report' });

    await expect(changes).toBeVisible();
    await expect(changes).toContainText('one two');
    await expect(page.getByTestId('result-summary')).toContainText('3 inserted breaks');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`wrap-${platform}.png`),
    });

    await applyTextSample('Keep interior spacing');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('one  two\tthree  \n');
    await page.getByRole('spinbutton', { name: /^Width in graphemes\b/ }).fill('10');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download reflowed-text.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('one  two\nthree  \n');
    await applyTextSample('Explicit spacing cleanup');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  one two three\n');
    await applyTextSample('Preserve continuation indentation');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  one two\n  three\n  four\n');
    await applyTextSample('Grapheme-safe long tokens');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('👨‍👩‍👧‍👦🇨🇿\ne\u0301👍🏽\n');
    await applyTextSample('Keep long URL intact');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('https://example.test/path');
    await expect(page.getByTestId('result-summary')).toContainText('1 over-width lines');
    await applyTextSample('Join within paragraphs');
    await expect(page.getByRole('spinbutton', { name: /^Width in graphemes\b/ })).toHaveCount(0);
    await expect(page.getByRole('group', { exact: true, name: 'Long tokens' })).toHaveCount(0);
    await run.click();
    await expect.poll(() => output.textContent()).toBe('one two\r\n\r\nthree four\n');
    await expect(page.getByTestId('result-summary')).toContainText('2 joined breaks');
    await applyTextSample('Join across blank separators');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('one two\n');

    await page
      .getByRole('group', { exact: true, name: 'Spacing' })
      .getByRole('button', { exact: true, name: 'Collapse ASCII spacing' })
      .click();

    await run.click();
    await expect.poll(() => output.textContent()).toBe('one two\n');
    await applyTextSample('Join fragments without separator');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('https://example.test/path\n');
    await applyTextSample('Keep mixed line endings');

    await expect(
      page.getByRole('group', { exact: true, name: 'Paragraph boundaries' }),
    ).toHaveCount(0);

    await run.click();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download reflowed-text.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing reflow TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('one two\r\nthree\r\nfour\rfive\rsix\nseven\n');
    await samples.selectOption({ label: 'Full reflow audit' });
    await run.click();
    const auditing = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download reflow-report.json' }).click();
    const auditPath = await (await auditing).path();

    if (!auditPath) throw new Error('Missing reflow audit download.');

    expect(JSON.parse(readFileSync(auditPath, 'utf8')).result.text).toBe('one two\nthree four\n');
    await applyTextSample('Empty input is valid');
    await run.click();
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download reflowed-text.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty reflow TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await toolInput(page).fill(' \t');
    await run.click();
    await expect.poll(() => output.textContent()).toBe(' \t');
    await page.getByRole('spinbutton', { name: /^Width in graphemes\b/ }).fill('1.5');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('decimal integer');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download reflowed-text.txt' }),
    ).toHaveCount(0);

    await applyTextSample('Grapheme-safe long tokens');
    await toolInput(page).fill('  x');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('Indentation');
    await applyTextSample('Wrap plain prose');
    await toolInput(page).fill('<script>window.injected=true</script>');
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
      'What is text wrapping?',
      'When to use Wrap/Unwrap Text',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
