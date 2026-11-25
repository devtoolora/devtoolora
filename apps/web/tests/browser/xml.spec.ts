import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';
import { vscodeToolMetadata } from '../../../vscode/src/extension/toolMetadata.generated';
import { toolContentLoaders } from '../../../../packages/tools/src/catalog/content.generated';

const cases = [
  {
    fileName: 'formatted.xml',
    id: 'xml-format',
    runName: 'Run XML Format',
    sample: 'Mixed text and attributes',
  },
  {
    direction: 'JSON → XML',
    fileName: 'converted.xml',
    id: 'json-to-xml',
    runName: 'Convert to XML',
    sample: 'JSON → XML: Mixed Unicode content',
  },
  {
    direction: 'XML → JSON',
    fileName: 'converted.json',
    id: 'xml-to-json',
    runName: 'Convert to JSON',
    sample: 'XML → JSON: Mixed Unicode content',
  },
];

async function guideOf(id: string): Promise<{ paragraphs: number; titles: string[] }> {
  const tool = vscodeToolMetadata.find((entry) => entry.id === id);

  if (!tool) throw new Error(`Missing ${id} metadata.`);

  const { content } = await toolContentLoaders[tool.aliasOf ?? tool.id]();
  const sections = content.documentation ?? [];

  return {
    paragraphs:
      sections.reduce(
        (count, { content }) => count + (Array.isArray(content) ? 0 : content.split('\n\n').length),
        0,
      ) + (content.help ?? '').split('\n\n').filter(Boolean).length,
    titles: [...sections.map(({ title }) => title), 'How to use it', 'Examples', 'Notes'],
  };
}

