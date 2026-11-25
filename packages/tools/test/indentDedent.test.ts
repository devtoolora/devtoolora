import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { indentDedentTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Indent/Dedent Text tool', () => {
  it('renders whitespace markers only in preview and keeps raw text in exports/audit', async () => {
    const result = await indentDedentTool.run({ fields: {}, text: 'one\r\ntwo\r' });

    assert.equal(result.text, '  one\r\n  two\r');
    assert.equal(result.textDiff?.rows[0]?.after?.text, '··one');
    const markers = await indentDedentTool.run({ fields: {}, text: '\tone two' });

    assert.equal(markers.textDiff?.rows[0]?.after?.text, '··↹one⍽two');
    assert.equal(result.artifact?.fileName, 'indented-text.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    const report = await indentDedentTool.run({
      fields: { mode: 'common', preview: 'report' },
      text: '\t one\n\t  two\n',
    });

    assert.equal(report.artifact?.fileName, 'indentation-report.json');
    assert.deepEqual(report.resultActions, ['copy', 'scratch', 'save']);
    assert.equal(JSON.parse(report.text).result.commonPrefix, '\t ');
    assert.equal(JSON.parse(report.text).result.text, 'one\n two\n');
    assert.equal(JSON.parse(report.text).comparison.rows[0].before.text, '\t one');
  });

  it('provides complete samples, valid zero/empty results and warnings for blank-body changes', async () => {
    assert.equal(contentOf(indentDedentTool).documentation?.length, 2);

    for (const sample of indentDedentTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 6);
      const result = await indentDedentTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal((await indentDedentTool.run({ fields: {}, text: '' })).artifact?.base64, '');

    assert.equal(
      (await indentDedentTool.run({ fields: { spaces: '0' }, text: 'one\r\n' })).text,
      'one\r\n',
    );

    assert.match(
      (
        await indentDedentTool.run({
          fields: { blankLines: 'include', mode: 'dedent' },
          text: '  ',
        })
      ).summary ?? '',
      /Warning:/,
    );

    const largePrefix = await indentDedentTool.run({
      fields: { mode: 'common' },
      text: ' '.repeat(99_999) + 'x',
    });

    assert.equal(largePrefix.text, 'x');
    assert.ok((largePrefix.summary?.length ?? 0) < 500);
  });

  it('preserves expanded output beyond the comparison text budget', async () => {
    const result = await indentDedentTool.run({
      fields: { spaces: '64' },
      text: 'a\n'.repeat(2_000),
    });

    assert.equal(result.text, (' '.repeat(64) + 'a\n').repeat(2_000));
    assert.equal(result.textDiff, undefined);
    assert.match(result.summary ?? '', /Comparison unavailable/);
    const audit = JSON.parse(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.match(audit.comparisonUnavailable, /100,000/);
    assert.equal(audit.result.text, result.text);
  });

  it('rejects malformed active settings and ignores inactive common-prefix drafts', async () => {
    const invalid: Array<Record<string, string>> = [
      { mode: 'bad' },
      { spaces: '' },
      { spaces: '1e2' },
      { spaces: '1.5' },
      { spaces: '65' },
      { unit: 'bad' },
      { blankLines: 'bad' },
      { partial: 'bad', mode: 'dedent' },
      { preview: 'bad' },
    ];

    for (const fields of invalid)
      await assert.rejects(
        async () => indentDedentTool.run({ fields, text: 'x' }),
        /Choose|Amount/,
      );

    assert.equal(
      (
        await indentDedentTool.run({
          fields: { mode: 'common', partial: 'bad', spaces: 'bad', unit: 'bad' },
          text: '  one',
        })
      ).text,
      'one',
    );

    assert.equal(
      (await indentDedentTool.run({ fields: { partial: 'bad' }, text: 'one' })).text,
      '  one',
    );
  });
});
