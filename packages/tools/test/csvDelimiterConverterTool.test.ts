import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  csvDelimiterConverterTool,
  csvToTsvTool,
} from '../src/catalog/formatters/csv-delimiter-converter/tool';
import { contentOf } from './toolContent';

describe('csv delimiter converter tool', () => {
  it('converts BOM and CRLF semicolon CSV to TSV', async () => {
    const result = await csvDelimiterConverterTool.run({
      fields: {},
      text: '\uFEFFa;b\r\n"x;y";2\r\n',
    });

    assert.equal(result.text, 'a\tb\nx;y\t2\n');
    assert.equal(result.summary, '2 rows converted from semicolon to tab.');
    assert.equal(result.artifact?.fileName, 'converted.tsv');
    assert.equal(contentOf(csvDelimiterConverterTool).faq?.length, 5);
  });

  it('converts with chosen separators and quoting', async () => {
    const result = await csvDelimiterConverterTool.run({
      fields: { from: 'tab', quoteAll: 'true', to: 'pipe' },
      text: 'a\tb',
    });

    assert.equal(result.text, '"a"|"b"\n');
    assert.equal(result.summary, '1 row converted from tab to pipe.');
    assert.equal(result.artifact?.fileName, 'converted.csv');
  });

  it('offers the CSV to TSV alias', async () => {
    const result = await csvToTsvTool.run({ fields: {}, text: 'a,"b\tc"' });

    assert.equal(csvToTsvTool.aliasOf, 'csv-delimiter-converter');
    assert.equal(csvToTsvTool.name, 'CSV to TSV');
    assert.equal(result.text, 'a\t"b\tc"\n');
  });

  it('reports errors and has enough samples', () => {
    assert.throws(() => csvDelimiterConverterTool.run({ fields: { to: 'colon' }, text: 'a' }), {
      message: /Choose comma, semicolon, tab or pipe/,
    });

    assert.throws(() => csvDelimiterConverterTool.run({ fields: { from: 'x' }, text: 'a' }), {
      message: /Choose automatic detection, comma, semicolon, tab or pipe/,
    });

    assert.throws(() => csvDelimiterConverterTool.run({ fields: { to: 'toString' }, text: 'a' }), {
      message: /Choose comma, semicolon, tab or pipe as the output separator\./,
    });

    assert.throws(
      () => csvDelimiterConverterTool.run({ fields: { from: 'constructor' }, text: 'a' }),
      { message: /Choose automatic detection/ },
    );

    assert.ok((csvDelimiterConverterTool.samples?.length ?? 0) >= 6);
  });

  it('converts every sample', async () => {
    for (const sample of csvDelimiterConverterTool.samples ?? [])
      assert.ok(
        (
          await csvDelimiterConverterTool.run({
            fields: sample.fields ?? {},
            text: sample.text ?? '',
          })
        ).text,
      );
  });

  it('uses thousands separators in the summary', async () => {
    const text = `a\n${'1\n'.repeat(10_000)}`;
    const result = await csvDelimiterConverterTool.run({ fields: { to: 'semicolon' }, text });

    assert.equal(result.summary, '10,001 rows converted from comma to semicolon.');
  });
});
