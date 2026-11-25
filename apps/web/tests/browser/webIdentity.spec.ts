import { expect, openTool, platforms, test, toolGuide, toolInput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms)
  for (const id of ['url-parse', 'query-string-parser', 'email-normalizer']) {
    test(`Web identity ${platform} ${id}: report tree, exact export and recovery`, async ({
      page,
    }) => {
      await openTool(page, platform, id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveCount(5);

      await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({
        label:
          id === 'url-parse'
            ? 'Repeated parameters'
            : id === 'query-string-parser'
              ? 'Prototype-like names'
              : 'Generic case preservation',
      });

      await page.getByRole('button', { name: /^Run / }).click();
      await expect(page.getByLabel('Interactive JSON outline')).toBeVisible();
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { name: /^Download / }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing report download.');

      const report = JSON.parse(readFileSync(path, 'utf8'));

      if (id === 'url-parse') expect(report.params.tag).toEqual(['a', 'b']);
      else if (id === 'query-string-parser') expect(report.__proto__).toEqual(['one', 'two']);
      else expect(report.normalized).toBe('Ada.Lovelace+demo@example.com');

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`identity-${id}-${platform}.png`),
      });

      if (id === 'query-string-parser')
        await page.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('stringify');

      await toolInput(page).fill(
        id === 'url-parse'
          ? '/relative'
          : id === 'query-string-parser'
            ? '{"nested":{"x":1}}'
            : 'a..b@example.com',
      );

      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
      await page.getByRole('button', { name: /^Run / }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
