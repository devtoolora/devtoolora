import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms)
  for (const id of ['unit-converter', 'temperature-converter']) {
    test(`Measurement Converter ${platform} ${id}: shared calculations, guides, saved bytes and error recovery`, async ({
      page,
    }) => {
      const temperature = id === 'temperature-converter';

      await openTool(page, platform, id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveText([
        temperature ? 'What is temperature conversion?' : 'What is unit conversion?',
        temperature ? 'When to convert temperatures' : 'When to convert units',
        'How to use it',
        'Examples',
        'Notes',
      ]);

      const samples = page.getByRole('combobox', { name: 'Apply sample' });
      const run = page.getByRole('button', {
        exact: true,
        name: temperature ? 'Run Temperature Converter' : 'Run Unit Converter',
      });
      const output = toolOutput(page);

      await samples.selectOption({
        label: temperature ? 'Where Celsius equals Fahrenheit' : 'kB is not KiB',
      });

      if (!temperature) await run.click();

      await expect(output).toHaveText(temperature ? '-40 °C\n-40 °F\n233.15 K' : '0.9765625 KiB');

      await samples.selectOption({
        label: temperature ? 'Absolute zero (0 K)' : 'Bytes to binary mebibytes',
      });

      if (!temperature) await run.click();

      await expect(output).toContainText(temperature ? '"kelvin": 0' : '"toSymbol": "MiB"');
      const report = JSON.parse((await output.textContent()) ?? '{}');

      if (temperature) expect(report.celsius).toBe(-273.15);
      else expect(report.value).toBe(1);

      const saving = page.waitForEvent('download');

      await page
        .getByRole('button', {
          exact: true,
          name: `Download ${temperature ? 'temperature' : 'unit'}-conversion.json`,
        })
        .click();

      const path = await (await saving).path();

      if (!path) throw new Error('Conversion report was not saved.');

      expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(report);
      await page.screenshot({ fullPage: true, path: `test-results/${id}-${platform}.png` });
      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      if (temperature)
        await page.getByRole('spinbutton', { name: 'Value', exact: true }).fill('-1');
      else await page.getByRole('combobox', { name: 'To unit', exact: true }).selectOption('m');
      if (!temperature) await run.click();

      await expect(page.getByRole('alert')).toContainText(
        temperature ? 'below absolute zero' : 'same quantity',
      );

      await expect(output).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);

      await samples.selectOption({
        label: temperature ? 'Where Celsius equals Fahrenheit' : 'kB is not KiB',
      });

      if (!temperature) await run.click();

      await expect(output).toHaveText(temperature ? '-40 °C\n-40 °F\n233.15 K' : '0.9765625 KiB');
    });
  }
