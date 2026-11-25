import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { wrapTextTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Wrap/Unwrap Text tool', () => {
  it('exports exact output independently of changes and audit views', async () => {
    const result = await wrapTextTool.run({ fields: { width: '7' }, text: 'one two three\r\n' });

    assert.equal(result.text, 'one two\r\nthree\r\n');
    assert.ok(result.textDiff?.rows.length);
    assert.equal(result.artifact?.fileName, 'reflowed-text.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /1 → 2 physical lines.*1 inserted breaks/);
    const report = await wrapTextTool.run({
      fields: { preview: 'report', width: '7' },
      text: 'one two three',
    });

    assert.equal(report.artifact?.fileName, 'reflow-report.json');
    assert.deepEqual(report.resultActions, ['copy', 'scratch', 'save']);
    assert.equal(JSON.parse(report.text).result.text, 'one two\nthree');
    assert.equal(JSON.parse(report.text).originalText, 'one two three');
  });

  it('provides complete samples, documentation and exact empty or whitespace results', async () => {
    assert.equal(contentOf(wrapTextTool).documentation?.length, 2);

    for (const sample of wrapTextTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 8);
      const result = await wrapTextTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal((await wrapTextTool.run({ fields: {}, text: '' })).artifact?.base64, '');
    assert.equal((await wrapTextTool.run({ fields: {}, text: ' \t' })).text, ' \t');

    assert.match(
      (await wrapTextTool.run({ fields: { width: '2' }, text: 'long' })).summary ?? '',
      /1 over-width lines/,
    );
  });

  it('keeps exact large output when visual comparison exceeds its limits', async () => {
    const result = await wrapTextTool.run({
      fields: { longWords: 'break', width: '1' },
      text: 'x'.repeat(10_001),
    });

    assert.equal(result.text, Array.from({ length: 10_001 }, () => 'x').join('\n'));
    assert.equal(result.textDiff, undefined);
    assert.match(result.summary ?? '', /Comparison unavailable/);
    const report = JSON.parse(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.match(report.comparisonUnavailable, /10,000 physical lines/);
    assert.equal(report.result.text, result.text);
  });

  it('rejects malformed active settings and ignores hidden drafts from the other mode', async () => {
    const invalid: Array<Record<string, string>> = [
      { mode: 'bad' },
      { width: '' },
      { width: '1e2' },
      { width: '0' },
      { width: '2.5' },
      { longWords: 'bad' },
      { newLine: 'bad' },
      { spacing: 'bad' },
      { preview: 'bad' },
      { mode: 'unwrap', paragraphs: 'bad' },
      { joinWith: 'bad', mode: 'unwrap' },
    ];

    for (const fields of invalid)
      await assert.rejects(async () => wrapTextTool.run({ fields, text: 'x' }), /Choose|width/);

    assert.equal(
      (
        await wrapTextTool.run({
          fields: { longWords: 'bad', mode: 'unwrap', newLine: 'bad', width: 'bad' },
          text: 'a\nb',
        })
      ).text,
      'a b',
    );

    assert.equal(
      (await wrapTextTool.run({ fields: { joinWith: 'bad', paragraphs: 'bad' }, text: 'a b' }))
        .text,
      'a b',
    );
  });
});
