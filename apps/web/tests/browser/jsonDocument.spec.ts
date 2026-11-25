import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Lossless JSON ${platform}: shared modes, precise numbers, warnings, artifacts and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'json-minify');
    const run = page.getByRole('button', { exact: true, name: 'Run JSON Minify' });
    const input = toolInput(page);
    const output = toolOutput(page);

    await input.fill('{ "id":9007199254740993, "id":1.00, "escaped":"\\u0061" }');
    await run.click();
    await expect(output).toHaveText('{"id":9007199254740993,"id":1.00,"escaped":"\\u0061"}');
    await expect(page.getByRole('combobox', { name: 'Indentation', exact: true })).toHaveCount(0);
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download minified.json' }).click();
    const path = await (await saving).path();

    if (!path) throw new Error('Minified JSON was not saved.');

    expect(readFileSync(path, 'utf8')).toBe(await output.textContent());
    await page.getByRole('button', { exact: true, name: 'Validate' }).click();
    await run.click();
    await expect(output).toContainText('Duplicate keys: 1');
    await expect(output).toContainText('Numbers outside JavaScript safe range: 1');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Validate root null' });

    await run.click();
    await expect(output).toContainText('Type: null');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is JSON formatting?',
      'When to format or validate JSON',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Tabs and CRLF' });

    await run.click();
    const savingFormatted = page.waitForEvent('download');

    await expect(page.getByRole('combobox', { name: 'Indentation', exact: true })).toBeVisible();
    await page.getByRole('button', { exact: true, name: 'Download formatted.json' }).click();
    const formattedPath = await (await savingFormatted).path();

    if (!formattedPath) throw new Error('Formatted JSON was not saved.');

    expect(readFileSync(formattedPath, 'utf8')).toContain('\r\n\t"settings"');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`json-${platform}.png`),
    });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await input.fill('{\n"ok":true,\n}');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('line 3, column 1');
    await expect(output).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Exact large numbers' });

    await run.click();
    await expect(output).toContainText('9007199254740993');
    await openTool(page, platform, 'json-validate');
    await toolInput(page).fill('null');
    await page.getByRole('button', { exact: true, name: 'Run JSON Validator' }).click();
    await expect(toolOutput(page)).toContainText('Type: null');
  });
}
