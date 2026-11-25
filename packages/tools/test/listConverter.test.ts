import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { listConverterTool } from '../src/catalog/textLists';

describe('list converter tool', () => {
  it('declares its fields in order', () => {
    assert.equal(listConverterTool.category, 'Text');

    assert.equal(
      listConverterTool.fields?.map((field) => field.id).join(','),
      'input,output,quote,separator,trim,dropEmpty,dedupe',
    );
  });

  it('converts and summarizes', async () => {
    const sql = await listConverterTool.run({ fields: { output: 'sql' }, text: 'a\nb' });

    assert.equal(sql.text, "('a', 'b')");
    assert.match(sql.summary ?? '', /2 items · input lines/);

    assert.equal(
      (await listConverterTool.run({ fields: { output: 'json' }, text: 'a' })).artifact?.fileName,
      'list.json',
    );
  });

  it('reports readable errors', async () => {
    await assert.rejects(
      async () =>
        listConverterTool.run({
          fields: { output: 'custom', separator: 'x'.repeat(33) },
          text: 'a',
        }),
      /32/,
    );

    await assert.rejects(
      async () => listConverterTool.run({ fields: { input: 'xml' }, text: 'a' }),
      /Choose/,
    );
  });
});
