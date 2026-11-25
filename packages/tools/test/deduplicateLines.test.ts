import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { deduplicateLinesTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Deduplicate Lines tool', () => {
  it('exports exact retained bodies and raw endings with accurate counts', async () => {
    const result = await deduplicateLinesTool.run({ fields: {}, text: 'Alpha\r\nbeta\ralpha\n' });

    assert.equal(result.text, 'Alpha\r\nbeta\r');
    assert.equal(result.artifact?.fileName, 'deduplicated-lines.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(
      result.summary ?? '',
      /3 input physical lines.*2 retained records.*1 duplicates removed/,
    );

    const joined = await deduplicateLinesTool.run({ fields: {}, text: 'x\rx\n\n' });

    assert.match(joined.summary ?? '', /2 retained records.*1 output physical lines.*Warning:/);
  });

  it('provides resettable samples, documentation and valid zero-byte exports', async () => {
    assert.equal(contentOf(deduplicateLinesTool).documentation?.length, 2);

    for (const sample of deduplicateLinesTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 5);
      const result = await deduplicateLinesTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal((await deduplicateLinesTool.run({ fields: {}, text: '' })).artifact?.base64, '');

    assert.equal(
      (await deduplicateLinesTool.run({ fields: { blankLines: 'remove' }, text: '\n \t\n' }))
        .artifact?.base64,
      '',
    );
  });

  it('rejects malformed active fields rather than silently changing comparison', async () => {
    const invalid: Array<Record<string, string>> = [
      { blankLines: 'bad' },
      { caseSensitive: 'yes' },
      { keep: 'bad' },
      { normalizeComparison: 'yes' },
      { trimComparison: 'yes' },
    ];

    for (const fields of invalid)
      await assert.rejects(
        async () => deduplicateLinesTool.run({ fields, text: 'a\na' }),
        /Choose|must be true or false/,
      );
  });
});
