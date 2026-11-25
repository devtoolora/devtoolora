import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { findReplaceTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Find & Replace tool', () => {
  it('keeps raw TXT separate from before/after inspection and full audit', async () => {
    const result = await findReplaceTool.run({
      fields: { find: 'one', replacement: 'ONE' },
      text: 'one\r\ntwo\rone\n',
    });

    assert.equal(result.text, 'ONE\r\ntwo\rONE\n');
    assert.ok(result.textDiff?.rows.length);
    assert.equal(result.artifact?.fileName, 'replaced-text.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /2 replacement operations.*literal/);
    const report = await findReplaceTool.run({
      fields: { find: 'x', preview: 'report', replacement: 'y' },
      text: 'x x',
    });

    assert.equal(report.artifact?.fileName, 'replacement-report.json');
    assert.deepEqual(report.resultActions, ['copy', 'scratch', 'save']);
    assert.equal(JSON.parse(report.text).originalText, 'x x');
    assert.equal(JSON.parse(report.text).result.text, 'y y');
    assert.equal(JSON.parse(report.text).result.count, 2);
  });

  it('provides resettable samples, accurate unchanged counts and zero-byte exports', async () => {
    assert.equal(contentOf(findReplaceTool).documentation?.length, 2);
    assert.ok(!findReplaceTool.capabilities?.includes('browserMain'));

    for (const sample of findReplaceTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 8);
      const result = await findReplaceTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal(
      (await findReplaceTool.run({ fields: { find: 'remove' }, text: 'remove' })).artifact?.base64,
      '',
    );

    assert.match(
      (await findReplaceTool.run({ fields: { find: 'x', replacement: 'x' }, text: 'x x' }))
        .summary ?? '',
      /Unchanged.*2 replacement operations/,
    );
  });

  it('keeps exact output when comparison is too large and reports why', async () => {
    const result = await findReplaceTool.run({
      fields: { find: 'x', replacement: 'y'.repeat(4_000) },
      text: 'x'.repeat(26),
    });

    assert.equal(result.text.length, 104_000);
    assert.equal(result.textDiff, undefined);
    assert.match(result.summary ?? '', /Comparison unavailable/);
    const report = JSON.parse(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.match(report.comparisonUnavailable, /100,000/);
    assert.equal(report.result.text, result.text);
  });

  it('validates active settings and ignores inactive regex-only drafts', async () => {
    const invalid: Array<Record<string, string>> = [
      { regex: 'yes' },
      { caseSensitive: 'yes' },
      { occurrence: 'bad' },
      { preview: 'bad' },
      { flags: 'g', regex: 'true' },
      { regex: 'true', replacementMode: 'bad' },
    ];

    for (const fields of invalid)
      await assert.rejects(
        async () => findReplaceTool.run({ fields: { find: 'x', ...fields }, text: 'x' }),
        /Choose|Extra flags|must be true or false/,
      );

    assert.equal(
      (
        await findReplaceTool.run({
          fields: { find: 'x', flags: 'bad', replacement: '$&', replacementMode: 'bad' },
          text: 'x',
        })
      ).text,
      '$&',
    );
  });
});
