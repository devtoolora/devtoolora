import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { convertList } from '@devtoolora/functions/text';

const base = {
  dedupe: false,
  dropEmpty: true,
  input: 'auto',
  output: 'comma',
  quote: 'none',
  trim: true,
} as const;

describe('list converter', () => {
  it('does not read a lone final newline as the separator', () => {
    assert.deepEqual(convertList('a,b,c\n', { ...base, output: 'json' }).items, ['a', 'b', 'c']);
    assert.deepEqual(convertList('a\tb\r\n', { ...base, trim: false }).items, ['a', 'b']);
    assert.equal(convertList('a,b\nc,d\n', base).inputFormat, 'lines');
    assert.throws(() => convertList('[1e400]', base), /beyond the range/);
  });

  it('converts lines to a deduplicated SQL list', () => {
    assert.deepEqual(convertList('a\nb\nb\n', { ...base, dedupe: true, output: 'sql' }), {
      duplicatesRemoved: 1,
      emptyDropped: 1,
      inputFormat: 'lines',
      items: ['a', 'b'],
      text: "('a', 'b')",
    });
  });

  it('detects JSON arrays and quotes output', () => {
    assert.equal(convertList('["x","y"]', { ...base, quote: 'double' }).text, '"x", "y"');
    assert.equal(convertList('["x","y"]', { ...base }).inputFormat, 'json');
  });

  it('escapes SQL apostrophes and converts other separators', () => {
    assert.equal(convertList("it's", { ...base, output: 'sql' }).text, "('it''s')");
    assert.equal(convertList('a\tb', { ...base, output: 'json' }).text, '["a","b"]');

    assert.equal(
      convertList('a, b', { ...base, output: 'custom', separator: ' | ' }).text,
      'a | b',
    );

    assert.equal(convertList('a;b', { ...base, quote: 'single' }).text, "'a', 'b'");
  });

  it('rejects oversized and non-scalar input', () => {
    const many = Array.from({ length: 10_001 }, (_, index) => String(index)).join('\n');

    assert.throws(() => convertList(many, base), /10,000 items/);
    assert.throws(() => convertList('x'.repeat(100_001), base), /100,000 UTF-16 units/);
    assert.throws(() => convertList('[{"a":1}]', base), /array of strings/);
    assert.throws(() => convertList('a', { ...base, output: 'custom' }), /32/);
  });

  it('keeps the digits of JSON integers a double cannot hold', () => {
    assert.deepEqual(convertList('[9007199254740993]', base).items, ['9007199254740993']);

    assert.deepEqual(convertList('[1, -12345678901234567890]', { ...base, input: 'json' }).items, [
      '1',
      '-12345678901234567890',
    ]);

    assert.throws(() => convertList('[1e400]', base), /range of a double/);

    assert.deepEqual(convertList('[9007199254740991, 1.5]', base).items, [
      '9007199254740991',
      '1.5',
    ]);
  });
});
