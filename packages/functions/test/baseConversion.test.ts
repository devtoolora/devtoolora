import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '@devtoolora/functions/errors';
import { baseConversionDigitLimit, convertBase } from '@devtoolora/functions/math';

describe('exact whole-number base conversion', () => {
  it('preserves every digit beyond the safe integer range and serializes reports without bigint', () => {
    const decimal = '18446744073709551615';
    const result = convertBase(decimal, 10, 16);

    assert.deepEqual(result, {
      decimal,
      fromBase: 10,
      input: decimal,
      output: 'ffffffffffffffff',
      toBase: 16,
    });

    assert.equal(convertBase(result.output, 16, 10).output, decimal);
    assert.equal(JSON.parse(JSON.stringify(result)).decimal, decimal);
    assert.equal(convertBase('9007199254740991', 10, 16).decimal, 9007199254740991);
    assert.equal(convertBase('-9007199254740992', 10, 16).decimal, '-9007199254740992');
  });

  it('round-trips signed integers through all 35 supported bases', () => {
    for (const integer of [0n, 1n, -42n, 255n, 2n ** 256n - 1n, -(2n ** 256n)]) {
      for (let base = 2; base <= 36; base += 1) {
        const encoded = convertBase(integer.toString(), 10, base).output;

        assert.equal(encoded, integer.toString(base));
        assert.equal(convertBase(encoded.toUpperCase(), base, 10).output, integer.toString());
      }
    }
  });

  it('accepts matching prefixes, outer whitespace, signs and leading zeroes', () => {
    assert.equal(convertBase(' +0XFF ', 16, 10).output, '255');
    assert.equal(convertBase('-0b101010', 2, 10).output, '-42');
    assert.equal(convertBase('0o755', 8, 10).output, '493');
    assert.equal(convertBase('0755', 10, 10).output, '755');
    assert.equal(convertBase('-000', 10, 2).output, '0');
    assert.equal(convertBase('1e3', 16, 10).output, '483');
    assert.equal(convertBase('42').output, '2a');
  });

  it('rejects every invalid digit rather than silently truncating the number', () => {
    for (const [value, base] of [
      ['102', 2],
      ['ffjunk', 16],
      ['1.5', 10],
      ['1e3', 10],
      ['1_000', 10],
      ['1 000', 10],
      ['1,000', 10],
      ['12\n3', 10],
      ['１２', 10],
      ['1😀', 36],
    ] satisfies Array<[string, number]>) {
      assert.throws(() => convertBase(value, base, 10), /Invalid digit/);
    }

    assert.throws(() => convertBase('102', 2, 10), /position 3 in base 2/);
    for (const value of ['', ' ', '+', '-', '0x', '-0b'])
      assert.throws(() => convertBase(value, value.includes('b') ? 2 : 16, 10), FunctionError);
  });

  it('rejects mismatched prefixes and bases outside the integer contract', () => {
    for (const [value, base] of [
      ['0xff', 10],
      ['0b11', 16],
      ['0o77', 36],
    ] satisfies Array<[string, number]>) {
      assert.throws(() => convertBase(value, base, 10), /requires source base/);
    }

    for (const base of [1, 37, -2, 2.5, NaN, Infinity]) {
      assert.throws(() => convertBase('10', base, 10), /integer from 2 through 36/);
      assert.throws(() => convertBase('10', 10, base), /integer from 2 through 36/);
    }
  });

  it('accepts the explicit digit limit without truncating larger output and rejects excess input', () => {
    const hex = 'f'.repeat(baseConversionDigitLimit);
    const binary = convertBase(hex, 16, 2).output;

    assert.equal(binary, '1'.repeat(baseConversionDigitLimit * 4));
    assert.equal(convertBase('-0x' + hex, 16, 16).output, '-' + hex);

    assert.throws(
      () => convertBase('1'.repeat(baseConversionDigitLimit + 1), 2, 10),
      /exceeds 10,000 digits/,
    );
  });

  it('reads a value that only looks prefixed as digits of the source base', () => {
    assert.equal(convertBase('0b', 16, 10).output, '11');
    assert.equal(convertBase('0B', 16, 10).output, '11');
    assert.equal(convertBase('0b1f', 16, 10).output, '2847');
    assert.equal(convertBase('-0b1f', 16, 10).output, '-2847');
    assert.equal(convertBase('0xz', 36, 10).output, String(33 * 36 + 35));
    assert.throws(() => convertBase('0b', 10, 10), /requires source base/);
    assert.throws(() => convertBase('0b1f', 10, 10), /requires source base/);
    assert.throws(() => convertBase('0x10', 36, 10), /requires source base/);
  });
});
