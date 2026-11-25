import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms)
  for (const id of ['dotenv-formatter', 'dotenv-validator', 'secret-redactor']) {
    test(`Config tools ${platform} ${id}: local output, guide and exact export`, async ({
      page,
    }) => {
      await openTool(page, platform, id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveCount(5);

      await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({
        label: id === 'secret-redactor' ? 'Strip secret comments' : 'Compact comment',
      });

      await page.getByRole('button', { name: /^Run / }).click();
      const output = toolOutput(page);

      await expect(output).toContainText(
        id === 'dotenv-formatter'
          ? 'PORT=3000 # development'
          : id === 'dotenv-validator'
            ? 'Valid .env'
            : 'TOKEN=<redacted>',
      );

      if (id === 'secret-redactor') await expect(output).not.toContainText('demo');

      const shown = await output.textContent();
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { name: /^Download / }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing configuration download.');

      expect(readFileSync(path, 'utf8')).toBe(shown);

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`config-${id}-${platform}.png`),
      });

      await toolInput(page).fill('TOKEN="unfinished');
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
      await page.getByRole('button', { name: /^Run / }).click();
      if (id === 'dotenv-validator') await expect(output).toContainText('Line 1: Unterminated');
      else await expect(page.getByRole('alert')).toContainText('Unterminated');

      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
