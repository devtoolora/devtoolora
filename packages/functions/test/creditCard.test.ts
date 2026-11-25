import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  cardBrands,
  generateCardNumbers,
  luhnDigit,
  validateCardNumbers,
} from '../src/data/creditCard';

// Independent Luhn so a shared bug in the implementation cannot pass.
const independentLuhn = (digits: string): boolean =>
  [...digits].reverse().reduce((sum, char, index) => {
    const value = Number(char) * (index % 2 === 1 ? 2 : 1);

    return sum + (value > 9 ? value - 9 : value);
  }, 0) %
    10 ===
  0;

describe('credit card', () => {
  it('detects brands and validates the reference vectors', () => {
    for (const [number, brand] of [
      ['4242424242424242', 'visa'],
      ['378282246310005', 'amex'],
      ['5555555555554444', 'mastercard'],
      ['2223003122003222', 'mastercard'],
      ['6011111111111117', 'discover'],
      ['3056930009020004', 'diners'],
      ['3566002020360505', 'jcb'],
      ['6200000000000005', 'unionpay'],
      ['6759649826438453', 'maestro'],
      ['6799990100000000019', 'maestro'],
      ['5000550000000029', 'maestro'],
    ] as const) {
      const [row] = validateCardNumbers(number);

      assert.deepEqual([row?.brand, row?.valid], [brand, true], number);
      assert.ok(independentLuhn(number), number);
    }
  });

  it('formats and flags failures', () => {
    assert.equal(validateCardNumbers('4242 4242 4242 4242')[0]?.formatted, '4242 4242 4242 4242');
    assert.equal(validateCardNumbers('378282246310005')[0]?.formatted, '3782 822463 10005');

    assert.deepEqual(validateCardNumbers('4242424242424241')[0], {
      brand: 'visa',
      formatted: '4242 4242 4242 4241',
      lengthValid: true,
      luhnValid: false,
      valid: false,
    });

    assert.equal(validateCardNumbers('42424242424242')[0]?.lengthValid, false);
    assert.equal(validateCardNumbers('4242-4242-4242-424x')[0]?.brand, 'unknown');

    assert.deepEqual(
      [validateCardNumbers('1234567812345670')[0]].map((r) => [r?.brand, r?.luhnValid, r?.valid]),
      [['unknown', true, false]],
    );

    assert.equal(validateCardNumbers('a\n\nb').length, 2);
  });

  it('enforces limits', () => {
    assert.throws(() => validateCardNumbers('4'.repeat(33)), /Line 1 exceeds 32 characters\./);
    assert.throws(() => validateCardNumbers('4\n'.repeat(1001)), /Input exceeds 1,000 lines\./);
  });

  it('generates Luhn-valid numbers for every brand', () => {
    assert.equal(luhnDigit('424242424242424'), '2');

    for (const brand of cardBrands) {
      const numbers = generateCardNumbers(brand, 20);

      assert.equal(numbers.length, 20);

      for (const n of numbers) {
        const [row] = validateCardNumbers(n);

        assert.ok(independentLuhn(n), n);
        assert.deepEqual([row?.brand, row?.valid], [brand, true], `${brand} ${n}`);
      }
    }

    assert.throws(() => generateCardNumbers('visa', 101), /Count must be between 1 and 100\./);
  });

  it('handles edge cases', () => {
    const with19 = `424242424242424242${luhnDigit('424242424242424242')}`;
    const diners = `3056930902590${luhnDigit('3056930902590')}`;
    const disc = `622126000000000${luhnDigit('622126000000000')}`;
    const maestro = `50180000000${luhnDigit('50180000000')}`;

    assert.deepEqual(
      [validateCardNumbers(with19)[0]?.brand, validateCardNumbers(with19)[0]?.valid],
      ['visa', true],
    );

    assert.deepEqual(
      [validateCardNumbers(diners)[0]?.brand, validateCardNumbers(diners)[0]?.valid],
      ['diners', true],
    );

    assert.equal(validateCardNumbers(disc)[0]?.brand, 'unionpay');

    assert.deepEqual(
      [validateCardNumbers(maestro)[0]?.brand, validateCardNumbers(maestro)[0]?.valid],
      ['maestro', true],
    );

    assert.deepEqual(
      validateCardNumbers(
        '\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669\u0660\u0661\u0662\u0663\u0664\u0665\u0666',
      ).map((r) => [r.brand, r.lengthValid, r.luhnValid]),
      [['unknown', false, false]],
    );

    assert.equal(validateCardNumbers(' '.repeat(32)).length, 0);
    assert.equal(validateCardNumbers(' '.repeat(40)).length, 0);
    assert.throws(() => validateCardNumbers('4\n'.repeat(1001)), /Input exceeds 1,000 lines\./);
  });
});
