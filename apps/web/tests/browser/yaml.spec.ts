import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

for (const platform of platforms) {
  for (const id of ['json-to-yaml', 'yaml-to-json']) {
    const isYamlOutput = id === 'json-to-yaml';
    const direction = isYamlOutput ? 'JSON → YAML' : 'YAML → JSON';
    const runName = isYamlOutput ? 'Convert to YAML' : 'Convert to JSON';
    const fileName = isYamlOutput ? 'converted.yaml' : 'converted.json';

    test(`YAML conversion ${platform} ${id}: one two-way guide, nested data, string types and exact Unicode download`, async ({
      page,
    }) => {
      await openTool(page, platform, id);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        isYamlOutput ? 'JSON ↔ YAML Converter' : 'YAML to JSON',
      );

      await expect(
        page.getByRole('group', { name: 'Direction' }).getByRole('button', { name: direction }),
      ).toHaveAttribute('aria-pressed', 'true');

      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveText([
        'What is JSON ↔ YAML conversion?',
        'When to convert between JSON and YAML',
        'How to use it',
        'Examples',
        'Notes',
      ]);

      await expect(
        guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
      ).toHaveCount(7);

      const output = toolOutput(page);

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: `${direction}: Nested users` });

      await page.getByRole('button', { exact: true, name: runName }).click();
      await expect(output).toContainText('Ada');

      if (isYamlOutput) {
        await expect(output).toContainText('- name: Ada');
        await expect(output).toContainText('roles: []');
      } else {
        expect(JSON.parse((await output.textContent()) ?? '')).toEqual({
          users: [
            { active: true, name: 'Ada', roles: ['admin', 'editor'] },
            { active: false, name: 'Grace', roles: [] },
          ],
        });
      }

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: `${direction}: Types and empty values` });

      await page.getByRole('button', { exact: true, name: runName }).click();

      if (isYamlOutput) {
        await expect(output).toContainText('code: "123"');
        await expect(output).toContainText('enabled: "true"');
        await expect(output).toContainText('settings: {}');
      } else {
        await expect(output).toContainText('"code": "123"');

        expect(JSON.parse((await output.textContent()) ?? '')).toEqual({
          active: true,
          code: '123',
          count: 123,
          date: '2026-10-10',
          emptyText: '',
          enabled: 'true',
          items: [],
          settings: {},
          value: null,
        });
      }

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: `${direction}: Multiline Unicode` });

      await page.getByRole('button', { exact: true, name: runName }).click();
      await expect(output).toContainText('Příliš žluťoučký kůň 🐎');

      if (!isYamlOutput) {
        expect(JSON.parse((await output.textContent()) ?? '').message).toBe(
          'First line.\nSecond line.\n',
        );
      }

      const converted = await output.textContent();
      const downloadPromise = page.waitForEvent('download');

      await expect(
        page.getByRole('button', { exact: true, name: `Download ${fileName}` }),
      ).toBeVisible();

      await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(fileName);
      const savedPath = await download.path();

      if (!savedPath) throw new Error('Converted download was not saved.');

      expect(readFileSync(savedPath, 'utf8')).toBe(converted);
      await page.getByRole('button', { name: 'Use result & reverse' }).click();

      await expect(
        page.getByRole('textbox', { exact: true, name: isYamlOutput ? 'YAML' : 'JSON' }),
      ).toHaveValue(converted ?? '');

      await page
        .getByRole('button', {
          exact: true,
          name: isYamlOutput ? 'Convert to JSON' : 'Convert to YAML',
        })
        .click();

      await expect(output).toContainText('Příliš žluťoučký kůň 🐎');

      await page
        .locator('.tool-workspace')
        .screenshot({ path: `test-results/${id}-${platform}-workspace.png` });

      await page.screenshot({ fullPage: true, path: `test-results/${id}-${platform}.png` });
      await page.setViewportSize({ height: 844, width: 390 });

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }

  test(`YAML conversion ${platform}: malformed input clears stale output and anchors expand safely`, async ({
    page,
  }) => {
    await openTool(page, platform, 'yaml-to-json');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'YAML → JSON: Anchors and merge keys' });

    await page.getByRole('button', { exact: true, name: 'Convert to JSON' }).click();
    const output = toolOutput(page);

    await expect(output).toContainText('localhost');

    expect(JSON.parse((await output.textContent()) ?? '').server).toEqual({
      host: 'localhost',
      port: 8080,
      retries: 5,
    });

    for (const source of ['a: 1\na: 2', 'id: 9007199254740993', 'value: [unterminated']) {
      await toolInput(page).fill(source);
      await page.getByRole('button', { exact: true, name: 'Convert to JSON' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(output).toHaveCount(0);

      await expect(
        page.getByRole('button', { exact: true, name: 'Download converted.json' }),
      ).toHaveCount(0);
    }

    await page
      .getByRole('group', { name: 'Direction' })
      .getByRole('button', { name: 'JSON → YAML' })
      .click();

    await toolInput(page).fill('{"value":}');
    await page.getByRole('button', { exact: true, name: 'Convert to YAML' }).click();
    await expect(page.getByRole('alert')).toContainText('Invalid JSON');
    await expect(toolOutput(page)).toHaveCount(0);
  });
}
