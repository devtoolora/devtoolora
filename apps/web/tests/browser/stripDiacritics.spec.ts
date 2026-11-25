import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Strip Diacritics ${platform}: scoped Unicode removal, exact exports, audit and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'strip-diacritics');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Strip Diacritics' });
    const output = toolOutput(page);

    async function applyTextSample(label: string): Promise<void> {
      await samples.selectOption({ label });

      await page
        .getByRole('group', { exact: true, name: 'Preview' })
        .getByRole('button', { exact: true, name: 'Result text' })
        .click();
    }

    await samples.selectOption({ label: 'Czech and French accents' });
    await run.click();
    const changes = page.getByRole('region', { name: 'Text difference report' });

    await expect(changes).toBeVisible();
    await expect(changes).toContainText('Prilis zlutoucky kun');
    await expect(page.getByTestId('result-summary')).toContainText('ASCII output');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`diacritics-${platform}.png`),
    });

    await applyTextSample('Composed and decomposed accents');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('cafe\ncafe\n');
    await expect(page.getByTestId('result-summary')).toContainText('2 decomposed marks removed');
    await applyTextSample('Extended combining accent');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('a\n');
    await applyTextSample('Keep other scripts unchanged');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('Cafe / α\u0301 / عَرَبِيّ / क् / 가');

    await page
      .getByRole('group', { exact: true, name: 'Removal scope' })
      .getByRole('button', { exact: true, name: 'Combining diacritics' })
      .click();

    await expect(
      page.getByRole('button', { exact: true, name: 'Download stripped-text.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('Cafe / α / عربي / क / 가');
    await expect(page.getByTestId('result-summary')).toContainText('Broad scope');
    await applyTextSample('Keep emoji presentation');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('e ♥️ 1️⃣ 👨‍👩‍👧‍👦 👍🏽');
    await applyTextSample('All marks can alter emoji');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('e ♥ 1 👨‍👩‍👧‍👦 👍🏽');
    await applyTextSample('Not an ASCII transliterator');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('Łodz Straße smør æsir Œuvre ﬁ');
    await expect(page.getByTestId('result-summary')).toContainText('non-ASCII code points remain');
    await applyTextSample('Keep mixed line endings');
    await run.click();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download stripped-text.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing stripped TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('caj\r\ncafe\rkun\n');
    await applyTextSample('Detached marks become empty');
    await run.click();
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download stripped-text.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty stripped TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await samples.selectOption({ label: 'Full diacritic audit' });
    await run.click();
    const auditing = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download diacritics-report.json' })
      .click();

    const auditPath = await (await auditing).path();

    if (!auditPath) throw new Error('Missing diacritic audit download.');

    expect(JSON.parse(readFileSync(auditPath, 'utf8')).result.text).toBe('cafe / cafe / Ł\n');
    await applyTextSample('Empty input is valid');
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 decomposed marks removed');
    await toolInput(page).fill(' \t');
    await run.click();
    await expect.poll(() => output.textContent()).toBe(' \t');
    await toolInput(page).fill('x'.repeat(100_001));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('100,000');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download stripped-text.txt' }),
    ).toHaveCount(0);

    await applyTextSample('Czech and French accents');
    await toolInput(page).fill('<script>é</script>');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('<script>e</script>');
    await expect(output.locator('script, img, iframe')).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is diacritic stripping?',
      'When to use Strip Diacritics',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
