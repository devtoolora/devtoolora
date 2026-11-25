import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms)
  for (const id of ['curl-to-fetch', 'fetch-to-curl']) {
    test(`Request conversion ${platform} ${id}: one two-way converter, code, export, errors and recovery`, async ({
      page,
    }) => {
      const toFetch = id === 'curl-to-fetch';
      const direction = toFetch ? 'cURL → fetch' : 'fetch → cURL';
      const runName = toFetch ? 'Convert to fetch' : 'Convert to cURL';

      await openTool(page, platform, id);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        toFetch ? 'cURL ↔ Fetch Converter' : 'Fetch to cURL',
      );

      await expect(
        page.getByRole('group', { name: 'Direction' }).getByRole('button', { name: direction }),
      ).toHaveAttribute('aria-pressed', 'true');

      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveText([
        'What is cURL ↔ fetch conversion?',
        'When to convert between cURL and fetch',
        'How to use it',
        'Examples',
        'Notes',
      ]);

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: `${direction}: Empty POST body` });

      await page.getByRole('button', { exact: true, name: runName }).click();
      const output = toolOutput(page);

      await expect(output).toContainText(toFetch ? 'body: ""' : "--data-raw ''");
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { name: /^Download / }).click();
      const download = await pending;

      expect(download.suggestedFilename()).toBe(toFetch ? 'fetch-request.js' : 'curl-request.sh');
      const path = await download.path();

      if (!path) throw new Error('Missing code download.');

      expect(readFileSync(path, 'utf8')).toBe(await output.textContent());
      await page.screenshot({ fullPage: true, path: `test-results/request-${id}-${platform}.png` });

      await toolInput(page).fill(
        toFetch ? 'curl https://example.com --proxy http://localhost' : 'fetch(url)',
      );

      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
      await page.getByRole('button', { exact: true, name: runName }).click();
      await expect(page.getByRole('alert')).toBeVisible();

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: `${direction}: POST JSON` });

      await page.getByRole('button', { exact: true, name: runName }).click();
      await expect(output).toContainText('https://api.example.com/items');
      await page.getByRole('button', { name: 'Use result & reverse' }).click();

      await page
        .getByRole('button', {
          exact: true,
          name: toFetch ? 'Convert to cURL' : 'Convert to fetch',
        })
        .click();

      if (toFetch)
        await expect(output).toHaveText(
          `curl --globoff 'https://api.example.com/items' -H 'Content-Type: application/json' --data-raw '{"name":"Ada"}'`,
        );
      else await expect(output).toContainText('body: "{\\"name\\":\\"Ada\\"}"');

      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
