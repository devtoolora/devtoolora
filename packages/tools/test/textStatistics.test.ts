import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { textStatisticsTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Text Statistics tool', () => {
  it('provides complete samples and exact local exports', async () => {
    assert.equal(contentOf(textStatisticsTool).documentation?.length, 2);

    for (const sample of textStatisticsTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 3);
      const result = await textStatisticsTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );

      assert.equal(
        result.artifact?.fileName,
        sample.fields?.output === 'json' ? 'text-statistics.json' : 'text-statistics.txt',
      );
    }
  });

  it('accepts empty text, validates fields and does not offer source replacement', async () => {
    const result = await textStatisticsTool.run({ fields: { output: 'json' }, text: '' });

    assert.equal(JSON.parse(result.text).readingTimeSeconds, 0);
    assert.equal(JSON.parse(result.text).graphemes, 0);
    assert.ok(!textStatisticsTool.resultActions?.includes('replace'));
    const invalidFields: Array<Record<string, string>> = [
      { output: 'csv' },
      { locale: 'auto' },
      { wordsPerMinute: '1e2' },
      { wordsPerMinute: '49' },
      { wordsPerMinute: '200.5' },
    ];

    for (const fields of invalidFields) {
      await assert.rejects(async () => textStatisticsTool.run({ fields, text: 'one' }));
    }
  });
});
