import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`chmod Calculator ${platform}: ordinary and special bits, exact audit and errors`, async ({
    page,
  }) => {
    await openTool(page, platform, 'chmod-calculator');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const table = page.getByRole('region', { name: 'Data table' });
    const input = toolInput(page);
    const run = (): Promise<void> => page.keyboard.press('Control+Enter');

    await samples.selectOption({ label: 'Owner rwx, group/others rx (755)' });
    await run();
    await expect(table.locator('tbody tr')).toHaveCount(3);

    await expect(table.locator('tbody tr').first().locator('th, td')).toHaveText([
      'owner',
      'Yes',
      'Yes',
      'Yes',
      'None',
      'rwx',
    ]);

    await expect(table.getByRole('searchbox')).toHaveCount(0);

    await expect(table.getByRole('columnheader')).toHaveText([
      'Subject',
      'Read',
      'Write',
      'Execute',
      'Special',
      'Symbolic',
    ]);

    await expect(page.getByTestId('result-summary')).toContainText('755 = rwxr-xr-x');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`chmod-${platform}.png`),
    });

    await samples.selectOption({ label: 'Extra leading zeroes (00755)' });
    await run();
    await expect(page.getByTestId('result-summary')).toContainText('755 = rwxr-xr-x');
    await samples.selectOption({ label: 'No permission bits (000)' });
    await run();

    await expect(table.locator('tbody tr').first().locator('th, td')).toHaveText([
      'owner',
      'No',
      'No',
      'No',
      'None',
      '---',
    ]);

    await expect(page.getByTestId('result-summary')).toContainText('000 = ---------');
    await samples.selectOption({ label: 'Setuid without owner execute (4644)' });
    await run();

    await expect(table.locator('tbody tr').first().locator('th, td')).toHaveText([
      'owner',
      'Yes',
      'Yes',
      'No',
      'setuid',
      'rwS',
    ]);

    await samples.selectOption({ label: 'Setgid without group execute (2640)' });
    await run();

    await expect(table.locator('tbody tr').nth(1).locator('th, td')).toHaveText([
      'group',
      'Yes',
      'No',
      'No',
      'setgid',
      'r-S',
    ]);

    await samples.selectOption({ label: 'Sticky without others execute (1666)' });
    await run();

    await expect(table.locator('tbody tr').nth(2).locator('th, td')).toHaveText([
      'others',
      'Yes',
      'Yes',
      'No',
      'sticky',
      'rwT',
    ]);

    await samples.selectOption({ label: 'All ordinary and special bits (7777)' });
    await run();
    await expect(page.getByTestId('result-summary')).toContainText('7777 = rwsrwsrwt');
    await samples.selectOption({ label: 'Full JSON permission audit' });
    await run();
    const output = toolOutput(page);

    await expect(table).toHaveCount(0);
    await expect(output).toContainText('"setuid": true');
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download chmod-report.json' }).click();
    const path = await (await pending).path();

    if (!path) throw new Error('Missing chmod audit download.');

    const audit = JSON.parse(readFileSync(path, 'utf8'));

    expect(audit.fullOctal).toBe('4755');
    expect(audit.compact).toBe('rwsr-xr-x');
    expect(audit.groups.owner.execute).toBe(true);
    expect(audit.originalInput).toBe('4755');
    await input.fill('888');
    await run();
    await expect(page.getByRole('alert')).toContainText('octal digits');
    await expect(page.getByRole('button', { name: 'Download chmod-report.json' })).toHaveCount(0);
    await input.fill('7'.repeat(65));
    await run();
    await expect(page.getByRole('alert')).toContainText('64 UTF-16');
    await input.fill('<script>window.injected=true</script>');
    await run();
    await expect(page.getByRole('alert')).toContainText('octal digits');
    await expect(page.getByRole('alert').locator('script, img, iframe')).toHaveCount(0);
    await samples.selectOption({ label: 'Explicit zero special bits (0755)' });
    await run();
    await expect(page.getByTestId('result-summary')).toContainText('755 = rwxr-xr-x');
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What are chmod permission bits?',
      'When to use chmod Calculator',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
