import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Random Port Generator ${platform}: distinct candidates, manual generation, exact exports and errors`, async ({
    page,
  }) => {
    await openTool(page, platform, 'random-port');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Random Port Generator' });
    const output = toolOutput(page);
    const count = page.getByRole('spinbutton', { name: /^Count/ });
    const min = page.getByRole('spinbutton', { name: /^Min port/ });
    const max = page.getByRole('spinbutton', { name: /^Max port/ });

    await samples.selectOption({ label: 'Entire three-port range' });
    await expect(page.getByRole('button', { name: 'Download random-ports.txt' })).toHaveCount(0);
    await run.click();
    await expect(output).toBeVisible();
    await expect(page.getByTestId('result-summary')).toContainText('availability not checked');
    const text = await output.textContent();

    expect(
      (text ?? '')
        .split('\n')
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([3000, 3001, 3002]);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`ports-${platform}.png`),
    });

    async function download(name: string): Promise<string> {
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing random-port download.');

      return readFileSync(path, 'utf8');
    }

    expect(await download('random-ports.txt')).toBe(text);
    const audit = JSON.parse(await download('random-ports-report.json'));

    expect(audit.ports.join('\n')).toBe(text);
    expect(audit.availabilityChecked).toBe(false);
    expect(audit.distinct).toBe(true);
    expect(audit.range).toEqual({ max: 3002, min: 3000 });
    await count.fill('4');
    await expect(page.getByRole('button', { name: 'Download random-ports.txt' })).toHaveCount(0);
    await run.click();
    await expect(page.getByRole('alert')).toContainText('3 distinct ports');
    await count.fill('1.5');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('whole number');
    await count.fill('1');
    await min.fill('3002');
    await max.fill('3000');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('Min port must not exceed');
    await max.fill('65536');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('between 1 and 65535');
    await samples.selectOption({ label: 'Single upper-bound candidate' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('65535');
    expect(await download('random-ports.txt')).toBe('65535');
    await samples.selectOption({ label: 'Single System Port candidate' });
    await run.click();
    await expect.poll(() => output.textContent()).toBe('1');
    await expect(page.getByTestId('result-summary')).toContainText('System Ports');
    await samples.selectOption({ label: 'One thousand distinct candidates' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('1000 distinct port candidates');
    const large = JSON.parse(await download('random-ports-report.json'));

    expect(large.ports).toHaveLength(1000);
    expect(new Set(large.ports).size).toBe(1000);

    expect(
      large.ports.every((port: number) => Number.isInteger(port) && port >= 49152 && port <= 65535),
    ).toBe(true);

    await samples.selectOption({ label: 'Single upper-bound candidate' });
    await run.click();
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a random port candidate?',
      'When to generate port candidates',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
