import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Cron Generator ${platform}: opens the builder, presets, custom fields, exact exports and validation`, async ({
    page,
  }) => {
    await openTool(page, platform, 'cron-generator');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cron Generator');

    await expect(
      page.getByRole('group', { name: 'Start from' }).getByRole('button', { name: 'Builder' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await expect(
      page.getByRole('group', { name: 'Output' }).getByRole('button', { name: 'Expression' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('textbox', { name: /^Cron expression/ })).toHaveCount(0);
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const output = toolOutput(page);
    const run = (): Promise<void> => page.keyboard.press('Control+Enter');

    await run();
    await expect.poll(() => output.textContent()).toBe('*/15 * * * *');
    await expect(page.getByRole('textbox', { name: /^Minute/ })).toHaveCount(0);
    await samples.selectOption({ label: 'Build: custom business hours' });
    await run();
    await expect.poll(() => output.textContent()).toBe('0,30 9-17 * * MON-FRI');
    await expect(page.getByRole('textbox', { name: /^Minute/ })).toBeVisible();
    await page.screenshot({ fullPage: true, path: `test-results/cron-generator-${platform}.png` });

    async function download(name: string): Promise<string> {
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing cron export.');

      return readFileSync(path, 'utf8');
    }

    expect(await download('cron-expression.txt')).toBe('0,30 9-17 * * MON-FRI');
    const audit = JSON.parse(await download('cron-report.json'));

    expect(audit.result.expression).toBe('0,30 9-17 * * MON-FRI');
    expect(audit.result.fields[0].values).toEqual([0, 30]);
    expect(audit.result.fields[4].values).toEqual([1, 2, 3, 4, 5]);
    expect(audit.source).toBe('builder');
    expect(audit.preset).toBe('custom');
    expect(audit.timezone).toBe('UTC');
    expect(audit.nextRuns).toHaveLength(5);

    expect(await download('cron-explanation.txt')).toContain(
      'Plain English: At minute values 0, 30',
    );

    await samples.selectOption({ label: 'Build: quarterly first day' });
    await run();
    await expect.poll(() => output.textContent()).toBe('0 0 1 JAN,APR,JUL,OCT *');
    await page.getByRole('textbox', { name: /^Day of week/ }).fill('0,7');
    await page.getByRole('textbox', { name: /^Day of month/ }).fill('*');
    await page.getByRole('textbox', { name: /^Month/ }).fill('*');
    await run();
    await expect.poll(() => output.textContent()).toBe('0 0 * * 0,7');
    await page.getByRole('textbox', { name: /^Minute/ }).fill('*/0');
    await run();
    await expect(page.getByRole('alert')).toContainText('positive safe decimal integer');
    await expect(page.getByRole('button', { name: 'Download cron-expression.txt' })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Preset', exact: true }).selectOption('hourly');
    await run();
    await expect.poll(() => output.textContent()).toBe('0 * * * *');
    await expect(page.getByRole('textbox', { name: /^Minute/ })).toHaveCount(0);
    await samples.selectOption({ label: 'Build: explicit range step' });
    await run();
    await expect.poll(() => output.textContent()).toBe('5-59/15 9 * * *');
    await page.getByRole('textbox', { name: /^Minute/ }).fill('0 9');
    await run();
    await expect(page.getByRole('alert')).toContainText('one nonempty cron field');
    await page.getByRole('textbox', { name: /^Minute/ }).fill('<script>');
    await run();
    await expect(page.getByRole('alert')).toContainText('unsupported field syntax');
    await expect(page.getByRole('alert').locator('script, img, iframe')).toHaveCount(0);
    await page.getByRole('textbox', { name: /^Minute/ }).fill('0');
    await page.getByRole('textbox', { name: /^Day of month/ }).fill('31');
    await page.getByRole('textbox', { name: /^Month/ }).fill('APR');

    await page
      .getByRole('group', { name: 'Output' })
      .getByRole('button', { name: 'Explanation' })
      .click();

    await run();
    await expect(output).toContainText('Expression: 0 9 31 APR *');
    await expect(output).toContainText('No run in the next 25 years (UTC).');

    await page
      .getByRole('group', { name: 'Start from' })
      .getByRole('button', { name: 'Expression' })
      .click();

    await expect(page.getByRole('textbox', { name: /^Cron expression/ })).toBeVisible();
    await expect(page.getByRole('combobox', { exact: true, name: 'Preset' })).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a cron expression?',
      'When to use Cron Explainer & Generator',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
