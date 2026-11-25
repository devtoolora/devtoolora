import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Find & Replace ${platform}: explicit replacements, changes, exact exports, deadline and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'find-replace');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Find & Replace' });
    const output = toolOutput(page);

    async function applyTextSample(label: string): Promise<void> {
      await samples.selectOption({ label });

      await page
        .getByRole('group', { exact: true, name: 'Preview' })
        .getByRole('button', { exact: true, name: 'Replaced text' })
        .click();
    }

    await samples.selectOption({ label: 'Literal word replacement' });
    await run.click();
    const changes = page.getByRole('region', { name: 'Text difference report' });

    await expect(changes).toBeVisible();
    await expect(changes).toContainText('Hello world, world again.');
    await expect(page.getByTestId('result-summary')).toContainText('2 replacement operations');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`replace-${platform}.png`),
    });

    await applyTextSample('Literal punctuation and dollars');
    await expect(page.getByRole('textbox', { name: /^Extra regex flags\b/ })).toHaveCount(0);

    await expect(
      page.getByRole('group', { exact: true, name: 'Replacement interpretation' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('a$&b$&c');
    await page.getByRole('textbox', { name: /^Replacement\b/ }).fill('X');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download replaced-text.txt' }),
    ).toHaveCount(0);

    await run.click();
    await expect.poll(() => output.textContent()).toBe('aXbXc');
    await applyTextSample('Only first occurrence');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('dog cat CAT');
    await applyTextSample('Swap regex captures');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('Ada Lovelace\nGrace Hopper');

    await page
      .getByRole('group', { exact: true, name: 'Replacement interpretation' })
      .getByRole('button', { exact: true, name: 'Literal text' })
      .click();

    await run.click();
    await expect.poll(() => output.textContent()).toBe('$2 $1\n$2 $1');
    await applyTextSample('Named capture replacement');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('PORT: 3000\nHOST: localhost');
    await applyTextSample('Multiline log markers');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('WARN: one\nINFO: ok\nWARN: two');
    await applyTextSample('Unicode zero-width insertion');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('|😀|😀|');
    await applyTextSample('Keep mixed line endings');
    await run.click();
    const downloading = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download replaced-text.txt' }).click();
    const path = await (await downloading).path();

    if (!path) throw new Error('Missing replacement TXT download.');

    expect(readFileSync(path, 'utf8')).toBe('ONE\r\ntwo\rONE\n');
    await applyTextSample('Delete to empty');
    await run.click();
    const emptying = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download replaced-text.txt' }).click();
    const emptyPath = await (await emptying).path();

    if (!emptyPath) throw new Error('Missing empty replacement TXT download.');

    expect(readFileSync(emptyPath)).toHaveLength(0);
    await samples.selectOption({ label: 'Full replacement audit' });
    await run.click();
    const auditing = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download replacement-report.json' })
      .click();

    const auditPath = await (await auditing).path();

    if (!auditPath) throw new Error('Missing replacement audit download.');

    expect(JSON.parse(readFileSync(auditPath, 'utf8')).result.text).toBe('y y\n');
    await applyTextSample('Empty source is valid');
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('0 replacement operations');
    await applyTextSample('Swap regex captures');
    await page.getByRole('textbox', { name: /^Find\b/ }).fill('(');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('Invalid or unsupported');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download replaced-text.txt' }),
    ).toHaveCount(0);

    await page.getByRole('textbox', { name: /^Find\b/ }).fill('(a+)+$');
    await toolInput(page).fill('a'.repeat(60) + '!');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('2-second', { timeout: 10_000 });
    await applyTextSample('Literal word replacement');
    await run.click();
    await expect.poll(() => output.textContent()).toBe('Hello world, world again.');
    await page.getByRole('textbox', { name: /^Replacement\b/ }).fill('<script>');
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
      'What is Find & Replace?',
      'When to use Find & Replace',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
