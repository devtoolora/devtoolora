import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { gtinValidatorTool as tool } from '../src/catalog/data/gtin-validator/tool';

describe('gtin validator tool', () => {
  it('defines the contract', () => {
    assert.equal(tool.id, 'gtin-validator');
    assert.equal(tool.name, 'ISBN / EAN / UPC / GTIN Validator');
    assert.equal(tool.category, 'Data');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.supportsSelection, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [['kind', 'auto']],
    );

    assert.deepEqual(tool.relatedToolIds, ['iban-validator', 'checksum', 'qr-code-generator']);
    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    for (const sample of tool.samples ?? []) {
      const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('builds the table and summary', async () => {
    const result = await tool.run({
      fields: { kind: 'auto' },
      text: '4006381333931\n4006381333932\n036000291452\nabc',
    });

    assert.equal(result.summary, '4 codes · 2 valid · 2 invalid');

    assert.deepEqual(result.jsonTable?.rows[2], [
      '036000291452',
      'UPC-A',
      'yes',
      '2',
      'EAN-13 0036000291452; GTIN-14 00036000291452',
    ]);

    assert.equal(result.text.split('\n')[0]?.startsWith('Input'), true);

    const single = await tool.run({ fields: { kind: 'auto' }, text: '73513537' });

    assert.equal(single.summary, '1 code · 1 valid · 0 invalid');
  });

  it('rejects empty input and unknown kinds', () => {
    assert.throws(
      () => tool.run({ fields: { kind: 'auto' }, text: ' ' }),
      (error) =>
        error instanceof ToolError &&
        error.message === 'Paste one ISBN, EAN, UPC or GTIN per line.',
    );

    assert.throws(
      () => tool.run({ fields: { kind: 'nope' }, text: '1' }),
      (error) => error instanceof ToolError && error.message === 'Choose a code type.',
    );
  });
});
