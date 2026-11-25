import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import { isoCodesTool as tool } from '../src/catalog/data/iso-codes/tool';
import { fieldsOf } from './tools.helpers';

describe('iso codes tool', () => {
  it('defines the contract', () => {
    assert.equal(tool.id, 'iso-codes');
    assert.equal(tool.name, 'Country, Currency & Language Codes');
    assert.equal(tool.category, 'Data');
    assert.equal(tool.inputKind, 'optionalText');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.supportsSelection, true);

    assert.deepEqual(
      tool.fields?.map((field) => [field.id, field.defaultValue]),
      [['kind', 'all']],
    );

    assert.deepEqual(tool.relatedToolIds, ['vat-validator', 'phone-formatter', 'number-formatter']);
    assert.equal(fieldsOf(tool)?.[0]?.presentation, 'segmented');
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
    const one = await tool.run({ fields: { kind: 'all' }, text: 'czech' });

    assert.equal(one.summary, '1 country · 1 currency · 1 language');
    assert.equal(one.jsonTable?.rows[0]?.[0], 'language');
    assert.deepEqual(one.jsonTable?.rows[1], ['country', 'CZ', 'CZE', '203', 'Czechia', '']);
    assert.equal(one.text.split('\n')[0]?.startsWith('Kind'), true);

    const all = await tool.run({ fields: { kind: 'country' }, text: '' });

    assert.equal(all.summary, '249 countries');

    const currencies = await tool.run({ fields: { kind: 'currency' }, text: 'jpy' });

    assert.equal(currencies.summary, '1 currency');
  });

  it('rejects unknown queries', () => {
    assert.throws(
      () => tool.run({ fields: { kind: 'all' }, text: 'zzzzqqq' }),
      (error) =>
        error instanceof ToolError &&
        error.message === 'No country, currency or language matches "zzzzqqq".',
    );
  });
});
