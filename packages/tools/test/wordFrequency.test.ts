import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { wordFrequencyTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('word frequency tool', () => {
  it('returns a table, tab text and a pluralized summary', async () => {
    const result = await wordFrequencyTool.run({
      fields: { unit: 'words' },
      text: 'The cat and the hat. THE end',
    });

    assert.deepEqual(result.jsonTable?.columns, ['Rank', 'Value', 'Count', 'Percent']);
    assert.deepEqual(result.jsonTable?.rows[0], ['1', 'the', '3', '42.9%']);
    assert.ok(result.text.startsWith('the\t3\n'));
    assert.equal(result.summary, '7 words \u00B7 5 distinct');

    const single = await wordFrequencyTool.run({ fields: { unit: 'characters' }, text: 'a' });

    assert.equal(single.summary, '1 character \u00B7 1 distinct');
  });

  it('rejects a bad limit and has FAQ content', async () => {
    await assert.rejects(
      async () => wordFrequencyTool.run({ fields: { limit: '0' }, text: 'a' }),
      /1 to 1,000/,
    );

    assert.ok(contentOf(wordFrequencyTool).faq?.length);
  });

  it('ignores minLength in characters mode', async () => {
    const result = await wordFrequencyTool.run({
      fields: { minLength: 'x', unit: 'characters' },
      text: 'aab',
    });

    assert.ok(result.text);
  });
});
