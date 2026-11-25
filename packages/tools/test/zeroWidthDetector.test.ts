import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { zeroWidthDetectorTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Zero-Width Character Detector tool', () => {
  it('renders a source-position table and escapes actual controls in parseable complete JSON', async () => {
    const text = '😀\u200B\u202Etxt\u202C𠀀\u{E0100}';
    const result = await zeroWidthDetectorTool.run({ fields: {}, text });

    assert.ok(result.jsonTable);
    assert.equal(result.artifact?.fileName, 'invisible-characters.json');
    assert.deepEqual(result.resultActions, ['copy', 'scratch', 'save']);
    assert.ok(!result.text.includes('\u202E'));
    assert.ok(result.text.includes('\\u202E'));
    assert.ok(result.text.includes('\\uDB40\\uDD00'));
    const report = JSON.parse(result.text);

    assert.equal(report.originalText, text);
    assert.equal(report.result.text, text);
    assert.equal(report.result.removed, 0);
    assert.equal(report.result.count, 4);

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );
  });

  it('keeps labeled preview separate from exact targeted TXT cleanup and broad-scope reports', async () => {
    const text = '\uFEFFzero\u200Bwidth 👨‍👩‍👧‍👦 ♥️\n';
    const result = await zeroWidthDetectorTool.run({ fields: { mode: 'remove' }, text });

    assert.equal(result.text, 'zerowidth 👨‍👩‍👧‍👦 ♥️\n');
    assert.equal(result.artifact?.fileName, 'cleaned-invisibles.txt');
    assert.match(result.textDiff?.rows[0]?.before?.text ?? '', /\[BOM\].*\[ZWSP\].*\[ZWJ\]/);
    assert.equal(result.textDiff?.rows[0]?.before?.highlight, undefined);

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /6 declared characters found.*2 removed.*4 retained/);
    const audit = await zeroWidthDetectorTool.run({
      fields: { mode: 'remove', removalPreview: 'report', scope: 'joiners' },
      text: '👨‍👩‍👧‍👦',
    });

    assert.equal(audit.artifact?.fileName, 'invisible-characters.json');
    assert.deepEqual(audit.resultActions, ['copy', 'scratch', 'save']);
    assert.equal(JSON.parse(audit.text).result.text, '👨👩👧👦');
  });

  it('provides complete samples, zero-byte cleanup and exact fallback when comparison is unavailable', async () => {
    assert.equal(contentOf(zeroWidthDetectorTool).documentation?.length, 2);

    for (const sample of zeroWidthDetectorTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 4);
      const result = await zeroWidthDetectorTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal(
      (await zeroWidthDetectorTool.run({ fields: { mode: 'remove' }, text: '\u200B\uFEFF' }))
        .artifact?.base64,
      '',
    );

    const result = await zeroWidthDetectorTool.run({
      fields: { mode: 'remove' },
      text: 'x\n'.repeat(10_001),
    });

    assert.equal(result.text, 'x\n'.repeat(10_001));
    assert.equal(result.textDiff, undefined);
    assert.match(result.summary ?? '', /Comparison unavailable/);

    assert.equal(
      JSON.parse(Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8')).result
        .text,
      result.text,
    );
  });

  it('validates active controls without applying inactive destructive drafts', async () => {
    const invalid: Array<Record<string, string>> = [
      { mode: 'bad' },
      { detectionOutput: 'bad' },
      { mode: 'remove', removalPreview: 'bad' },
      { mode: 'remove', scope: 'bad' },
    ];

    for (const fields of invalid)
      await assert.rejects(async () => zeroWidthDetectorTool.run({ fields, text: 'x' }), /Choose/);
    const detected = await zeroWidthDetectorTool.run({
      fields: { removalPreview: 'bad', scope: 'all' },
      text: '👨‍👩‍👧‍👦',
    });

    assert.equal(JSON.parse(detected.text).result.removed, 0);
    const removed = await zeroWidthDetectorTool.run({
      fields: { detectionOutput: 'bad', mode: 'remove' },
      text: 'x\u200B',
    });

    assert.equal(removed.text, 'x');
  });
});
