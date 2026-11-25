import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Gitignore Generator ${platform}: complete samples, order-sensitive rules, exact exports and audit`, async ({
    page,
  }) => {
    await openTool(page, platform, 'gitignore-generator');

    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = (): Promise<void> => page.keyboard.press('Control+Enter');
    const output = toolOutput(page);

    async function download(name: string): Promise<string> {
      const pending = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${name}` }).click();
      const path = await (await pending).path();

      if (!path) throw new Error('Missing gitignore download.');

      return readFileSync(path, 'utf8');
    }

    await samples.selectOption({ label: 'Node.js + macOS + VS Code' });
    await run();
    await expect(output).toContainText('node_modules/');
    await expect(output).toContainText('!.vscode/settings.json');
    await expect(page.getByTestId('result-summary')).toContainText('3 selected templates');
    const languages = page.getByRole('group', { exact: true, name: 'Languages' });

    expect(await languages.evaluate((element) => getComputedStyle(element).flexDirection)).toBe(
      'row',
    );

    expect(
      await page
        .getByRole('checkbox', { exact: true, name: 'Node.js' })
        .locator('..')
        .evaluate((element) => element.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(32);

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`gitignore-${platform}.png`),
    });

    await samples.selectOption({ label: 'Order-sensitive repeated patterns' });
    await run();
    await expect(page.getByRole('checkbox', { exact: true, name: 'Node.js' })).not.toBeChecked();
    const ordered = '# Custom rules\n*.log\n!keep.log\n*.log\n';

    await expect.poll(() => output.textContent()).toBe(ordered);
    expect(await download('.gitignore')).toBe(ordered);
    const audit = JSON.parse(await download('gitignore-report.json'));

    expect(audit.result.text).toBe(ordered);
    expect(audit.customLines).toEqual(['*.log', '!keep.log', '*.log']);
    expect(audit.result.customRuleCount).toBe(3);
    await samples.selectOption({ label: 'Escaped names and trailing space' });
    await run();
    const escaped = '# Custom rules\n\\#literal\n\\!literal\ntrailing\\ \n leading-name\n';

    await expect.poll(() => output.textContent()).toBe(escaped);
    expect(await download('.gitignore')).toBe(escaped);
    await samples.selectOption({ label: 'Keep a file inside dist' });
    await run();
    await expect(output).toContainText('dist/*\n!dist/keep.txt');
    expect(((await output.textContent()) ?? '').split('\n')).not.toContain('dist/');
    await samples.selectOption({ label: 'Exclusions do not remove custom rules' });
    await run();
    await expect(output).toContainText('# Custom rules\n.env\n!sample.env');
    await expect(page.getByTestId('result-summary')).toContainText('1 generated lines excluded');
    await samples.selectOption({ label: 'Comments and real blank lines' });
    await run();
    await expect(output).toContainText('# Cache files\n\ncache/*');
    await samples.selectOption({ label: 'Empty starter file' });
    await run();

    await expect
      .poll(() => output.textContent())
      .toBe('# Select one or more templates or add custom rules.\n');

    await page.getByRole('textbox', { name: /^Custom rules/ }).fill('x'.repeat(100001));
    await run();
    await expect(page.getByRole('alert')).toContainText('100,000');
    await expect(page.getByRole('button', { name: 'Download .gitignore' })).toHaveCount(0);

    await page
      .getByRole('textbox', { name: /^Custom rules/ })
      .fill('<script>window.injected=true</script>');

    await run();
    await expect(output).toContainText('<script>window.injected=true</script>');
    await expect(output.locator('script, img, iframe')).toHaveCount(0);
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is a .gitignore?',
      'When to generate a .gitignore',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
