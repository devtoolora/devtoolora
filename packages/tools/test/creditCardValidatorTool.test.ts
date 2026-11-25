import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { creditCardValidatorTool as tool } from '../src/catalog/data/credit-card-validator/tool';

describe('credit card validator tool', () => {
  it('defines the contract', () => {
    assert.equal(tool.id, 'credit-card-validator');
    assert.equal(tool.name, 'Credit Card Validator & Test Numbers');
    assert.equal(tool.category, 'Data');
    assert.equal(tool.inputKind, 'optionalText');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.sensitiveInput, true);
    assert.equal(tool.freshResults, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['mode', 'validate'],
        ['brand', 'visa'],
        ['count', '5'],
      ],
    );

    assert.deepEqual(tool.relatedToolIds, ['iban-validator', 'fake-data-generator', 'checksum']);
    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    for (const sample of tool.samples ?? []) {
      const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(result.text, sample.label);
      assert.ok(result.summary, sample.label);
    }
  });

  it('validates and generates', async () => {
    const checked = await tool.run({
      fields: { mode: 'validate' },
      text: '4242424242424242\n4242424242424241\nabc',
    });

    assert.equal(checked.summary, '3 numbers · 1 valid · 2 invalid');

    assert.deepEqual(checked.jsonTable?.rows[0], [
      '4242 4242 4242 4242',
      'Visa',
      'ok',
      'ok',
      'valid',
    ]);

    const generated = await tool.run({
      fields: { brand: 'visa', count: '5', mode: 'generate' },
      text: '',
    });

    assert.equal(generated.summary, '5 Visa test numbers');
    assert.equal(generated.text.split('\n').length, 5);
  });

  it('rejects empty validate input', () => {
    assert.throws(
      () => tool.run({ fields: { mode: 'validate' }, text: '  ' }),
      (error) => error instanceof ToolError && error.message === 'Paste one card number per line.',
    );
  });

  it('formats generated numbers and rejects bad counts', async () => {
    const amex = await tool.run({
      fields: { brand: 'amex', count: '2', mode: 'generate' },
      text: '',
    });
    const visa = await tool.run({
      fields: { brand: 'visa', count: '2', mode: 'generate' },
      text: '',
    });

    for (const line of amex.text.split('\n')) assert.match(line, /^\d{4} \d{6} \d{5}$/);
    for (const line of visa.text.split('\n')) assert.match(line, /^\d{4} \d{4} \d{4} \d{4}$/);
    assert.equal(Buffer.from(visa.artifact?.base64 ?? '', 'base64').toString(), visa.text);

    for (const count of ['abc', '2.5']) {
      assert.throws(
        () => tool.run({ fields: { brand: 'visa', count, mode: 'generate' }, text: '' }),
        (error) =>
          error instanceof ToolError && error.message === 'Count must be between 1 and 100.',
      );
    }
  });
});
