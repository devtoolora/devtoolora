import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { prefixSuffixLinesTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Prefix/Suffix Lines tool', () => {
  it('exports exact affixed UTF-8 and accurate change counts', async () => {
    const result = await prefixSuffixLinesTool.run({
      fields: { prefix: '- ', suffix: ';' },
      text: 'one\r\ntwo\rthree\n',
    });

    assert.equal(result.text, '- one;\r\n- two;\r- three;\n');
    assert.equal(result.artifact?.fileName, 'affixed-lines.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /3 changed lines.*3 prefix changes.*3 suffix changes/);
  });

  it('provides complete samples, documentation and valid no-op or empty results', async () => {
    assert.equal(contentOf(prefixSuffixLinesTool).documentation?.length, 2);

    for (const sample of prefixSuffixLinesTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 6);
      const result = await prefixSuffixLinesTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal((await prefixSuffixLinesTool.run({ fields: {}, text: '' })).artifact?.base64, '');
    const empty = await prefixSuffixLinesTool.run({
      fields: { mode: 'remove', prefix: '[', suffix: ']' },
      text: '[]',
    });

    assert.equal(empty.artifact?.base64, '');
    assert.match(empty.summary ?? '', /Warning:/);
    assert.equal((await prefixSuffixLinesTool.run({ fields: {}, text: 'x\r\n' })).text, 'x\r\n');
  });

  it('validates active modes and ignores the inactive add-only setting in remove mode', async () => {
    const invalid: Array<Record<string, string>> = [
      { blankLines: 'bad' },
      { mode: 'bad' },
      { placement: 'bad' },
      { repeat: 'bad' },
      { prefix: '\r\n' },
    ];

    for (const fields of invalid)
      await assert.rejects(
        async () => prefixSuffixLinesTool.run({ fields, text: 'a' }),
        /Choose|single-line/,
      );

    assert.equal(
      (
        await prefixSuffixLinesTool.run({
          fields: { mode: 'remove', prefix: '[', repeat: 'bad' },
          text: '[x',
        })
      ).text,
      'x',
    );
  });
});
