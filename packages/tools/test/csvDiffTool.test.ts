import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { csvDiffTool } from '../src/catalog/formatters/csv-diff/tool';
import { contentOf } from './toolContent';

describe('csv diff tool', () => {
  it('reports rows by key as text and a table', async () => {
    const result = await csvDiffTool.run({
      fields: { key: 'id', left: 'id,v,old\n1,a,x\n2,b,y', right: 'id,v,new\r\n2,c,z\r\n3,d,w' },
      text: '',
    });

    assert.equal(
      result.text,
      [
        'Added column "new"',
        'Removed column "old"',
        'Removed key "1"',
        'Changed key "2": "v": "b" → "c"',
        'Added key "3"',
      ].join('\n'),
    );

    assert.equal(
      result.summary,
      '1 row added, 1 row removed, 1 row changed. 1 column added, 1 column removed.',
    );

    assert.deepEqual(result.jsonTable, {
      columns: ['Change', 'Key', 'Cells'],
      presentation: 'plain',
      rows: [
        ['removed', '1', ''],
        ['changed', '2', '"v": "b" → "c"'],
        ['added', '3', ''],
      ],
    });

    assert.equal(result.artifact?.fileName, 'csv-diff.txt');
    assert.deepEqual(csvDiffTool.relatedToolIds, ['json-diff', 'text-diff', 'csv-columns']);
    assert.equal(contentOf(csvDiffTool).faq?.length, 5);
  });

  it('compares row by row and reports no differences', async () => {
    const changed = await csvDiffTool.run({
      fields: { key: '', left: 'a\n1\n2', right: 'a\n1' },
      text: '',
    });
    const same = await csvDiffTool.run({ fields: { left: 'a\n1', right: 'a\r\n1\r\n' }, text: '' });

    assert.equal(changed.text, 'Removed row 2');
    assert.equal(changed.jsonTable?.columns[1], 'Row');
    assert.equal(changed.summary, '0 rows added, 1 row removed, 0 rows changed.');
    assert.equal(same.text, 'No differences.');
    assert.equal(same.jsonTable, undefined);
  });

  it('matches the key exactly and treats a blank key as row mode', async () => {
    const padded = await csvDiffTool.run({
      fields: { key: 'id ', left: '"id ",v\n1,a', right: '"id ",v\n1,b' },
      text: '',
    });
    const blank = await csvDiffTool.run({
      fields: { key: '  ', left: 'a\n1', right: 'a\n2' },
      text: '',
    });

    assert.equal(padded.text, 'Changed key "1": "v": "a" → "b"');
    assert.equal(blank.text, 'Changed row 1: "a": "1" → "2"');

    assert.throws(
      () => csvDiffTool.run({ fields: { key: ' id', left: 'id\n1', right: 'id\n1' }, text: '' }),
      {
        message: /Key column " id" not found in the first CSV\./,
      },
    );
  });

  it('says how many of the changes are shown', async () => {
    const rows = (value: string) =>
      `id,v\n${Array.from({ length: 10_001 }, (_, index) => `${index},${value}`).join('\n')}`;
    const result = await csvDiffTool.run({
      fields: { key: 'id', left: rows('a'), right: rows('b') },
      text: '',
    });

    assert.match(result.summary ?? '', / 10,000 of 10,001 changes shown\.$/);
    assert.match(result.text, /\n… 10,000 of 10,001 changes shown\.$/);

    assert.match(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      /… 10,000 of 10,001 changes shown\.$/,
    );

    assert.equal(result.jsonTable?.rows.length, 10_000);
  });

  it('reports errors and has enough samples', () => {
    assert.throws(
      () => csvDiffTool.run({ fields: { key: 'id', left: 'id\n1', right: 'v\n1' }, text: '' }),
      {
        message: /Key column "id" not found in the second CSV\./,
      },
    );

    assert.throws(() => csvDiffTool.run({ fields: { left: ' ', right: 'a' }, text: '' }), {
      message: /First CSV input is required\./,
    });

    assert.ok((csvDiffTool.samples?.length ?? 0) >= 6);
  });
});
