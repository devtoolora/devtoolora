import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { textReverserTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Text Reverser tool', () => {
  it('exports the exact selected reversal without normalizing Unicode or line endings', async () => {
    const result = await textReverserTool.run({
      fields: { scope: 'per-line' },
      text: 'Cafe\u0301\r\nabc\n',
    });

    assert.equal(result.text, 'e\u0301faC\r\ncba\n');
    assert.equal(result.artifact?.fileName, 'reversed-text.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /7 graphemes.*within each line/);
    const empty = await textReverserTool.run({ fields: {}, text: '' });

    assert.equal(empty.text, '');
    assert.equal(empty.artifact?.base64, '');
  });

  it('provides complete guides and working resettable samples', async () => {
    assert.equal(contentOf(textReverserTool).documentation?.length, 2);
    assert.ok((textReverserTool.samples?.length ?? 0) >= 8);

    for (const sample of textReverserTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 4);
      const result = await textReverserTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }
  });

  it('validates active options while ignoring irrelevant hidden draft settings', async () => {
    const invalidFields: Array<Record<string, string>> = [
      { mode: 'bad' },
      { scope: 'bad' },
      { characterUnit: 'bad' },
      { mode: 'words', wordSpacing: 'bad' },
    ];

    for (const fields of invalidFields) {
      await assert.rejects(async () => textReverserTool.run({ fields, text: 'abc' }), /Choose/);
    }

    assert.equal(
      (
        await textReverserTool.run({
          fields: { characterUnit: 'bad', mode: 'lines', scope: 'bad', wordSpacing: 'bad' },
          text: 'one\r\ntwo',
        })
      ).text,
      'two\r\none',
    );

    assert.equal(
      (
        await textReverserTool.run({
          fields: { characterUnit: 'bad', mode: 'words' },
          text: 'one two',
        })
      ).text,
      'two one',
    );
  });
});
