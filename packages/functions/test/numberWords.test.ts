import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { numbersToWords, numberToWords, separatorReadings } from '@devtoolora/functions/text';

describe('numberToWords', () => {
  it('spells cardinals', () => {
    assert.equal(numberToWords('0', 'cardinal'), 'zero');

    assert.equal(
      numberToWords('1234567', 'cardinal'),
      'one million two hundred thirty-four thousand five hundred sixty-seven',
    );

    assert.equal(numberToWords('-12.05', 'cardinal'), 'minus twelve point zero five');
    assert.equal(numberToWords('1,000,000', 'cardinal'), 'one million');
  });

  it('spells ordinals', () => {
    assert.equal(numberToWords('21', 'ordinal'), 'twenty-first');
    assert.equal(numberToWords('12', 'ordinal'), 'twelfth');
    assert.equal(numberToWords('101', 'ordinal'), 'one hundred first');
    assert.equal(numberToWords('1000000', 'ordinal'), 'one millionth');
    assert.throws(() => numberToWords('2.5', 'ordinal'), /whole number/);
  });

  it('spells cheque amounts', () => {
    assert.equal(
      numberToWords('1234.5', 'currency'),
      'one thousand two hundred thirty-four and 50/100',
    );

    assert.throws(() => numberToWords('1.234', 'currency'), /at most 2 decimal places/);
  });

  it('rejects invalid and oversized input', () => {
    assert.throws(() => numberToWords('1' + '0'.repeat(36), 'cardinal'), /36 digits/);
    assert.throws(() => numberToWords('1.' + '0'.repeat(21), 'cardinal'), /20 decimal digits/);
    assert.throws(() => numberToWords('12a', 'cardinal'), /not a number/);
  });
});

describe('numberToWords separators', () => {
  it('accepts separators only as thousands groups', () => {
    const million = 'one million';

    assert.equal(numberToWords('1,000,000', 'cardinal'), million);
    assert.equal(numberToWords('1 000 000', 'cardinal'), million);
    assert.equal(numberToWords('1\u00A0000\u00A0000', 'cardinal'), million);
    assert.equal(numberToWords('1_000_000', 'cardinal'), million);
    assert.equal(numberToWords('+12,345', 'cardinal'), 'twelve thousand three hundred forty-five');
    assert.equal(numberToWords('- 5', 'cardinal'), 'minus five');

    assert.equal(
      numberToWords('1,234.50', 'currency'),
      'one thousand two hundred thirty-four and 50/100',
    );
  });

  it('rejects a separator that would change the magnitude', () => {
    const values = [
      '1234,50',
      '3,14',
      '0,5',
      '0,500',
      '1,5',
      '7 8',
      '10 20 30',
      '12,34,567',
      '1,000 000',
      '1,0000',
      '1234,567',
      '1,',
      '00,123',
    ];

    for (const style of ['cardinal', 'currency', 'ordinal'] as const) {
      for (const value of values) {
        assert.throws(() => numberToWords(value, style), /groups of three digits/, value);
      }
    }

    assert.throws(() => numberToWords('1.000,50', 'cardinal'), /not a number/);
    assert.throws(() => numberToWords(',5', 'cardinal'), /not a number/);
    assert.throws(() => numberToWords('a,bcd', 'cardinal'), /not a number/);
    assert.throws(() => numbersToWords('1\n3,14', 'cardinal'), { message: /^Line 2: / });
  });

  it('writes no sign on negative zero', () => {
    assert.equal(numberToWords('-0', 'cardinal'), 'zero');
    assert.equal(numberToWords('-0', 'ordinal'), 'zeroth');
    assert.equal(numberToWords('-0.00', 'currency'), 'zero and 00/100');
    assert.equal(numberToWords('-0.5', 'cardinal'), 'minus zero point five');
    assert.equal(numberToWords('-0.05', 'currency'), 'minus zero and 05/100');
  });
});

describe('numbersToWords', () => {
  it('converts per line and reports the line of an error', () => {
    assert.equal(numbersToWords('1\r\n2', 'cardinal'), 'one\ntwo');
    assert.equal(numbersToWords('1\n\n2', 'cardinal'), 'one\n\ntwo');
    assert.throws(() => numbersToWords('1\r\n\r\nx', 'cardinal'), { message: /^Line 3: / });
    assert.throws(() => numbersToWords('1\n'.repeat(1001), 'cardinal'), /1,000 lines/);
  });
});

describe('separatorReadings', () => {
  it('states the value read from a line with a separator', () => {
    assert.equal(separatorReadings('1,500'), 'Read as 1500');
    assert.equal(separatorReadings('-1 000 000.5'), 'Read as -1000000.5');
    assert.equal(separatorReadings('1_000\n7\n2,000'), 'Read as 1000, 2000');

    assert.equal(
      separatorReadings('1,000\n2,000\n3,000\n4,000\n5,000'),
      'Read as 1000, 2000, 3000 and 2 more',
    );
  });

  it('says nothing without a separator', () => {
    assert.equal(separatorReadings('1500\n\n- 7\n3.14'), undefined);
  });
});