for (const platform of platforms) {
  for (const entry of cases) {
    test(`XML tools ${platform} ${entry.id}: documentation, semantic content, options and exact download`, async ({
      page,
    }) => {
      await openTool(page, platform, entry.id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      const expected = await guideOf(entry.id);

      await expect(guide.locator('h3')).toHaveText(expected.titles);

      if (entry.direction) {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          entry.id === 'xml-to-json' ? 'XML to JSON' : 'JSON ↔ XML Converter',
        );

        expect(expected.titles.slice(0, 2)).toEqual([
          'What is JSON ↔ XML conversion?',
          'When to convert between JSON and XML',
        ]);

        await expect(
          page
            .getByRole('group', { name: 'Direction' })
            .getByRole('button', { name: entry.direction }),
        ).toHaveAttribute('aria-pressed', 'true');
      }

      await expect(
        guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
      ).toHaveCount(expected.paragraphs);

      const output = toolOutput(page);

      if (entry.direction) {
        await page
          .getByRole('combobox', { name: 'Apply sample' })
          .selectOption({ label: `${entry.direction}: Repeated users and attributes` });

        await page.getByRole('button', { exact: true, name: entry.runName }).click();
        await expect(output).toContainText('Grace');

        if (entry.id === 'xml-to-json') {
          const recovered = JSON.parse((await output.textContent()) ?? '').users.user;

          expect(recovered).toHaveLength(2);
          expect(recovered[0]['@attributes']).toEqual({ id: '001' });
          expect(recovered[0].roles.role).toEqual(['admin', 'editor']);
        } else {
          expect(((await output.textContent()) ?? '').match(/<user id=/g)).toHaveLength(2);
        }
      }

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: entry.sample });

      await page.getByRole('button', { exact: true, name: entry.runName }).click();
      await expect(output).toContainText('Příliš žluťoučký kůň 🐎.');

      if (entry.id === 'xml-format') {
        await expect(output).toContainText('<p>Hello <strong>world</strong>!</p>');
        await expect(output).toContainText('note="a > b"');
        await page.getByRole('button', { exact: true, name: '4 spaces' }).click();
        await page.getByRole('button', { exact: true, name: entry.runName }).click();
        await expect.poll(async () => output.textContent()).toContain('\n    <p>Hello');
      } else if (entry.id === 'xml-to-json') {
        expect(JSON.parse((await output.textContent()) ?? '').p['#content']).toEqual([
          'Hello ',
          { strong: 'world' },
          '! Příliš žluťoučký kůň 🐎.',
        ]);

        await page.getByRole('button', { exact: true, name: 'Preserve order' }).click();
        await page.getByRole('button', { exact: true, name: entry.runName }).click();
        await expect(output).toContainText('"#document"');
        const ordered = JSON.parse((await output.textContent()) ?? '')['#document'][0].p;

        expect(ordered['@attributes']).toEqual({ lang: 'cs' });
        expect(ordered['#content'][1].strong['#content']).toEqual(['world']);
      } else {
        await expect(output).toHaveText(
          '<p lang="cs">Hello <strong>world</strong>! Příliš žluťoučký kůň 🐎.</p>',
        );

        await expect(page.getByRole('button', { exact: true, name: 'Compact' })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
      }

      const converted = await output.textContent();
      const downloadPromise = page.waitForEvent('download');

      await expect(
        page.getByRole('button', { exact: true, name: `Download ${entry.fileName}` }),
      ).toBeVisible();

      await page.getByRole('button', { exact: true, name: `Download ${entry.fileName}` }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(entry.fileName);
      const savedPath = await download.path();

      if (!savedPath) throw new Error('XML tool download was not saved.');

      expect(readFileSync(savedPath, 'utf8')).toBe(converted);

      await page
        .locator('.tool-workspace')
        .screenshot({ path: `test-results/${entry.id}-${platform}-workspace.png` });

      await page.screenshot({ fullPage: true, path: `test-results/${entry.id}-${platform}.png` });
      await page.setViewportSize({ height: 844, width: 390 });

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }

  test(`XML tools ${platform}: ordered document round-trip, CDATA, comments and malformed-input errors`, async ({
    page,
  }) => {
    await openTool(page, platform, 'xml-to-json');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'XML → JSON: Ordered document' });

    await expect(page.getByRole('button', { exact: true, name: 'Preserve order' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { exact: true, name: 'Convert to JSON' }).click();
    const output = toolOutput(page);

    await expect(output).toContainText('"#cdata"');
    await expect(output).toContainText('"#comment"');
    const mapped = (await output.textContent()) ?? '';

    await page.getByRole('button', { name: 'Use result & reverse' }).click();
    await expect(page.getByRole('textbox', { exact: true, name: 'JSON' })).toHaveValue(mapped);
    await page.getByRole('button', { exact: true, name: 'Compact' }).click();
    await page.getByRole('button', { exact: true, name: 'Convert to XML' }).click();
    await expect(output).toContainText('<![CDATA[if (a < b) run();]]>');
    await expect(output).toContainText('<!--Local example-->');
    await toolInput(page).fill('{"invalid name":1}');
    await page.getByRole('button', { exact: true, name: 'Convert to XML' }).click();
    await expect(page.getByRole('alert')).toContainText('Not a valid XML');
    await expect(output).toHaveCount(0);

    await expect(
      page.getByRole('button', { exact: true, name: 'Download converted.xml' }),
    ).toHaveCount(0);

    for (const id of ['xml-format', 'xml-to-json']) {
      const runName = id === 'xml-format' ? 'Run XML Format' : 'Convert to JSON';

      await openTool(page, platform, id);
      await toolInput(page).fill('<root><child/></wrong>');
      await page.getByRole('button', { exact: true, name: runName }).click();
      await expect(page.getByRole('alert')).toContainText('Invalid XML');
      await expect(output).toHaveCount(0);

      await toolInput(page).fill(
        '<!DOCTYPE root SYSTEM "https://example.invalid/schema.dtd"><root/>',
      );

      await page.getByRole('button', { exact: true, name: runName }).click();
      await expect(page.getByRole('alert')).toContainText('DOCTYPE');
    }
  });
}
