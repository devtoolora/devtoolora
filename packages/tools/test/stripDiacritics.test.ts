import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { stripDiacriticsTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Strip Diacritics tool', () => {
  it('exports exact stripped text separately from visual comparison and audit', async () => {
    const result = await stripDiacriticsTool.run({ fields: {}, text: 'čaj\r\ncafé\rkůň\n' });

    assert.equal(result.text, 'caj\r\ncafe\rkun\n');
    assert.ok(result.textDiff?.rows.length);
    assert.equal(result.artifact?.fileName, 'stripped-text.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /4 decomposed marks removed.*ASCII output/);
    const report = await stripDiacriticsTool.run({ fields: { preview: 'report' }, text: 'é / Ł' });

    assert.equal(report.artifact?.fileName, 'diacritics-report.json');
    assert.deepEqual(report.resultActions, ['copy', 'scratch', 'save']);
    assert.equal(JSON.parse(report.text).originalText, 'é / Ł');
    assert.equal(JSON.parse(report.text).result.text, 'e / Ł');
    assert.equal(JSON.parse(report.text).result.nonAsciiCodePoints, 1);
  });

  it('provides complete samples and truthful unchanged/non-ASCII/empty results', async () => {
    assert.equal(contentOf(stripDiacriticsTool).documentation?.length, 2);

    for (const sample of stripDiacriticsTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 2);
      const result = await stripDiacriticsTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal((await stripDiacriticsTool.run({ fields: {}, text: '' })).artifact?.base64, '');

    assert.equal(
      (await stripDiacriticsTool.run({ fields: { scope: 'diacritics' }, text: '\u0301' })).artifact
        ?.base64,
      '',
    );

    assert.match(
      (await stripDiacriticsTool.run({ fields: {}, text: 'Ł' })).summary ?? '',
      /Unchanged.*1 non-ASCII/,
    );

    assert.match(
      (await stripDiacriticsTool.run({ fields: { scope: 'marks' }, text: '♥️' })).summary ?? '',
      /Broad scope/,
    );
  });

  it('retains exact output and audit when input exceeds the comparison line limit', async () => {
    const text = 'é\n'.repeat(10_001);
    const result = await stripDiacriticsTool.run({ fields: {}, text });

    assert.equal(result.text, 'e\n'.repeat(10_001));
    assert.equal(result.textDiff, undefined);
    assert.match(result.summary ?? '', /Comparison unavailable/);
    const audit = JSON.parse(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
    );

    assert.match(audit.comparisonUnavailable, /10,000 physical lines/);
    assert.equal(audit.originalText, text);
    assert.equal(audit.result.text, result.text);
  });

  it('rejects invalid scopes and previews rather than silently broadening removal', async () => {
    await assert.rejects(
      async () => stripDiacriticsTool.run({ fields: { scope: 'bad' }, text: 'é' }),
      /Choose/,
    );

    await assert.rejects(
      async () => stripDiacriticsTool.run({ fields: { preview: 'bad' }, text: 'é' }),
      /Choose/,
    );
  });
});
