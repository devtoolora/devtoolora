import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { vatValidatorTool as tool } from '../src/catalog/data/vat-validator/tool';
import { fieldsOf } from './tools.helpers';

describe('vat validator tool', () => {
  it('defines the contract', () => {
    assert.equal(tool.id, 'vat-validator');
    assert.equal(tool.name, 'VAT Number Format Validator');
    assert.equal(tool.category, 'Data');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.supportsSelection, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [['country', '']],
    );

    const options = fieldsOf(tool)?.[0]?.options ?? [];

    assert.equal(options.length, 32);
    assert.deepEqual(options[0], { label: 'Auto (prefix)', value: '' });
    assert.deepEqual(options[10], { label: 'EL · Greece', value: 'EL' });

    assert.deepEqual(tool.relatedToolIds, ['iban-validator', 'iso-codes', 'number-formatter']);

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
      fields: { country: '' },
      text: 'DE136695976\nDE136695977\nES B12345678',
    });

    assert.equal(result.summary, '3 numbers · 2 valid · 1 invalid');
    assert.deepEqual(result.jsonTable?.rows[1], ['DE136695977', 'DE', 'ok', 'fail', 'invalid']);
    assert.equal(result.text.split('\n')[0]?.startsWith('Input'), true);

    const single = await tool.run({ fields: { country: 'DE' }, text: '136695976' });

    assert.equal(single.summary, '1 number · 1 valid · 0 invalid');
  });

  it('rejects empty input and unknown countries', () => {
    assert.throws(
      () => tool.run({ fields: { country: '' }, text: ' ' }),
      (error) => error instanceof ToolError && error.message === 'Paste one VAT number per line.',
    );

    assert.throws(
      () => tool.run({ fields: { country: 'QQ' }, text: '1' }),
      (error) => error instanceof ToolError && error.message === 'Choose a supported country code.',
    );
  });
});
