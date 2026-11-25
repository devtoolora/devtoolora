import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { numberLinesTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Number Lines tool', () => {
  it('exports exact raw terminators and precise count/range summaries', async () => {
    const result = await numberLinesTool.run({ fields: {}, text: 'one\r\ntwo\rthree\n' });

    assert.equal(result.text, '1. one\r\n2. two\r3. three\n');
    assert.equal(result.artifact?.fileName, 'numbered-lines.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /3 input physical lines.*3 numbered lines.*numbers 1 → 3/);
    const skipped = await numberLinesTool.run({
      fields: { blankLines: 'skip', start: '-2', step: '2', width: '3' },
      text: 'a\n\nb',
    });

    assert.equal(skipped.text, '-002. a\n\n000. b');
    assert.match(skipped.summary ?? '', /1 blank lines skipped.*numbers -2 → 0/);
  });

  it('provides complete resettable samples and valid empty or all-skipped results', async () => {
    assert.equal(contentOf(numberLinesTool).documentation?.length, 2);

    for (const sample of numberLinesTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 6);
      const result = await numberLinesTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal((await numberLinesTool.run({ fields: {}, text: '' })).artifact?.base64, '');

    assert.equal(
      (await numberLinesTool.run({ fields: { blankLines: 'skip' }, text: ' \t' })).text,
      ' \t',
    );

    assert.equal(
      (
        await numberLinesTool.run({
          fields: { separator: '', start: '+007', step: ' 0 ' },
          text: 'a',
        })
      ).text,
      '7a',
    );
  });

  it('rejects malformed decimal fields, unsupported options and range overflow without fallback', async () => {
    const invalid: Array<Record<string, string>> = [
      { start: '' },
      { start: '1e3' },
      { start: '1.5' },
      { start: '0x10' },
      { start: '9007199254740992' },
      { step: '' },
      { step: 'Infinity' },
      { width: '0' },
      { width: '21' },
      { width: '2.5' },
      { blankLines: 'bad' },
      { placement: 'bad' },
      { separator: '\n' },
    ];

    for (const fields of invalid)
      await assert.rejects(
        async () => numberLinesTool.run({ fields, text: 'a' }),
        /integer|Choose|Separator/,
      );

    await assert.rejects(
      async () => numberLinesTool.run({ fields: { start: '9007199254740991' }, text: 'a\nb' }),
      /safe integer range/,
    );
  });
});
