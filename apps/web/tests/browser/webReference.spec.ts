import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms)
  for (const id of ['http-status', 'mime-lookup']) {
    test(`Web reference ${platform} ${id}: catalog, auto lookup, export and missing mapping`, async ({
      page,
    }) => {
      await openTool(page, platform, id);
      const output = toolOutput(page);

      await expect(output).toContainText(
        id === 'http-status' ? '1xx Informational' : '.json: application/json',
      );

      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveCount(5);
      const input = toolInput(page);

      await input.fill(id === 'http-status' ? '404' : 'image/jpeg');

      await expect(output).toHaveText(
        id === 'http-status' ? '404 Not Found' : 'jpeg: image/jpeg\njpg: image/jpeg',
      );

      const shown = await output.textContent();
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { name: /^Download / }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing reference download.');

      expect(readFileSync(path, 'utf8')).toBe(shown);

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`reference-${id}-${platform}.png`),
      });

      await input.fill(id === 'http-status' ? '499' : 'file.unknown');

      await expect(output).toContainText(
        id === 'http-status' ? 'Not in the bundled' : 'No MIME mapping',
      );

      if (id === 'http-status') {
        await input.fill('404.0');
        await expect(page.getByRole('alert')).toContainText('three-digit');
        await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
      }

      await input.fill('');

      await expect(output).toContainText(
        id === 'http-status' ? '2xx Success' : '.json: application/json',
      );

      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
