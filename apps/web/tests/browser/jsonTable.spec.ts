import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`JSON Table ${platform}: visual records, exact cells, search, pagination, full export and recovery`, async ({
    page,
  }) => {
    await openTool(page, platform, 'json-table');
    const run = page.getByRole('button', { exact: true, name: 'Run JSON Table' });
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const viewer = page.getByLabel('Interactive JSON table');

    await samples.selectOption({ label: 'Exact numbers and nested data' });
    await run.click();
    await expect(viewer.getByRole('cell', { exact: true, name: '9007199254740993' })).toBeVisible();
    await expect(viewer.getByRole('cell', { exact: true, name: '1.00' })).toBeVisible();
    await expect(viewer.getByRole('cell', { exact: true, name: '["dev","admin"]' })).toBeVisible();

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`json-table-${platform}.png`),
    });

    await samples.selectOption({ label: 'Missing null and empty values' });
    await run.click();
    await expect(viewer.getByRole('cell', { exact: true, name: 'null' })).toHaveCount(1);
    await expect(viewer.getByRole('cell', { exact: true, name: '""' })).toHaveCount(1);
    await expect(viewer.getByRole('cell', { exact: true, name: 'Missing' })).toHaveCount(7);
    await samples.selectOption({ label: 'Safe Markdown and Unicode' });
    await run.click();
    await expect(toolOutput(page)).toContainText('&#60;img');
    await page.getByRole('button', { exact: true, name: 'Table preview' }).click();
    await run.click();
    await expect(viewer.getByRole('cell', { name: /<img src=x/ })).toHaveCount(1);
    await expect(viewer.locator('img')).toHaveCount(0);
    const rows = Array.from({ length: 205 }, (_, index) => ({
      id: index,
      name: index === 204 ? 'hidden match' : `Row ${index}`,
    }));

    await toolInput(page).fill(JSON.stringify(rows));
    await run.click();
    await expect(viewer.locator('tbody tr')).toHaveCount(100);
    await viewer.getByRole('button', { name: 'Show more' }).click();
    await expect(viewer.locator('tbody tr')).toHaveCount(200);
    await viewer.getByRole('searchbox', { name: 'Search row values' }).fill('hidden match');
    await expect(viewer.locator('tbody tr')).toHaveCount(1);
    await expect(viewer.getByRole('rowheader')).toHaveText('205');
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download json-table.md' }).click();
    const path = await (await saving).path();

    if (!path) throw new Error('JSON table export was not saved.');

    const markdown = readFileSync(path, 'utf8');

    expect(markdown).toContain('Row 0');
    expect(markdown).toContain('hidden match');
    expect(markdown.split('\n')).toHaveLength(207);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await toolInput(page).fill('[{"same":1,"same":2}]');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('duplicate key');
    await expect(viewer).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    await samples.selectOption({ label: 'Empty records' });
    await run.click();
    await expect(viewer.locator('tbody tr')).toHaveCount(2);
    await expect(viewer).toContainText('no data keys');
    await samples.selectOption({ label: 'Empty dataset' });
    await run.click();
    await expect(viewer).toContainText('No records');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a JSON table?',
      'When to use JSON Table',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
