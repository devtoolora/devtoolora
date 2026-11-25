import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  for (const id of ['math-evaluator', 'percentage-calculator', 'financial-calculator']) {
    test(`Math tools ${platform} ${id}: samples, guide, exact export and invalid recovery`, async ({
      page,
    }) => {
      await openTool(page, platform, id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveCount(5);
      const samples = page.getByRole('combobox', { name: 'Apply sample' });

      await samples.selectOption({
        label:
          id === 'math-evaluator'
            ? 'Scientific notation'
            : id === 'percentage-calculator'
              ? 'Reverse change (20% decrease)'
              : 'Zero-interest loan',
      });

      if (id !== 'percentage-calculator') await page.getByRole('button', { name: /^Run / }).click();

      const output = toolOutput(page);

      await expect(output).toContainText(
        id === 'math-evaluator'
          ? '250'
          : id === 'percentage-calculator'
            ? '"result": -20'
            : '"monthlyPayment": 100',
      );

      if (id === 'percentage-calculator') {
        await expect(
          page.getByRole('spinbutton', { name: 'Old value', exact: true }),
        ).toBeVisible();

        await expect(page.getByRole('spinbutton', { name: 'Part', exact: true })).toHaveCount(0);
      }

      if (id === 'financial-calculator')
        await expect(output).toContainText('nominal annual rate / 12');

      const shown = await output.textContent();
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { name: /^Download / }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing math result download.');

      expect(readFileSync(path, 'utf8')).toBe(shown);

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`math-${id}-${platform}.png`),
      });

      if (id === 'math-evaluator') await toolInput(page).fill('1 / 0');
      else
        await page
          .getByRole('spinbutton', {
            name: id === 'percentage-calculator' ? 'Old value' : 'Annual rate (%)',
            exact: true,
          })
          .fill('-1');
      if (id !== 'percentage-calculator') await page.getByRole('button', { name: /^Run / }).click();

      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
      await page.setViewportSize({ height: 844, width: 390 });

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await samples.selectOption({
        label:
          id === 'math-evaluator'
            ? 'Scientific notation'
            : id === 'percentage-calculator'
              ? 'Zero adjustment'
              : 'Annual compounding example',
      });

      if (id !== 'percentage-calculator') await page.getByRole('button', { name: /^Run / }).click();

      await expect(page.getByRole('alert')).toHaveCount(0);

      await expect(output).toContainText(
        id === 'math-evaluator'
          ? '250'
          : id === 'percentage-calculator'
            ? '"increased": 200'
            : '"futureValue": 1210',
      );
    });
  }
}
