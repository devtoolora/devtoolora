import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { durationConverterTool } from '../src/catalog/dateTime';
import { contentOf } from './toolContent';

describe('duration converter tool', () => {
  it('declares its metadata and content', () => {
    assert.equal(durationConverterTool.category, 'Date & Time');
    assert.equal(durationConverterTool.autoRun, true);
    assert.match(contentOf(durationConverterTool).notes?.join(' ') ?? '', /1,000 years/);
  });

  it('converts a bare number using the unit field', async () => {
    const result = await durationConverterTool.run({ fields: { unit: 'm' }, text: '90' });

    assert.equal(JSON.parse(result.text).iso, 'PT1H30M');
    assert.match(result.summary ?? '', /1 h 30 min · 5400000 ms/);
  });

  it('reports readable errors', async () => {
    await assert.rejects(
      async () => durationConverterTool.run({ fields: {}, text: 'soon' }),
      /Enter a duration/,
    );

    await assert.rejects(
      async () => durationConverterTool.run({ fields: { unit: 'x' }, text: '5' }),
      /Choose/,
    );
  });
});
