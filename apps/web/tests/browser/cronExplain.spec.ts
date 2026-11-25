import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

test.use({ timezoneId: 'Europe/Prague' });

for (const platform of platforms) {
  test(`Cron Explainer & Generator ${platform}: explanation, next runs, exports and invalidation`, async ({
    page,
  }) => {
    await openTool(page, platform, 'cron-explain');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cron Explainer & Generator');

    await expect(
      page.getByRole('group', { name: 'Start from' }).getByRole('button', { name: 'Expression' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('combobox', { exact: true, name: 'Preset' })).toHaveCount(0);
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const output = toolOutput(page);
    const startAt = page.getByRole('textbox', { name: /^Runs after/ });

    await samples.selectOption({ label: 'Explain: not a continuous 35-minute interval' });
    await startAt.fill('2026-10-16 12:00');
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('minutes 0, 35 of every hour');

    await expect(output).toContainText(
      'Next 5 runs (UTC):\n- Fri 2026-10-16 12:35 UTC\n- Fri 2026-10-16 13:00 UTC\n- Fri 2026-10-16 13:35 UTC',
    );

    await samples.selectOption({ label: 'Explain: day of month OR weekday' });
    await startAt.fill('2026-10-16 12:00');
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('1 OR Monday');

    await expect(output).toContainText(
      '- Mon 2026-10-26 09:00 UTC\n- Sun 2026-11-01 09:00 UTC\n- Mon 2026-11-02 09:00 UTC',
    );

    await expect(page.getByTestId('result-summary')).toContainText(
      'Next run: Mon 2026-10-19 09:00 UTC. No job is created.',
    );

    for (const name of ['cron-explanation.txt', 'cron-expression.txt'])
      await expect(
        page.getByRole('button', { exact: true, name: `Download ${name}` }),
      ).toBeVisible();
    const pending = page.waitForEvent('download');

    await page.getByRole('button', { exact: true, name: 'Download cron-report.json' }).click();
    const path = await (await pending).path();

    if (!path) throw new Error('Missing cron audit export.');

    const report = JSON.parse(readFileSync(path, 'utf8'));

    expect(report.result.dayRule).toBe('or');
    expect(report.dayMatching).toBe('Vixie cron and cronie');
    expect(report.from).toBe('2026-10-16T12:00:00.000Z');

    expect(report.nextRuns.map((run: { text: string }) => run.text)[2]).toBe(
      'Sun 2026-11-01 09:00 UTC',
    );

    await page
      .getByRole('group', { name: 'Next runs in' })
      .getByRole('button', { name: 'This device' })
      .click();

    await page.getByRole('textbox', { name: /^Cron expression/ }).fill('0 9 * * MON-FRI');
    await page.keyboard.press('Control+Enter');

    await expect(output).toContainText(
      'Next 5 runs (Europe/Prague):\n- Mon 2026-10-19 09:00 UTC+02:00',
    );

    await page
      .getByRole('group', { name: 'Runs to list' })
      .getByRole('button', { name: '10' })
      .click();

    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('Next 10 runs (Europe/Prague):');
    await expect(output).toContainText('- Mon 2026-10-26 09:00 UTC+01:00');
    await samples.selectOption({ label: 'Explain: quarterly JSON audit' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(async () => JSON.parse((await output.textContent()) || '{}').result?.expression)
      .toBe('0 0 1 JAN,APR,JUL,OCT *');

    await page.screenshot({ fullPage: true, path: `test-results/cron-explain-${platform}.png` });
    await startAt.fill('2026-02-30');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('YYYY-MM-DD HH:MM');
    await startAt.fill('');
    await page.getByRole('textbox', { name: /^Cron expression/ }).fill('0 0 * * ?');
    await page.keyboard.press('Control+Enter');

    await expect(page.getByRole('alert')).toContainText(
      'Day of week: ? is Quartz or Spring syntax',
    );

    await expect(page.getByRole('button', { name: /^Download cron-/ })).toHaveCount(0);
    await samples.selectOption({ label: 'Explain: no compatible day in April' });
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('No calendar date');
    await expect(output).toContainText('No run in the next 25 years (UTC).');
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
