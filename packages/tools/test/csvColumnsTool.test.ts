import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { csvColumnsTool } from '../src/catalog/formatters/csv-columns/tool';
import { contentOf } from './toolContent';

describe('csv columns tool', () => {
  it('selects, renames and summarizes', async () => {
    const result = await csvColumnsTool.run({
      fields: { columns: 'name,1', rename: 'name=full_name' },
      text: `${String.fromCharCode(0xfeff)}id,name,age\r\n1,Ada,36\r\n`,
    });

    assert.equal(result.text, 'full_name,id\nAda,1\n');
    assert.equal(result.summary, '2 rows, 2 columns.');
    assert.equal(result.artifact?.fileName, 'columns.csv');
    assert.deepEqual(csvColumnsTool.relatedToolIds, ['csv-delimiter-converter', 'json-to-csv']);
    assert.equal(contentOf(csvColumnsTool).faq?.length, 5);
  });

  it('transposes and uses singular summary', async () => {
    const result = await csvColumnsTool.run({
      fields: { columns: '1', transpose: 'true' },
      text: 'a\n1',
    });

    assert.equal(result.text, 'a,1\n');
    assert.equal(result.summary, '1 row, 2 columns.');
  });

  it('keeps tab output as a tsv file', async () => {
    const result = await csvColumnsTool.run({ fields: {}, text: 'a\tb\n1\t2' });

    assert.equal(result.text, 'a\tb\n1\t2\n');
    assert.equal(result.artifact?.fileName, 'columns.tsv');
  });

  it('reports errors and has enough samples', () => {
    assert.throws(() => csvColumnsTool.run({ fields: { columns: 'nope' }, text: 'a\n1' }), {
      message: /Unknown column "nope"\./,
    });

    assert.throws(() => csvColumnsTool.run({ fields: { transpose: 'yes' }, text: 'a' }), {
      message: /Checkbox values must be true or false\./,
    });

    assert.throws(() => csvColumnsTool.run({ fields: {}, text: ' ' }), {
      message: /CSV input is required/,
    });

    assert.ok((csvColumnsTool.samples?.length ?? 0) >= 6);
  });

  it('runs every sample', async () => {
    for (const sample of csvColumnsTool.samples ?? [])
      assert.ok(
        (await csvColumnsTool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' })).text,
      );
  });

  it('uses thousands separators in the summary', async () => {
    const text = `a\n${'1\n'.repeat(10_000)}`;
    const result = await csvColumnsTool.run({ fields: { columns: 'a' }, text });

    assert.equal(result.summary, '10,001 rows, 1 column.');
  });
});
