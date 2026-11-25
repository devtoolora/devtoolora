import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

for (const platform of platforms) {
  test(`Docker Run to Compose ${platform}: argument boundaries, mounts, dollar safety and exact exports`, async ({
    page,
  }) => {
    await openTool(page, platform, 'docker-to-compose');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const input = page.getByTestId('input-panel').locator('textarea');
    const output = toolOutput(page);

    await samples.selectOption({ label: 'Command after image' });
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('image: "node:22"');
    await expect(output).toContainText('"--version"');
    await samples.selectOption({ label: 'Literal container dollar' });
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('$$HOME');

    async function download(name: string): Promise<string> {
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing Docker conversion export.');

      return readFileSync(path, 'utf8');
    }

    const yaml = await download('compose.yaml');

    expect(parse(yaml).services.app.command).toEqual(['sh', '-c', 'echo "$$HOME"']);
    const audit = JSON.parse(await download('docker-compose-report.json'));

    expect(audit.result.command).toEqual(['sh', '-c', 'echo "$HOME"']);
    expect(audit.result.text).toBe(yaml);
    expect(audit.runtimeValidated).toBe(false);
    await samples.selectOption({ label: 'Read-only bind mount' });
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('create_host_path: false');
    await expect(output).toContainText('read_only: true');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`docker-${platform}.png`),
    });

    await samples.selectOption({ label: 'Postgres container' });
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('name: "pgdata"');
    await expect(page.getByTestId('result-summary')).toContainText('secrets');
    await samples.selectOption({ label: 'Structured conversion audit' });
    await page.keyboard.press('Control+Enter');

    await expect
      .poll(async () => JSON.parse((await output.textContent()) || '{}').result?.image)
      .toBe('alpine');

    await input.fill('docker run --gpus all alpine');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('Unsupported Docker option: --gpus');

    await expect(
      page.getByRole('button', { name: /^Download (compose.yaml|docker-compose-report.json)$/ }),
    ).toHaveCount(0);

    await samples.selectOption({ label: 'Backslash continuation' });
    await page.keyboard.press('Control+Enter');
    await expect(output).toContainText('image: "nginx:alpine"');
    await input.fill('docker run alpine echo $HOME');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('unsupported');
    await samples.selectOption({ label: 'Interactive one-off container' });
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('result-summary')).toContainText('run --rm app');
    await input.fill('docker run alpine echo "unterminated');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByRole('alert')).toContainText('quote is not closed');
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is Docker Run to Compose?',
      'When to convert Docker Run to Compose',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
