import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isToolFieldHidden } from '@devtoolora/core';
import { joinSplitLinesTool } from '../src/catalog/textLists';

describe('join and split lines tool', () => {
  it('declares its fields in order', () => {
    assert.equal(joinSplitLinesTool.category, 'Text');

    assert.equal(
      joinSplitLinesTool.fields?.map((field) => field.id).join(','),
      'mode,separator,splitBy,length,trim,dropEmpty',
    );
  });

  it('joins with an escaped tab separator', async () => {
    const result = await joinSplitLinesTool.run({
      fields: { mode: 'join', separator: '\\t' },
      text: 'a\nb',
    });

    assert.equal(result.text, 'a\tb');
    assert.match(result.summary ?? '', /2 lines joined/);
    assert.equal(result.artifact?.fileName, 'joined.txt');
  });

  it('hides the split length while joining', () => {
    const values = { mode: 'join', splitBy: 'length' };

    assert.equal(isToolFieldHidden(joinSplitLinesTool, 'length', values), true);
    assert.equal(isToolFieldHidden(joinSplitLinesTool, 'splitBy', values), true);

    assert.equal(
      isToolFieldHidden(joinSplitLinesTool, 'length', { ...values, mode: 'split' }),
      false,
    );
  });

  it('ignores split-only fields when joining', async () => {
    const result = await joinSplitLinesTool.run({
      fields: { length: '0', mode: 'join', splitBy: 'bogus' },
      text: 'a\nb',
    });

    assert.equal(result.text, 'a, b');
  });

  it('splits by length', async () => {
    const result = await joinSplitLinesTool.run({
      fields: { length: '2', mode: 'split', splitBy: 'length' },
      text: 'abcd',
    });

    assert.equal(result.text, 'ab\ncd');
    assert.match(result.summary ?? '', /2 pieces/);
    assert.equal(result.artifact?.fileName, 'split.txt');
  });

  it('reports readable errors', async () => {
    await assert.rejects(
      async () =>
        joinSplitLinesTool.run({
          fields: { length: 'x', mode: 'split', splitBy: 'length' },
          text: 'a',
        }),
      /1 to 10,000/,
    );

    await assert.rejects(
      async () => joinSplitLinesTool.run({ fields: { mode: 'merge' }, text: 'a' }),
      /Choose/,
    );
  });
});
