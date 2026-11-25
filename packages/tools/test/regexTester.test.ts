import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { regexTestTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Regex Tester adapter', () => {
  it('has complete samples, exact report and optional replacement artifacts', async () => {
    assert.equal(contentOf(regexTestTool).documentation?.length, 2);

    for (const sample of regexTestTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 5);
      const result = await regexTestTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );

      if (sample.fields?.previewReplacement === 'true')
        assert.equal(
          Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
          JSON.parse(result.text).replacementPreview,
        );
    }
  });

  it('accepts empty text and rejects invalid options, while reports cannot replace the input', async () => {
    const result = await regexTestTool.run({
      fields: { pattern: '.', previewReplacement: 'true', replacement: '' },
      text: 'x',
    });

    assert.equal(result.artifacts?.[0]?.base64, '');
    assert.ok(!regexTestTool.resultActions?.includes('replace'));
    const fields: Array<Record<string, string>> = [
      { output: 'csv' },
      { previewReplacement: 'yes' },
      { flags: 'gg' },
    ];

    for (const invalid of fields)
      await assert.rejects(async () => regexTestTool.run({ fields: invalid, text: '' }));
  });

  it('rejects replacements that split surrogate pairs instead of exporting corrupted UTF-8', async () => {
    const fields = { flags: 'g', pattern: '.', previewReplacement: 'true', replacement: '$&!' };

    await assert.rejects(
      async () => regexTestTool.run({ fields, text: '😀' }),
      /unpaired Unicode surrogates.*UTF-8/,
    );

    const result = await regexTestTool.run({ fields: { ...fields, flags: 'gu' }, text: '😀' });

    assert.equal(
      Buffer.from(result.artifacts?.[0]?.base64 ?? '', 'base64').toString('utf8'),
      '😀!',
    );

    const report = await regexTestTool.run({
      fields: { ...fields, previewReplacement: 'false' },
      text: '😀',
    });

    assert.equal(JSON.parse(report.text).count, 2);
  });
});
