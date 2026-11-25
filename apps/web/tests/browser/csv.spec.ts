import { expect, openTool, platforms, test, toolGuide, toolInput, toolOutput } from './fixtures';
import { readFileSync } from 'node:fs';
import { vscodeToolMetadata } from '../../../vscode/src/extension/toolMetadata.generated';
import { toolContentLoaders } from '../../../../packages/tools/src/catalog/content.generated';

const cases = [
  { direction: 'JSON → CSV', id: 'json-to-csv', runName: 'Convert to CSV' },
  { direction: 'CSV → JSON', id: 'csv-to-json', runName: 'Convert to JSON' },
  { id: 'csv-profiler', runName: 'Run CSV Profiler' },
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
    test(`CSV tools ${platform} ${entry.id}: guide, quoted Unicode cells, separators and exact download`, async ({
      page,
    }) => {
      await openTool(page, platform, entry.id);
      const guide = toolGuide(page, platform);

      if (platform === 'desktop') await guide.locator('summary').click();

      const expected = await guideOf(entry.id);

      await expect(guide.locator('h3')).toHaveText(expected.titles);

      await expect(
        guide.locator(platform === 'web' ? 'p:not([data-testid="eyebrow"])' : 'p'),
      ).toHaveCount(expected.paragraphs);

      const sample = (label: string) => (entry.direction ? `${entry.direction}: ${label}` : label);

      if (entry.direction) {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          entry.id === 'csv-to-json' ? 'CSV to JSON' : 'JSON ↔ CSV Converter',
        );

        expect(expected.titles.slice(0, 2)).toEqual([
          'What is JSON ↔ CSV conversion?',
          'When to convert between JSON and CSV',
        ]);

        await expect(
          page
            .getByRole('group', { name: 'Direction' })
            .getByRole('button', { name: entry.direction }),
        ).toHaveAttribute('aria-pressed', 'true');
      }

      await page
        .getByRole('combobox', { name: 'Apply sample' })
        .selectOption({ label: sample('Quoted headers and Unicode') });

      const run = page.getByRole('button', { exact: true, name: entry.runName });
      const output = toolOutput(page);

      await run.click();
      await expect(output).toContainText('Příliš žluťoučký kůň 🐎.');

      if (entry.id === 'json-to-csv') {
        await expect.poll(async () => output.textContent()).toContain('"last,name",note\n');

        await expect
          .poll(async () => output.textContent())
          .toContain('"He said ""yes"".\nSecond line."');

        await page.getByRole('button', { exact: true, name: 'Semicolon' }).click();
        await page.getByRole('button', { exact: true, name: 'CRLF' }).click();
        await run.click();
        await expect.poll(async () => output.textContent()).toContain('last,name;note\r\n');

        await expect
          .poll(async () => output.textContent())
          .toContain('"He said ""yes"".\nSecond line."');
      } else if (entry.id === 'csv-to-json') {
        expect(JSON.parse((await output.textContent()) ?? '')).toEqual([
          { 'last,name': 'Příliš žluťoučký kůň 🐎.', note: 'He said "yes".\nSecond line.' },
        ]);
      } else {
        await expect(output).toContainText('Rows: 1');
        await expect(output).toContainText('## last,name');

        await expect
          .poll(async () => output.textContent())
          .toContain('Samples: "He said \\"yes\\".\\nSecond line."');
      }

      const fileName =
        entry.id === 'json-to-csv'
          ? 'converted.csv'
          : entry.id === 'csv-to-json'
            ? 'converted.json'
            : 'csv-profile.md';
      const converted = await output.textContent();
      const downloadPromise = page.waitForEvent('download');

      await page.getByRole('button', { exact: true, name: `Download ${fileName}` }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe(fileName);
      const path = await download.path();

      if (!path) throw new Error('CSV tool download was not saved.');

      expect(readFileSync(path, 'utf8')).toBe(converted);

      await page
        .locator('.tool-workspace')
        .screenshot({ path: `test-results/${entry.id}-${platform}-workspace.png` });

      await page.screenshot({ fullPage: true, path: `test-results/${entry.id}-${platform}.png` });

      await page.getByRole('combobox', { name: 'Apply sample' }).selectOption({
        label: sample(
          entry.id === 'json-to-csv' ? 'Tab-separated export' : 'Tab-separated records',
        ),
      });

      await expect(page.getByRole('button', { exact: true, name: 'Tab' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await run.click();
      if (entry.id === 'json-to-csv') {
        await expect.poll(async () => output.textContent()).toContain('id\tname\tnote\n');

        await expect(
          page.getByRole('button', { exact: true, name: 'Download converted.tsv' }),
        ).toBeVisible();

        const tsv = await output.textContent();
        const tsvDownloadPromise = page.waitForEvent('download');

        await page.getByRole('button', { exact: true, name: 'Download converted.tsv' }).click();
        const tsvDownload = await tsvDownloadPromise;

        expect(tsvDownload.suggestedFilename()).toBe('converted.tsv');
        const tsvPath = await tsvDownload.path();

        if (!tsvPath) throw new Error('TSV download was not saved.');

        expect(readFileSync(tsvPath, 'utf8')).toBe(tsv);
      } else if (entry.id === 'csv-to-json') {
        await expect(output).toContainText('Ada');

        expect(JSON.parse((await output.textContent()) ?? '')[0]).toEqual({
          id: '001',
          name: 'Ada',
          note: 'one\ttwo',
        });
      } else
        await expect
          .poll(async () => output.textContent())
          .toContain('Samples: "one\\ttwo", "done"');

      await page.setViewportSize({ height: 844, width: 390 });

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      await toolInput(page).fill(entry.id === 'json-to-csv' ? '[1]' : 'a,b\n"ok"oops,2');

      await run.click();

      await expect(page.getByRole('alert')).toContainText(
        entry.id === 'json-to-csv' ? 'array of objects' : 'CSV line 2, column 5',
      );

      await expect(output).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Download / })).toHaveCount(0);
    });
  }

  test(`CSV tools ${platform}: blank-line controls, leading-zero IDs, integer ranges and formula-prefix choice`, async ({
    page,
  }) => {
    await openTool(page, platform, 'csv-to-json');
    const output = toolOutput(page);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'CSV → JSON: Leading zeros and empty records' });

    await page.getByRole('button', { exact: true, name: 'Convert to JSON' }).click();
    await expect(output).toContainText('9007199254740993');

    expect(JSON.parse((await output.textContent()) ?? '')).toEqual([
      { active: 'true', id: '00123', note: '' },
      { active: '', id: '', note: '' },
      { active: 'false', id: '9007199254740993', note: '  text  ' },
    ]);

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'CSV → JSON: Retain one-column blank lines' });

    await expect(page.getByRole('checkbox', { name: 'Skip blank lines' })).not.toBeChecked();
    await page.getByRole('button', { exact: true, name: 'Convert to JSON' }).click();
    await expect(output).toContainText('first');
    expect(JSON.parse((await output.textContent()) ?? '')).toHaveLength(4);
    await page.getByRole('checkbox', { name: 'Skip blank lines' }).check();
    await page.getByRole('button', { exact: true, name: 'Convert to JSON' }).click();
    await expect.poll(async () => JSON.parse((await output.textContent()) ?? '[]').length).toBe(3);
    await openTool(page, platform, 'csv-profiler');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'Identifiers and precise integers' });

    await page.getByRole('button', { exact: true, name: 'Run CSV Profiler' }).click();

    await expect
      .poll(async () => toolOutput(page).textContent())
      .toContain('Min: 9007199254740993\nMax: 9007199254740995');

    await expect(toolOutput(page)).toContainText('Rows: 3');
    await openTool(page, platform, 'json-to-csv');

    await page
      .getByRole('combobox', { name: 'Apply sample' })
      .selectOption({ label: 'JSON → CSV: Formula-like strings' });

    await expect(page.getByRole('checkbox', { name: 'Prefix formula-like text' })).toBeChecked();
    await page.getByRole('button', { exact: true, name: 'Convert to CSV' }).click();

    await expect.poll(async () => toolOutput(page).textContent()).toContain('"\'=1+1",-5,001');

    await page.getByRole('checkbox', { name: 'Prefix formula-like text' }).uncheck();
    await page.getByRole('button', { exact: true, name: 'Convert to CSV' }).click();

    await expect.poll(async () => toolOutput(page).textContent()).toContain('\n=1+1,-5,001');
  });
}
