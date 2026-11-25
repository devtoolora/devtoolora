import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { jsonLinesConverterTool } from '../src/catalog/formatters';

describe('json lines converter tool', () => {
  it('converts lines to an array with the chosen indentation', async () => {
    const minified = await jsonLinesConverterTool.run({
      fields: { indent: '0' },
      text: '{"a":1}\n{"a":2}',
    });

    assert.equal(minified.text, '[{"a":1},{"a":2}]');
    assert.equal(minified.artifact?.fileName, 'records.json');
    assert.match(minified.summary ?? '', /2 records · 0 blank lines skipped/);

    const indented = await jsonLinesConverterTool.run({ fields: {}, text: '1\n\n2' });

    assert.equal(indented.text, '[\n  1,\n  2\n]');
    assert.match(indented.summary ?? '', /2 records · 1 blank lines skipped/);
  });

  it('converts an array to lines and ignores indent', async () => {
    const result = await jsonLinesConverterTool.run({
      fields: { indent: 'bogus', mode: 'toLines' },
      text: '[1,2]',
    });

    assert.equal(result.text, '1\n2');
    assert.equal(result.artifact?.fileName, 'records.jsonl');
    assert.equal(result.summary, '2 lines');
  });

  it('rejects bad input and bad choices', async () => {
    await assert.rejects(
      async () => jsonLinesConverterTool.run({ fields: { mode: 'toLines' }, text: '{}' }),
      /top-level JSON array/,
    );

    await assert.rejects(
      async () => jsonLinesConverterTool.run({ fields: { indent: '3' }, text: '1' }),
      /Choose 2 spaces/,
    );

    await assert.rejects(
      async () => jsonLinesConverterTool.run({ fields: {}, text: '1\nx' }),
      /Line 2 is not valid JSON/,
    );
  });

  it('keeps the digits of big integers in both modes', async () => {
    const big = '12345678901234567890';
    const array = await jsonLinesConverterTool.run({ fields: { indent: '0' }, text: `1\n${big}` });
    const lines = await jsonLinesConverterTool.run({
      fields: { mode: 'toLines' },
      text: `[${big}]`,
    });

    assert.equal(array.text, `[1,${big}]`);
    assert.equal(lines.text, big);
  });

  it('warns about a duplicate key and keeps its last value in both modes', async () => {
    const array = await jsonLinesConverterTool.run({
      fields: { indent: '0' },
      text: '{"a":1}\n{"a":1,"a":2}',
    });
    const lines = await jsonLinesConverterTool.run({
      fields: { mode: 'toLines' },
      text: '[\n{"a":1,"a":2}]',
    });

    assert.equal(array.text, '[{"a":1},{"a":2}]');
    assert.match(array.summary ?? '', /Duplicate key "a" at line 2; only its last value is kept/);
    assert.equal(lines.text, '{"a":2}');
    assert.match(lines.summary ?? '', /Duplicate key "a" at line 2; only its last value is kept/);
  });
});
