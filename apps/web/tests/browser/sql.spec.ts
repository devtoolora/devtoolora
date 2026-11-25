import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`SQL Formatter ${platform}: documentation, protected text, options and SQL download`, async ({
    page,
  }) => {
    await openTool(page, platform, 'sql-format');
    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is SQL formatting?',
      'When to use SQL Formatter',
      'How to use it',
      'Examples',
      'Notes',
    ]);

    await expect(
      guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
    ).toHaveCount(6);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Literals and comments' });

    await page.getByRole('button', { exact: true, name: 'Run SQL Formatter' }).click();
    const output = toolOutput(page);

    await expect(output).toContainText("'from users,  where id'");
    await expect(output).toContainText("'it''s  fine'");
    await expect.poll(() => output.textContent()).toMatch(/-- from orders,  where active\nFROM/);
    await page.getByRole('button', { exact: true, name: '4 spaces' }).click();
    await page.getByRole('button', { exact: true, name: 'lowercase' }).click();
    await page.getByRole('button', { exact: true, name: 'Run SQL Formatter' }).click();
    await expect.poll(() => output.textContent()).toMatch(/^select\n    'from users,  where id'/);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'PostgreSQL CTE' });

    await expect(page.getByRole('combobox', { name: 'SQL dialect' })).toHaveValue('postgresql');

    await expect(page.getByRole('button', { exact: true, name: '2 spaces' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await expect(page.getByRole('button', { exact: true, name: 'UPPERCASE' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { exact: true, name: 'Run SQL Formatter' }).click();
    await expect(output).toContainText('$$from  users$$');
    await expect(output).toContainText('$1');
    const formatted = await output.textContent();
    const downloadPromise = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download formatted.sql' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('formatted.sql');
    const savedPath = await download.path();

    if (!savedPath) throw new Error('SQL download was not saved.');

    expect(readFileSync(savedPath, 'utf8')).toBe(formatted);
    await page.screenshot({ fullPage: true, path: `test-results/sql-formatter-${platform}.png` });

    await page
      .locator('.tool-workspace')
      .screenshot({ path: `test-results/sql-formatter-${platform}-workspace.png` });

    await page.setViewportSize({ height: 844, width: 390 });

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test(`SQL Formatter ${platform}: dialect-specific identifiers and malformed-input errors`, async ({
    page,
  }) => {
    await openTool(page, platform, 'sql-format');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'SQL Server parameters' });

    await page.getByRole('button', { exact: true, name: 'Run SQL Formatter' }).click();
    await expect(toolOutput(page)).toContainText('[from]');
    await expect(toolOutput(page)).toContainText('@id');
    await toolInput(page).fill("select 'unterminated");
    await page.getByRole('button', { exact: true, name: 'Run SQL Formatter' }).click();
    await expect(page.getByRole('alert')).toContainText('Could not format SQL');
    await expect(toolOutput(page)).toHaveCount(0);

    await expect(
      page.getByRole('button', { exact: true, name: 'Download formatted.sql' }),
    ).toHaveCount(0);
  });
}
