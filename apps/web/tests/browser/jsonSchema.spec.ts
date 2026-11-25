import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();

    const response = await route.fetch();

    await route.fulfill({
      headers: {
        ...response.headers(),
        'content-security-policy':
          "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self'; object-src 'none'",
      },
      response,
    });
  });
});

for (const platform of platforms) {
  for (const entry of [
    {
      id: 'json-schema-generator',
      name: 'JSON Schema Generator',
      titles: ['What is JSON Schema?', 'When to generate JSON Schema'],
    },
    {
      id: 'json-schema-validator',
      name: 'JSON Schema Validator',
      titles: ['What is JSON Schema validation?', 'When to validate JSON Schema'],
    },
  ]) {
    test(`JSON Schema tools ${platform} ${entry.id}: guide, samples, exact artifacts and error recovery`, async ({
      page,
    }) => {
      await openTool(page, platform, entry.id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      await expect(guide.locator('h3')).toHaveText([
        ...entry.titles,
        'How to use it',
        'Examples',
        'Notes',
      ]);

      await expect(
        guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
      ).toHaveCount(7);

      const output = toolOutput(page);
      const run = page.getByRole('button', { exact: true, name: `Run ${entry.name}` });

      if (entry.id === 'json-schema-validator') {
        const schemaInput = page.getByRole('textbox', { exact: true, name: 'JSON Schema' });

        await expect(schemaInput).toHaveAttribute('rows', '14');

        expect(
          await schemaInput.evaluate(
            (element: HTMLElement) => element.getBoundingClientRect().height,
          ),
        ).toBeGreaterThan(220);
      }

      await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({
        label:
          entry.id === 'json-schema-generator'
            ? 'Mixed types and null'
            : 'Multiple validation errors',
      });

      await run.click();

      await expect(output).toContainText(
        entry.id === 'json-schema-generator' ? 'anyOf' : 'Errors: 4',
      );

      if (entry.id === 'json-schema-generator') {
        const schema = JSON.parse((await output.textContent()) ?? '{}');

        expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(schema.items.required).toEqual(['value']);
        expect(schema.items.properties.value.anyOf).toHaveLength(3);
      } else {
        await expect(output).toContainText('/age');
        await expect(output).toContainText('[format]');
        await expect(output).toContainText('property "extra"');
      }

      const fileName =
        entry.id === 'json-schema-generator' ? 'schema.json' : 'validation-report.txt';
      const content = await output.textContent();
      const downloadPromise = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(fileName);
      const path = await download.path();

      if (!path) throw new Error('JSON Schema artifact was not saved.');

      expect(readFileSync(path, 'utf8')).toBe(content);

      await page
        .locator('.tool-workspace')
        .screenshot({ path: `test-results/${entry.id}-${platform}-workspace.png` });

      await page.screenshot({ fullPage: true, path: `test-results/${entry.id}-${platform}.png` });

      if (entry.id === 'json-schema-generator') {
        await page
          .getByRole('combobox', { name: 'Apply sample' })
          .selectOption({ label: 'Permissive nested objects' });

        await expect(
          page.getByRole('checkbox', { name: 'Allow additional properties' }),
        ).toBeChecked();

        await run.click();

        await expect
          .poll(async () => output.textContent())
          .toContain('"additionalProperties": true');

        expect(JSON.parse((await output.textContent()) ?? '{}').required).toBeUndefined();
        await page.getByRole('button', { exact: true, name: 'Draft 7' }).click();
        await run.click();

        await expect
          .poll(async () => output.textContent())
          .toContain('http://json-schema.org/draft-07/schema#');
      } else {
        await page
          .getByRole('combobox', { name: 'Apply sample' })
          .selectOption({ label: 'Invalid calendar date' });

        await run.click();
        await expect(output).toContainText('must match format "date"');
        await page.getByRole('checkbox', { name: 'Validate string formats' }).uncheck();
        await run.click();
        await expect(output).toContainText('Valid against schema.');
        await expect(output).toContainText('off (format constraints ignored)');

        await page
          .getByRole('combobox', { name: 'Apply sample' })
          .selectOption({ label: 'Local reference and JSON report' });

        await expect(page.getByRole('checkbox', { name: 'Validate string formats' })).toBeChecked();
        await run.click();
        await expect.poll(async () => output.textContent()).toContain('"valid": true');
        expect(JSON.parse((await output.textContent()) ?? '{}').draft).toBe('2020-12');
        const json = await output.textContent();
        const jsonDownloadPromise = page.waitForEvent('download');

        await page
          .getByRole('button', { exact: true, name: 'Download validation-report.json' })
          .click();

        const jsonDownload = await jsonDownloadPromise;
        const jsonPath = await jsonDownload.path();

        if (!jsonPath) throw new Error('JSON validation report was not saved.');

        expect(readFileSync(jsonPath, 'utf8')).toBe(json);
      }

      await page.setViewportSize({ height: 844, width: 390 });

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      if (entry.id === 'json-schema-generator')
        await toolInput(page).fill('{"id":9007199254740993}');
      else
        await page
          .getByRole('textbox', { exact: true, name: 'JSON Schema' })
          .fill('{"type":"object","requird":["id"]}');

      await run.click();

      await expect(page.getByRole('alert')).toContainText(
        entry.id === 'json-schema-generator' ? 'quote integers' : 'unknown keyword',
      );

      await expect(output).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    });
  }

  test(`JSON Schema tools ${platform}: generator-to-validator workflow, draft selection and newer keywords`, async ({
    page,
  }) => {
    await openTool(page, platform, 'json-schema-generator');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Mixed types and null' });

    const instance = await toolInput(page).inputValue();

    await page.getByRole('button', { exact: true, name: 'Run JSON Schema Generator' }).click();
    await expect(toolOutput(page)).toContainText('anyOf');
    const schema = await toolOutput(page).textContent();

    await openTool(page, platform, 'json-schema-validator');

    await toolInput(page).fill(instance);
    await page.getByRole('textbox', { exact: true, name: 'JSON Schema' }).fill(schema ?? '');
    const run = page.getByRole('button', { exact: true, name: 'Run JSON Schema Validator' });
    const output = toolOutput(page);

    await run.click();
    await expect(output).toContainText('Valid against schema.');
    await expect(output).toContainText('Draft: 2020-12');
    await page.getByRole('button', { exact: true, name: 'Draft 7' }).click();
    await run.click();
    await expect(page.getByRole('alert')).toContainText('conflicts');
    await expect(output).toHaveCount(0);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: '2020-12 tuple' });

    await run.click();
    await expect(output).toContainText('Valid against schema.');
    await toolInput(page).fill('["Ada","37"]');
    await run.click();
    await expect(output).toContainText('/1 — must be integer [type]');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: '2019-09 dependencies' });

    await run.click();
    await expect(output).toContainText('[dependentRequired]');
    await expect(output).toContainText('Draft: 2019-09');

    await page
      .getByRole('textbox', { exact: true, name: 'JSON Schema' })
      .fill('{"$ref":"https://example.com/remote.json"}');

    const requestedUrls: string[] = [];

    page.on('request', (request) => requestedUrls.push(request.url()));
    await run.click();
    await expect(page.getByRole('alert')).toContainText('resolve reference');
    expect(requestedUrls.some((url) => url.includes('example.com'))).toBe(false);
  });
}
