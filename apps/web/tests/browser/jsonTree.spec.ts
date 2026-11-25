import { expect, openTool, platforms, test, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`JSON Tree ${platform}: expandable outline, hidden search, exact scalar, pointers, saved full outline and recovery`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openTool(page, platform, 'json-tree');
    const run = page.getByRole('button', { exact: true, name: 'Run JSON Tree' });
    const input = toolInput(page);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Paths with special keys' });

    await run.click();
    const viewer = page.getByLabel('Interactive JSON outline');
    const values = viewer.getByRole('list', { name: 'JSON values' });

    await expect(values.getByRole('listitem')).toHaveCount(3);
    await viewer.getByRole('button', { exact: true, name: 'Toggle "a/b~c"' }).click();
    await expect(values.getByRole('listitem')).toHaveCount(4);
    await viewer.getByRole('button', { name: '"" number 9007199254740993', exact: true }).click();
    const detail = viewer.getByRole('region', { name: 'Selected JSON value' });

    await expect(detail).toContainText('/a~1b~0c/');
    await expect(detail.locator('pre')).toHaveText('9007199254740993');
    await detail.getByRole('button', { name: 'Copy pointer', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/a~1b~0c/');
    await detail.getByRole('button', { name: 'Copy scalar token', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('9007199254740993');
    await viewer.getByRole('button', { name: 'Collapse all', exact: true }).click();
    await expect(values.getByRole('listitem')).toHaveCount(1);
    await viewer.getByRole('button', { name: 'Toggle $', exact: true }).focus();
    await viewer.getByRole('button', { name: 'Toggle $', exact: true }).press('Enter');
    await expect(values.getByRole('listitem')).toHaveCount(3);
    await viewer.getByRole('button', { name: 'Collapse all', exact: true }).click();
    await viewer.getByRole('searchbox').fill('žluťoučký');
    await expect(values.getByRole('listitem')).toHaveCount(4);
    await viewer.getByRole('searchbox').fill('not-a-match');
    await expect(viewer.getByText('No matching values.', { exact: true })).toBeVisible();
    const saving = page.waitForEvent('download');

    await page.getByRole('button', { name: 'Download json-tree.txt', exact: true }).click();
    const path = await (await saving).path();

    if (!path) throw new Error('JSON outline was not saved.');

    const saved = readFileSync(path, 'utf8');

    expect(saved).toContain('9007199254740993');
    expect(saved).toContain('žluťoučký');
    await viewer.getByRole('searchbox').fill('');
    await viewer.getByRole('button', { name: 'Expand all', exact: true }).click();

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`json-tree-${platform}.png`),
    });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await input.fill(JSON.stringify(Array.from({ length: 300 }, (_, index) => index)));
    await run.click();
    await expect(values.getByRole('listitem')).toHaveCount(200);
    await viewer.getByRole('button', { exact: true, name: 'Show more' }).click();
    await expect(values.getByRole('listitem')).toHaveCount(301);
    await input.fill('['.repeat(50) + '0' + ']'.repeat(50));
    await run.click();
    await expect(values.getByRole('listitem')).toHaveCount(2);
    await viewer.getByRole('button', { exact: true, name: 'Expand all' }).click();
    await expect(values.getByRole('listitem')).toHaveCount(51);

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await input.fill('[1,]');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('line 1, column 4');
    await expect(viewer).toHaveCount(0);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Unsafe HTML stays text' });

    await run.click();
    await expect(viewer.locator('img')).toHaveCount(0);
    await expect(values).toContainText('<img src=x onerror=alert(1)>');
  });
}
