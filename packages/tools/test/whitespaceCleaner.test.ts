import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { whitespaceCleanerTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Whitespace Cleaner tool', () => {
  it('keeps markers preview-only and exports exact TXT and full raw comparison', async () => {
    const text = '  one  \r\n\ttwo \n';
    const result = await whitespaceCleanerTool.run({ fields: {}, text });

    assert.equal(result.text, '  one\r\n\ttwo\n');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.equal(result.artifact?.fileName, 'cleaned-text.txt');
    assert.ok(result.textDiff?.rows.some((row) => row.before?.text.includes('·')));
    assert.ok(result.textDiff?.rows.some((row) => row.before?.text.includes('↹')));
    const report = JSON.parse(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.equal(report.originalText, text);
    assert.equal(report.cleanedText, result.text);
    assert.equal(report.comparison.rows[0].before.text, '  one  ');
    const json = await whitespaceCleanerTool.run({ fields: { preview: 'report' }, text });

    assert.equal(json.artifact?.fileName, 'whitespace-report.json');
    assert.deepEqual(json.resultActions, ['copy', 'scratch', 'save']);
    assert.equal(JSON.parse(json.text).cleanedText, result.text);
  });

  it('offers complete guides and resettable samples including empty results', async () => {
    assert.equal(contentOf(whitespaceCleanerTool).documentation?.length, 2);

    for (const sample of whitespaceCleanerTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 8);
      const result = await whitespaceCleanerTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    const empty = await whitespaceCleanerTool.run({ fields: {}, text: '' });

    assert.equal(empty.text, '');
    assert.equal(empty.artifact?.base64, '');

    await assert.rejects(
      async () => whitespaceCleanerTool.run({ fields: { trimText: 'yes' }, text: 'x' }),
      /true or false/,
    );

    await assert.rejects(
      async () => whitespaceCleanerTool.run({ fields: { lineEndings: 'auto' }, text: 'x' }),
      /Preserve/,
    );

    await assert.rejects(
      async () => whitespaceCleanerTool.run({ fields: { preview: 'bad' }, text: 'x' }),
      /JSON report/,
    );
  });

  it('still cleans successfully when a comparison is too large to render', async () => {
    const result = await whitespaceCleanerTool.run({
      fields: { lineEndings: 'crlf' },
      text: ('x'.repeat(9) + '\n').repeat(10_000),
    });

    assert.equal(result.text.length, 110_000);
    assert.equal(result.textDiff, undefined);
    assert.match(result.summary ?? '', /Comparison unavailable/);

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    const report = JSON.parse(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.equal(report.cleanedText, result.text);
    assert.match(report.comparisonUnavailable, /100,000/);
  });
});
