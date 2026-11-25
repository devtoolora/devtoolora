import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { calculateBitwise, type BitwiseOperation } from '../src/dev';

describe('bitwise calculator', () => {
  const calc = (a: string, b: string, operation: BitwiseOperation, width: 8 | 16 | 32 | 64 = 8) =>
    calculateBitwise({ a, b, operation, width });

  it('writes each value in four bases', () => {
    assert.equal(
      calc('12', '0b1010', 'and').text,
      'A AND B (8-bit)\n\nA\n  hex       0x0C\n  unsigned  12\n  signed    12\n  binary    0000 1100\n\nB\n  hex       0x0A\n  unsigned  10\n  signed    10\n  binary    0000 1010\n\nResult\n  hex       0x08\n  unsigned  8\n  signed    8\n  binary    0000 1000\n\nSet bits: 3 (8)\n',
    );

    assert.match(
      calc('0', '', 'not').text,
      /^NOT A \(8-bit\)\n\nA\n[\s\S]*\nResult\n {2}hex {7}0xFF\n {2}unsigned {2}255\n {2}signed {4}-1\n/,
    );

    assert.equal(calc('0', '0', 'or').text.endsWith('Set bits: none\n'), true);
  });

  it('handles two’s complement and 64-bit values', () => {
    assert.equal(calc('-1', '0', 'or').result.hex, '0xFF');

    assert.deepEqual(calc('0xFFFFFFFFFFFFFFFF', '1', 'xor', 64).result, {
      binary: '1111 '.repeat(15) + '1110',
      hex: '0xFFFFFFFFFFFFFFFE',
      signed: '-2',
      unsigned: '18446744073709551614',
    });

    assert.deepEqual(calc('9007199254740993', '0', 'or', 64).setBits, [0, 53]);
    assert.throws(() => calc('256', '0', 'and'), { message: 'A must fit 8 bits: -128 to 255.' });
    assert.throws(() => calc('-129', '0', 'and'), { message: 'A must fit 8 bits: -128 to 255.' });

    assert.throws(() => calc('0', '1'.repeat(300), 'and'), {
      message: 'B must be at most 256 characters.',
    });
  });

  it('computes the negated operations', () => {
    const hex = (operation: BitwiseOperation) => calc('0xF0', '0x3C', operation).result.hex;

    assert.deepEqual(
      [hex('nand'), hex('nor'), hex('xnor'), hex('xor'), hex('or')],
      ['0xCF', '0x03', '0x33', '0xCC', '0xFC'],
    );
  });

  it('shifts and rotates', () => {
    const hex = (a: string, b: string, op: BitwiseOperation) => calc(a, b, op).result.hex;

    assert.deepEqual(
      [
        hex('0x81', '1', 'shl'),
        hex('0x80', '7', 'shr'),
        hex('0x80', '7', 'sar'),
        hex('0x81', '1', 'rol'),
        hex('0x01', '1', 'ror'),
        hex('0x81', '8', 'shl'),
        hex('0x80', '8', 'sar'),
        hex('0x81', '8', 'rol'),
      ],
      ['0x02', '0x01', '0xFF', '0x03', '0x80', '0x00', '0xFF', '0x81'],
    );

    assert.match(calc('0x81', '1', 'shl').text, /^A << 1 \(8-bit\)\n\nA\n[\s\S]*\n\nResult\n/);
    assert.match(calc('0x81', '2', 'sar').text, /^A >> 2 \(8-bit\)/);
    assert.throws(() => calc('1', '9', 'shl'), { message: 'Shift amount must be 0-8.' });
    assert.throws(() => calc('1', '-1', 'ror'), { message: 'Shift amount must be 0-8.' });
  });

  it('parses number forms', () => {
    assert.equal(calc('0b1010_1010', '1_0', 'and').result.unsigned, '10');
    assert.equal(calc('0o17', '0x0f', 'xor').result.unsigned, '0');

    for (const bad of ['0x', '1.5', '1e3', ''])
      assert.throws(() => calc(bad, '0', 'and'), {
        message: bad ? 'A is not a number: use decimal, 0x, 0b or 0o.' : 'Enter A.',
      });

    assert.throws(() => calc('1', '', 'and'), { message: 'Enter B.' });
  });

  it('does wrapping arithmetic with flags', () => {
    const add = calc('200', '100', 'add');

    assert.equal(add.result.hex, '0x2C');
    assert.deepEqual(add.flags, { carry: true, overflow: false });
    assert.deepEqual(calc('100', '100', 'add').flags, { carry: false, overflow: true });
    assert.deepEqual(calc('0', '1', 'sub').flags, { carry: true, overflow: false });
    assert.equal(calc('0', '1', 'sub').result.hex, '0xFF');

    const mul = calc('300', '300', 'mul', 16);

    assert.equal(mul.result.unsigned, '24464');
    assert.deepEqual(mul.flags, { carry: true, overflow: true });
  });

  it('divides signed and unsigned', () => {
    assert.equal(calc('-7', '2', 'sdiv').result.signed, '-3');
    assert.equal(calc('-7', '2', 'srem').result.signed, '-1');
    assert.equal(calc('0xF9', '2', 'urem').result.unsigned, '1');
    assert.equal(calc('0xF9', '2', 'udiv').result.unsigned, '124');
    assert.deepEqual(calc('-128', '-1', 'sdiv').flags, { overflow: true });
    assert.equal(calc('-128', '-1', 'sdiv').result.hex, '0x80');
    assert.throws(() => calc('1', '0', 'udiv'), /Division by zero\.$/);
    assert.throws(() => calc('1', '0', 'srem'), /Division by zero\.$/);
    assert.equal(calc('12', '10', 'and').flags, undefined);
    assert.equal(calc('12', '10', 'udiv').flags, undefined);

    assert.match(
      calc('200', '100', 'add').text,
      /^A \+ B \(8-bit\)\n[\s\S]*\nSet bits: [^\n]*\nFlags: carry yes, overflow no\n$/,
    );

    assert.match(
      calc('-7', '2', 'sdiv').text,
      /^A \/ B \(signed\) \(8-bit\)[\s\S]*Flags: overflow no\n$/,
    );
  });
});
