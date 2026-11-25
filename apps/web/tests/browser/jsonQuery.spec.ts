import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`JSON Query ${platform}: precise values, pointer paths, quoted keys, artifacts, Tree workflow and recovery`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await openTool(page, platform, 'json-query');
    const run = page.getByRole('button', { exact: true, name: 'Run JSON Query' });
    const output = toolOutput(page);
    const samples = page.getByRole('combobox', { name: 'Apply sample' });

    await samples.selectOption({ label: 'Pointer from Tree or Diff' });
    await run.click();
    await expect(output).toHaveText('9007199254740993');
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download selected.json' }).click();
    const path = await (await saving).path();

    if (!path) throw new Error('Selected JSON was not saved.');

    expect(readFileSync(path, 'utf8')).toBe('9007199254740993');
    await samples.selectOption({ label: 'Quoted punctuation and Unicode keys' });
    await run.click();
    await expect(output).toContainText('"valueJson"');
    const report = JSON.parse((await output.textContent()) ?? '{}');

    expect(report.pointer).toBe('/a.b/Příliš žluťoučký');
    expect(report.type).toBe('array');
    expect(report.valueJson).toContain('1.00');
    expect(report.valueJson).toContain('1e400');
    await samples.selectOption({ label: 'Empty key is not the root' });
    await run.click();
    await expect(output).toHaveText('null');
    await samples.selectOption({ label: 'Single-quoted bracket keys' });
    await run.click();
    await expect(output).toHaveText('"Ada Lovelace"');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`json-query-${platform}.png`),
    });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('textbox', { name: /^Path/ }).fill('$.constructor');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('No value exists');
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'Whole document' });
    await run.click();
    await expect(output).toContainText('"nothing": null');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a JSON query?',
      'When to query JSON',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await openTool(page, platform, 'json-tree');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Paths with special keys' });

    await page.getByRole('button', { exact: true, name: 'Run JSON Tree' }).click();
    const source = await toolInput(page).inputValue();
    const tree = page.getByLabel('Interactive JSON outline');

    await tree.getByRole('button', { exact: true, name: 'Toggle "a/b~c"' }).click();
    await tree.getByRole('button', { exact: true, name: '"" number 9007199254740993' }).click();
    await tree.getByRole('button', { exact: true, name: 'Copy pointer' }).click();
    const pointer = await page.evaluate(() => navigator.clipboard.readText());

    await openTool(page, platform, 'json-query');
    await toolInput(page).fill(source);
    await page.getByRole('button', { exact: true, name: 'JSON Pointer' }).click();
    await page.getByRole('textbox', { name: /^Path/ }).fill(pointer);
    await run.click();
    await expect(output).toHaveText('9007199254740993');
  });
}
