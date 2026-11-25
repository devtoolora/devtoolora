import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { inspectFloat, type FloatFormat } from '@devtoolora/functions/math';

const f = (text: string, format: FloatFormat = 'binary32') => inspectFloat(text, format);

describe('IEEE 754 float inspector', () => {
  it('rounds decimals exactly to binary32 and prints exact expansions', () => {
    assert.equal(f('0.1').hex, '0x3dcccccd');
    assert.match(f('0.1').text, /^Stored value +0\.100000001490116119384765625$/m);
    assert.match(f('0.1').text, /^Rounding error +0\.000000001490116119384765625$/m);
    assert.match(f('0.1').text, /^Next up +0\.10000001$/m);
    assert.match(f('0.1').text, /^Next down +0\.099999994$/m);
    assert.equal(f('0.1').shortest, '0.1');
    assert.match(f('0.5').text, /^Rounding error +exact$/m);
    assert.equal(f('1e39').hex, '0x7f800000');
    assert.equal(f('-0').hex, '0x80000000');
  });

  it('prints every row in order', () => {
    assert.equal(
      f('-1.5').text,
      [
        'Hex             0xbfc00000',
        'Binary          1 01111111 10000000000000000000000',
        'Sign            1 (negative)',
        'Exponent        127 (unbiased 0)',
        'Fraction        0x400000',
        'Class           normal',
        'Stored value    -1.5',
        'Shortest        -1.5',
        'Rounding error  exact',
        'Next up         -1.4999999',
        'Next down       -1.5000001',
        '',
      ].join('\n'),
    );
  });

  it('handles binary16 and binary64 rounding boundaries', () => {
    assert.equal(f('0.1', 'binary64').hex, '0x3fb999999999999a');
    assert.equal(f('0.1', 'binary64').shortest, '0.1');
    assert.equal(f('1', 'binary16').hex, '0x3c00');
    assert.equal(f('65519', 'binary16').hex, '0x7bff');
    assert.equal(f('65520', 'binary16').hex, '0x7c00');
    // 1 + 2^-24 + 2^-60: a double would round to 1 + 2^-24 first, then ties to even to 1.
    assert.equal(f(`${(2n ** 60n + 2n ** 36n + 1n) * 5n ** 60n}e-60`).hex, '0x3f800001');
    assert.equal(f('0.00000002980232238769531251', 'binary16').hex, '0x0001');
    assert.equal(f('0.0000000298023223876953125', 'binary16').hex, '0x0000');
    assert.equal(f('0x0001', 'binary16').className, 'subnormal');
    assert.match(f('0x0001', 'binary16').text, /^Stored value +0\.000000059604644775390625$/m);
    assert.match(f('0x0001', 'binary16').text, /^Next down +0$/m);
    assert.match(f('0x8000', 'binary16').text, /^Next up +6e-8$/m);
    assert.match(f('0x8000', 'binary16').text, /^Stored value +-0$/m);
    assert.match(f('0x0000', 'binary16').text, /^Next down +-6e-8$/m);
    assert.doesNotMatch(f('0x0001', 'binary16').text, /Rounding error/);
  });

  it('reports shortest round-trip spellings', () => {
    assert.equal(f('0x7f7fffff').shortest, '3.4028235e+38');
    assert.equal(f('0x00000001').shortest, '1e-45');
    assert.match(f('0x7f7fffff').text, /^Next up +Infinity$/m);
    assert.equal(f('1e-3').shortest, '0.001');
    assert.equal(f('0x0f800000').shortest, '1.2621775e-29');
    assert.equal(f('0x6b000000').shortest, '1.5474251e+26');
    assert.equal(f('0x7000', 'binary16').shortest, '8190');
    assert.equal(f('0x0400', 'binary16').shortest, '0.00006104');
  });

  it('classifies special values', () => {
    assert.equal(f('0x7e00', 'binary16').className, 'quiet NaN');
    assert.equal(f('0x7d00', 'binary16').className, 'signaling NaN');
    assert.equal(f('-inf').className, 'infinity');
    assert.equal(f('-inf').hex, '0xff800000');
    assert.equal(f('Infinity', 'binary64').hex, '0x7ff0000000000000');
    assert.equal(f('NaN').hex, '0x7fc00000');
    assert.equal(f('0').className, 'zero');
    assert.match(f('-inf').text, /^Stored value +-Infinity$/m);
    assert.match(f('-inf').text, /^Next up +-3\.4028235e\+38$/m);
    assert.match(f('-inf').text, /^Next down +-Infinity$/m);
    assert.match(f('nan').text, /^Next up +NaN$/m);
    assert.doesNotMatch(f('nan').text, /Rounding error/);
  });

  it('agrees with the platform for binary32 and binary64', () => {
    const view = new DataView(new ArrayBuffer(8));
    let seed = 7;

    for (let index = 0; index < 500; index += 1) {
      seed = (seed * 48271) % 2147483647;
      const text = `${seed % 2 ? '-' : ''}${seed}e${(seed % 90) - 60}`;

      view.setFloat64(0, Number(text));
      assert.equal(f(text, 'binary64').bits, view.getBigUint64(0), text);
      view.setFloat32(0, Number(text));
      assert.equal(f(text).bits, BigInt(view.getUint32(0)), text);
    }
  });

  it('rejects malformed input', () => {
    assert.throws(() => f('0x3c00'), /8 hex digits/);
    assert.throws(() => f('1e10001'), /-10,000 to 10,000/);
    assert.throws(() => f('abc'), /decimal number/);
    assert.throws(() => f('1'.repeat(1001)), /1,000 characters/);
    assert.throws(() => f(''), /required/);
  });
});
