import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { textDiffTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Text Diff tool', () => {
  it('provides complete samples and exact structured and readable report artifacts', async () => {
    assert.equal(contentOf(textDiffTool).documentation?.length, 2);

    for (const sample of textDiffTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 6);
      const result = await textDiffTool.run({ fields: sample.fields ?? {}, text: '' });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );

      const parsed = JSON.parse(result.text);

      assert.equal(parsed.before, sample.fields?.left);
      assert.equal(parsed.after, sample.fields?.right);
      assert.ok(result.textDiff);

      assert.match(
        Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
        /not an applyable patch/,
      );
    }
  });

  it('keeps empty input valid, rejects invalid options and prevents overwriting sources with a report', async () => {
    const result = await textDiffTool.run({ fields: {}, text: 'ignored' });

    assert.equal(JSON.parse(result.text).rows.length, 0);
    assert.equal(result.textDiff, undefined);
    assert.ok(!textDiffTool.resultActions?.includes('replace'));
    const readable = await textDiffTool.run({
      fields: { left: 'a\nb', output: 'text', right: 'a\nc' },
      text: '',
    });

    assert.equal(readable.artifact?.fileName, 'text-diff.txt');

    assert.equal(
      Buffer.from(readable.artifact?.base64 ?? '', 'base64').toString('utf8'),
      readable.text,
    );

    assert.match(readable.text, /Before 2: "b" \[none\]/);
    assert.equal(readable.textDiff, undefined);
    const invalidFields: Record<string, string>[] = [
      { output: 'patch' },
      { ignoreCase: 'yes' },
      { ignoreWhitespace: 'yes' },
      { ignoreLineEndings: 'yes' },
    ];

    for (const fields of invalidFields) {
      await assert.rejects(async () => textDiffTool.run({ fields, text: '' }));
    }

    await assert.rejects(
      async () => textDiffTool.run({ fields: { ignoreCase: 'yes' }, text: '' }),
      /Ignore letter case must be true or false\./,
    );
  });
});
