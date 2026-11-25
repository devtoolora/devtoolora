import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  for (const id of ['json-to-toml', 'toml-to-json']) {
    test(`TOML ${id} ${platform}: nested conversion, exact integers, dates, full export and recovery`, async ({
      page,
    }) => {
      const toToml = id === 'json-to-toml';
      const direction = toToml ? 'JSON → TOML' : 'TOML → JSON';
      const sample = (label: string) => `${direction}: ${label}`;

      await openTool(page, platform, id);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        toToml ? 'JSON ↔ TOML Converter' : 'TOML to JSON',
      );

      await expect(
        page.getByRole('group', { name: 'Direction' }).getByRole('button', { name: direction }),
      ).toHaveAttribute('aria-pressed', 'true');

      const run = page.getByRole('button', {
        exact: true,
        name: toToml ? 'Convert to TOML' : 'Convert to JSON',
      });
      const samples = page.getByRole('combobox', { name: 'Apply sample' });
      const output = toolOutput(page);

      await samples.selectOption({
        label: sample(toToml ? 'Nested service configuration' : 'Tables and arrays of records'),
      });

      await run.click();
      await expect(output).toContainText(toToml ? '[[users]]' : '"users": [');
      await samples.selectOption({ label: sample('Exact 64-bit integers') });
      await run.click();

      await expect(output).toContainText(
        toToml ? 'id = 9007199254740993' : '"id": 9007199254740993',
      );

      const converted = await output.textContent();
      const fileName = toToml ? 'converted.toml' : 'converted.json';
      const saving = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
      const path = await (await saving).path();

      if (!path) throw new Error('TOML conversion artifact was not saved.');

      expect(readFileSync(path, 'utf8')).toBe(converted);

      if (toToml) {
        await samples.selectOption({ label: sample('Compact nested objects') });
        await run.click();
        await expect(output).toContainText('server = {');
        await samples.selectOption({ label: sample('Quoted keys Unicode and empty values') });
        await run.click();
        await expect(output).toContainText('["a.b"]');
        await expect(output).toContainText('Příliš žluťoučký');
      } else {
        await samples.selectOption({ label: sample('Protect large IDs as strings') });
        await run.click();
        await expect(output).toContainText('"id": "9007199254740993"');
        await expect(output).toContainText('"count": 42');
        await samples.selectOption({ label: sample('Dates times and precise fractions') });
        await run.click();
        await expect(output).toContainText('2026-10-11T12:30:01.123456789+02:00');
        await expect(page.getByTestId('result-summary')).toContainText('4 date/time strings');
        await samples.selectOption({ label: sample('Multiline text and quoted keys') });
        await run.click();
        await expect(output).toContainText('Line one # this is text');
      }

      await page.screenshot({ fullPage: true, path: `test-results/${id}-${platform}.png` });
      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await toolInput(page).fill(toToml ? '{"nested":{"value":null}}' : 'value=1\nvalue=2');

      await run.click();
      await expect(page.getByRole('alert')).toContainText(toToml ? '/nested/value' : 'TOML line 2');
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);

      await samples.selectOption({
        label: sample(toToml ? 'Empty object' : 'Empty configuration'),
      });

      await run.click();
      await expect(output).toHaveText(toToml ? '# Empty JSON object\n' : '{}');
      await page.getByRole('button', { name: 'Use result & reverse' }).click();

      await page
        .getByRole('button', { exact: true, name: toToml ? 'Convert to JSON' : 'Convert to TOML' })
        .click();

      await expect(output).toHaveText(toToml ? '{}' : '# Empty JSON object\n');
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveText([
        'What is JSON ↔ TOML conversion?',
        'When to convert between JSON and TOML',
        'How to use it',
        'Examples',
        'Notes',
      ]);
    });
  }
}
