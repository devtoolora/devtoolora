import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

const cases = [
  { expected: 'Valid objects: 2', id: 'json-lines-inspector', sample: 'Two event objects' },
  { expected: 'WARN cache miss', id: 'log-filter', sample: 'Errors without health checks' },
  { expected: '"token":"<redacted>"', id: 'raw-log-redactor', sample: 'Quoted JSON' },
  { expected: 'Frames: 3', id: 'stack-trace-cleaner', sample: 'Mixed frame order' },
];

for (const platform of platforms)
  for (const entry of cases) {
    test(`Log tools ${platform} ${entry.id}: guide, report, exact saved bytes and error state`, async ({
      page,
    }) => {
      await openTool(page, platform, entry.id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveCount(5);

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: entry.sample });

      await page.getByRole('button', { name: /^Run / }).click();
      const output = toolOutput(page);

      await expect(output).toContainText(entry.expected);
      const shown = await output.textContent();
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { name: /^Download / }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing diagnostic export.');

      expect(readFileSync(path, 'utf8')).toBe(shown);

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`logs-${entry.id}-${platform}.png`),
      });

      await toolInput(page).fill('ordinary demo log');
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
      if (entry.id === 'log-filter')
        await page.getByLabel('Include pattern', { exact: true }).fill('[');

      await page.getByRole('button', { name: /^Run / }).click();
      if (entry.id === 'json-lines-inspector') await expect(output).toContainText('Malformed: 1');
      else if (entry.id === 'raw-log-redactor')
        await expect(output).toHaveText('ordinary demo log');
      else await expect(page.getByRole('alert')).toBeVisible();

      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }

test('Log filter: pathological regex timeout and recovery', async ({ page }) => {
  await page.goto('/tools/log-filter');
  await toolInput(page).fill('a'.repeat(30000) + '!');
  await page.getByLabel('Include pattern', { exact: true }).fill('(a+)+$');
  await page.getByRole('button', { name: /^Run / }).click();

  await expect(page.getByRole('alert')).toContainText('2-second execution limit', {
    timeout: 10000,
  });

  await toolInput(page).fill('ERROR recovered');
  await page.getByLabel('Include pattern', { exact: true }).fill('ERROR');
  await page.getByRole('button', { name: /^Run / }).click();
  await expect(toolOutput(page)).toHaveText('ERROR recovered');
});
