import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  markdownTableGeneratorTool,
  tableGeneratorTool,
} from '../src/catalog/formatters/table-generator/tool';
import { contentOf } from './toolContent';
import { fieldsOf } from './tools.helpers';

const decoded = (base64: string | undefined) =>
  Buffer.from(base64 ?? '', 'base64').toString('utf8');

describe('table generator tool', () => {
  it('declares its fields', () => {
    assert.equal(tableGeneratorTool.id, 'table-generator');
    assert.equal(tableGeneratorTool.name, 'Table Generator');
    assert.equal(tableGeneratorTool.category, 'Formatters');
    assert.equal(tableGeneratorTool.inputKind, 'text');
    assert.equal(tableGeneratorTool.outputKind, 'text');
    assert.equal(tableGeneratorTool.supportsSelection, true);

    assert.deepEqual(
      fieldsOf(tableGeneratorTool)?.map(
        ({ defaultValue, id, label, options, presentation, type, visibleWhen }) => ({
          defaultValue,
          id,
          label,
          options,
          presentation,
          type,
          visibleWhen,
        }),
      ),
      [
        {
          defaultValue: 'auto',
          id: 'format',
          label: 'Input',
          options: [
            { label: 'Auto', value: 'auto' },
            { label: 'CSV', value: 'csv' },
            { label: 'JSON', value: 'json' },
          ],
          presentation: 'segmented',
          type: 'select',
          visibleWhen: undefined,
        },
        {
          defaultValue: 'markdown',
          id: 'output',
          label: 'Output',
          options: [
            { label: 'Markdown', value: 'markdown' },
            { label: 'HTML', value: 'html' },
            { label: 'ASCII', value: 'ascii' },
            { label: 'Unicode', value: 'unicode' },
          ],
          presentation: 'segmented',
          type: 'select',
          visibleWhen: undefined,
        },
        {
          defaultValue: 'left',
          id: 'align',
          label: 'Alignment',
          options: [
            { label: 'Left', value: 'left' },
            { label: 'Center', value: 'center' },
            { label: 'Right', value: 'right' },
          ],
          presentation: 'segmented',
          type: 'select',
          visibleWhen: undefined,
        },
        {
          defaultValue: 'true',
          id: 'header',
          label: 'First CSV row is the header',
          options: undefined,
          presentation: undefined,
          type: 'checkbox',
          visibleWhen: { field: 'format', is: ['auto', 'csv'] },
        },
      ],
    );

    assert.deepEqual(tableGeneratorTool.relatedToolIds, [
      'json-table',
      'csv-columns',
      'json-to-csv',
    ]);

    assert.equal(contentOf(tableGeneratorTool).faq?.length, 5);
    assert.ok((tableGeneratorTool.samples?.length ?? 0) >= 6);
  });

  it('writes each output with its language and artifact', async () => {
    const markdown = await tableGeneratorTool.run({
      fields: {},
      text: 'name,age\nAda,36\nGrace,85',
    });

    assert.equal(markdown.summary, '2 rows × 2 columns as Markdown.');
    assert.equal(markdown.language, 'markdown');
    assert.equal(markdown.artifact?.fileName, 'table.md');
    assert.equal(decoded(markdown.artifact?.base64), markdown.text);
    assert.match(markdown.text, /^\| name {2}\| age \|\n\| :-{4} \| :-- \|\n/);

    const html = await tableGeneratorTool.run({
      fields: { align: 'right', output: 'html' },
      text: '[["k"],["v"]]',
    });

    assert.equal(html.summary, '1 row × 1 column as HTML.');
    assert.equal(html.language, 'html');
    assert.equal(html.artifact?.fileName, 'table.html');
    assert.match(html.text, /<td style="text-align: right">v<\/td>/);

    const unicode = await tableGeneratorTool.run({
      fields: { output: 'unicode' },
      text: 'a\n1',
    });

    assert.equal(unicode.summary, '1 row × 1 column as Unicode.');
    assert.equal(unicode.language, 'plaintext');
    assert.equal(unicode.artifact?.fileName, 'table.txt');
    assert.equal(unicode.text, '┌───┐\n│ a │\n├───┤\n│ 1 │\n└───┘\n');

    const ascii = await tableGeneratorTool.run({ fields: { output: 'ascii' }, text: 'a\n1' });

    assert.equal(ascii.summary, '1 row × 1 column as ASCII.');
  });

  it('honors the header and input options', async () => {
    const noHeader = await tableGeneratorTool.run({
      fields: { header: 'false', output: 'ascii' },
      text: 'a,b',
    });

    assert.equal(noHeader.summary, '1 row × 2 columns as ASCII.');
    assert.match(noHeader.text, /Column 1/);

    const csvOnly = await tableGeneratorTool.run({ fields: { format: 'csv' }, text: '[1]' });

    assert.equal(csvOnly.summary, '0 rows × 1 column as Markdown.');
  });

  it('rejects unknown options and bad input', () => {
    for (const field of ['format', 'output', 'align']) {
      assert.throws(() => tableGeneratorTool.run({ fields: { [field]: '__proto__' }, text: 'a' }), {
        name: 'ToolError',
      });
    }

    assert.throws(() => tableGeneratorTool.run({ fields: { header: 'maybe' }, text: 'a' }), {
      message: 'Checkbox values must be true or false.',
    });

    assert.throws(
      () => tableGeneratorTool.run({ fields: {}, text: `[["a"]${',[1]'.repeat(300_000)}]` }),
      { message: 'The table is limited to 100,000 rows.' },
    );

    assert.throws(() => tableGeneratorTool.run({ fields: {}, text: '[]' }), {
      message: 'The table has no columns.',
    });
  });

  it('registers the Markdown Table Generator alias', () => {
    assert.equal(markdownTableGeneratorTool.id, 'markdown-table-generator');
    assert.equal(markdownTableGeneratorTool.name, 'Markdown Table Generator');
    assert.equal(markdownTableGeneratorTool.aliasOf, 'table-generator');
    assert.equal(markdownTableGeneratorTool.run, tableGeneratorTool.run);
  });
});
