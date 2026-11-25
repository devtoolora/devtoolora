import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { romanNumeralsTool } from '../src/catalog/math';
import { contentOf } from './toolContent';

const run = (text: string) => romanNumeralsTool.run({ fields: {}, text });

describe('Roman numerals tool', () => {
  it('declares its metadata', () => {
    assert.equal(romanNumeralsTool.id, 'roman-numerals');
    assert.equal(romanNumeralsTool.name, 'Roman Numeral Converter');
    assert.equal(romanNumeralsTool.category, 'Math');
    assert.equal(romanNumeralsTool.inputKind, 'text');
    assert.equal(romanNumeralsTool.outputKind, 'text');
    assert.equal(romanNumeralsTool.fields, undefined);
    assert.deepEqual(romanNumeralsTool.relatedToolIds, ['number-to-words', 'base-converter']);
    assert.equal(contentOf(romanNumeralsTool).faq?.length, 4);
    assert.ok((romanNumeralsTool.samples?.length ?? 0) >= 6);
  });

  it('converts mixed valid and invalid lines', async () => {
    const result = await run('2024\nXIV\nIIII\n0\n\nhello');

    assert.equal(
      result.text,
      '2024 → MMXXIV\nXIV → 14\nIIII → error: not a standard Roman numeral; standard form is IV.\n0 → error: Roman numerals cover 1-3,999.\n\nhello → error: use digits or the letters I, V, X, L, C, D and M.\n',
    );

    assert.equal(result.summary, '2 converted · 3 invalid');
    assert.equal(result.artifact?.fileName, 'roman-numerals.txt');
  });

  it('runs every sample', async () => {
    for (const sample of romanNumeralsTool.samples ?? []) {
      const result = await run(sample.text ?? '');

      assert.match(result.text, /→/, sample.label);
    }
  });

  it('reports the line limits', async () => {
    await assert.rejects(async () => run('1\n'.repeat(10_001)), {
      message: 'Roman numeral input is limited to 10,000 lines.',
    });

    await assert.rejects(async () => run('I'.repeat(65)), {
      message: 'Line 1 is longer than 64 characters.',
    });
  });
});
