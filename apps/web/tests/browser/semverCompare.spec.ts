import { expect, openTool, platforms, test, toolGuide, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  test(`Semver Compare ${platform}: prerelease precedence, exact numbers, audit and invalidation`, async ({
    page,
  }) => {
    await openTool(page, platform, 'semver-compare');
    const samples = page.getByRole('combobox', { name: 'Apply sample' });
    const run = page.getByRole('button', { exact: true, name: 'Run Semver Compare' });
    const output = toolOutput(page);
    const left = page.getByRole('textbox', { name: /^Left version/ });
    const right = page.getByRole('textbox', { name: /^Right version/ });

    await samples.selectOption({ label: 'Prerelease versus final release' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('Right has higher precedence');
    await expect(output).toContainText('"criterion": "release"');

    await page.screenshot({
      fullPage: true,
      path: test.info().outputPath(`semver-${platform}.png`),
    });

    await samples.selectOption({ label: 'Numeric prerelease identifiers' });
    await run.click();
    await expect(output).toContainText('Numeric identifiers are compared numerically.');
    await expect(output).toContainText('"comparison": -1');
    await samples.selectOption({ label: 'Different build, equal precedence' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('Equal precedence');
    await expect(output).toContainText('"identical": false');
    const pending = page.waitForEvent('download');

    await page
      .getByRole('button', { exact: true, name: 'Download semver-comparison.json' })
      .click();

    const path = await (await pending).path();

    if (!path) throw new Error('Missing SemVer audit download.');

    const audit = JSON.parse(readFileSync(path, 'utf8'));

    expect(audit.left.build).toEqual(['001']);
    expect(audit.right.build).toEqual(['002']);
    expect(audit.comparison).toBe(0);
    await right.fill('1.0.1');

    await expect(
      page.getByRole('button', { exact: true, name: 'Download semver-comparison.json' }),
    ).toHaveCount(0);

    await run.click();
    await expect(output).toContainText('"criterion": "patch"');
    await samples.selectOption({ label: 'Exact large core numbers' });
    await run.click();
    await expect(page.getByTestId('result-summary')).toContainText('Left has higher precedence');
    await expect(output).toContainText('"9007199254740993"');
    await samples.selectOption({ label: 'Longer prerelease sequence' });
    await run.click();
    await expect(output).toContainText('"criterion": "prerelease-length"');
    await samples.selectOption({ label: 'Case-sensitive ASCII order' });
    await run.click();
    await expect(output).toContainText('case-sensitive ASCII order');
    await right.fill('1.0.0-01');
    await run.click();

    await expect(page.getByRole('alert')).toContainText(
      'Right version: numeric prerelease identifiers cannot have leading zeroes.',
    );

    await expect(page.getByRole('button', { name: 'Download semver-comparison.json' })).toHaveCount(
      0,
    );

    await right.fill('1.0.0');
    await left.fill('v1.0.0');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('No v prefix');
    await left.fill('1.0.0<script>');
    await run.click();
    await expect(page.getByRole('alert')).toContainText('complete SemVer');
    await expect(page.getByRole('alert').locator('script, img, iframe')).toHaveCount(0);
    await samples.selectOption({ label: 'Identical versions' });
    await run.click();
    await expect(output).toContainText('"identical": true');
    await page.setViewportSize({ height: 844, width: 390 });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const guide = toolGuide(page, platform);

    if (platform === 'desktop') await guide.locator('summary').click();

    await expect(guide.locator('h3')).toHaveText([
      'What is Semantic Versioning?',
      'When to compare semantic versions',
      'How to use it',
      'Examples',
      'Notes',
    ]);
  });
}
