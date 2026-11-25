import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Indent/Dedent Text ${platform}: literal units, shared prefix, raw exports, whitespace preview and audit`, async ({
    page,
  }) => {
    await openTool(page, platform, 'indent-dedent');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Indent/Dedent Text' });
    const output = toolOutput(page);

    async function applyTextSample(label: string): Promise<void> {
      await samples.selectOption({ label });

      await page
        .getByRole('group', { exact: true, name: 'Preview' })
        .getByRole('button', { exact: true, name: 'Result text' })
        .click();
    }

    await samples.selectOption({ label: 'Indent with two spaces' });
    await run.click();
    const changes = page.getByRole('region', { name: 'Text difference report' });

    await expect(changes).toBeVisible();
    await expect(changes).toContainText('··one');
    await expect(page.getByTestId('result-summary')).toContainText('spaces +4/−0');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`indent-${platform}.png`),
    });

    await applyTextSample('Indent with a tab');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('\tone\n\ttwo');
    await page.getByRole('spinbutton', { name: /^Amount\b/ }).fill('2');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download indented-text.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('\t\tone\n\t\ttwo');
    await applyTextSample('Remove up to two spaces');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('one\ntwo\n\tthree\n');

    await page
      .getByRole('group', { exact: true, name: 'Shorter indentation' })
      .getByRole('button', { exact: true, name: 'Exact amount' })
      .click();

    await run.click();
    await expect.poll(() => output.textContent()).toBe(' one\ntwo\n\tthree\n');
    await applyTextSample('Dedent tabs without touching spaces');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('one\n  two\n\tthree');
    await applyTextSample('Remove shared prefix');
    await expect(page.getByRole('spinbutton', { name: /^Amount\b/ })).toHaveCount(0);
    await expect(page.getByRole('group', { exact: true, name: 'Indentation unit' })).toHaveCount(0);

    await expect(page.getByRole('group', { exact: true, name: 'Shorter indentation' })).toHaveCount(
      0,
    );

    await run.click();
    await expect.poll(() => output.textContent()).toBe('one\n  two\nthree\n');

    await expect(page.getByTestId('result-summary')).toContainText(
      'Shared prefix: 2 literal characters',
    );

    await applyTextSample('Mixed indentation has no shared prefix');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('\t one\n  two\n');
    await expect(page.getByTestId('result-summary')).toContainText('Unchanged');
    await applyTextSample('Include real blank rows');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  one\n  \n   \n  two\n');
    await applyTextSample('Keep mixed line endings');
    await run.click();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download indented-text.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing indentation TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('  one\r\n  two\r  three\n');
    await applyTextSample('Dedent to empty');
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('Warning:');
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download indented-text.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty indentation TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await samples.selectOption({ label: 'Full indentation audit' });
    await run.click();
    const auditing = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download indentation-report.json' })
      .click();

    const auditPath = await (await auditing).path();

    if (!auditPath) throw new Error('Missing indentation audit download.');

    const audit = JSON.parse(readFileSync(auditPath, 'utf8'));

    expect(audit.result.commonPrefix).toBe('\t ');
    expect(audit.result.text).toBe('one\n two\n');
    await applyTextSample('Zero amount is a no-op');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('  one\n\ttwo\n');
    await expect(page.getByTestId('result-summary')).toContainText('0 changed lines');
    await applyTextSample('Empty input is valid');
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 → 0 physical lines');
    await toolInput(page).fill(' \t');
    await run.click();
    await expect.poll(() => output.textContent()).toBe(' \t');
    await page.getByRole('spinbutton', { name: /^Amount\b/ }).fill('1.5');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('decimal integer');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download indented-text.txt' }),
    ).toHaveCount(0);

    await applyTextSample('Indent with two spaces');
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
      'What is indentation?',
      'When to use Indent/Dedent Text',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
