import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { formatNumber, formatNumberReport } from '@devtoolora/functions/data';
import { FunctionError } from '@devtoolora/functions/errors';

describe('exact number formatting', () => {
  it('preserves large integer and decimal digits without a Number conversion', () => {
    assert.equal(formatNumber('9007199254740993'), '9,007,199,254,740,993');
    assert.equal(formatNumber(9007199254740993n), '9,007,199,254,740,993');

    assert.equal(
      formatNumber('9007199254740993.125', { decimals: 3, grouping: false }),
      '9007199254740993.125',
    );

    assert.equal(formatNumber('0.1234567890123456789', { decimals: 20 }), '0.1234567890123456789');
    assert.equal(formatNumber('1'.repeat(1000), { grouping: false }), '1'.repeat(1000));

    assert.throws(
      () => formatNumber(9007199254740993),
      (error: unknown) => error instanceof FunctionError && error.code === 'UNSAFE_NUMBER',
    );
  });

  it('honors maximum or fixed digits for decimals, prices and percentage ratios', () => {
    assert.equal(formatNumber('1.5', { decimals: 3, precision: 'fixed' }), '1.500');
    assert.equal(formatNumber('1.5', { decimals: 3, precision: 'maximum' }), '1.5');
    assert.equal(formatNumber('0.856', { decimals: 1, mode: 'percent' }), '85.6%');
    assert.equal(formatNumber('0.856', { decimals: 0, mode: 'percent' }), '86%');

    assert.equal(
      formatNumber('12.3456', { currency: 'USD', decimals: 3, mode: 'currency' }),
      '$12.346',
    );

    assert.equal(formatNumber('12.3', { currency: 'JPY', mode: 'currency' }), '¥12');
    assert.equal(formatNumber('12.3456', { currency: 'KWD', mode: 'currency' }), 'KWD\u00a012.346');
  });

  it('applies exact display rounding, exponents and signed zero', () => {
    assert.equal(formatNumber('1.005'), '1.01');
    assert.equal(formatNumber('-1.005'), '-1.01');
    assert.equal(formatNumber('2.5', { decimals: 0 }), '3');
    assert.equal(formatNumber('-2.5', { decimals: 0 }), '-3');
    assert.equal(formatNumber('1.2345e3'), '1,234.5');
    assert.equal(formatNumber('.5'), '0.5');
    assert.equal(formatNumber('+001.50'), '1.5');
    assert.equal(formatNumber(-0), '-0');
    assert.equal(formatNumber('-0.0'), '-0');
  });

  it('reports exact localized separator parts and effective settings', () => {
    const report = formatNumberReport('1234567.89', {
      currency: 'czk',
      decimals: 2,
      locale: 'cs-CZ',
      mode: 'currency',
      precision: 'fixed',
    });

    assert.equal(report.input, '1234567.89');
    assert.equal(report.currency, 'CZK');
    assert.equal(report.locale, 'cs-CZ');
    assert.equal(report.minimumFractionDigits, 2);
    assert.equal(report.maximumFractionDigits, 2);
    assert.equal(report.formatted, '1\u00a0234\u00a0567,89\u00a0Kč');
    assert.equal(report.parts.map((part) => part.value).join(''), report.formatted);
    assert.equal(report.parts.find((part) => part.type === 'group')?.value, '\u00a0');
    assert.equal(formatNumber('1234.5', { grouping: false, locale: 'de-DE' }), '1234,5');
  });

  it('rejects invalid syntax and decimal magnitude overflow or underflow', () => {
    for (const value of [
      '1,234.5',
      '1 234',
      '1,5',
      '$10',
      '25%',
      'NaN',
      'Infinity',
      '0x10',
      '0b10',
      '1e',
      'hello',
      '١٢٣',
    ])
      assert.throws(() => formatNumber(value), FunctionError);
    for (const value of ['1e400', '1e-400', '1'.repeat(400) + '.5'])
      assert.throws(
        () => formatNumber(value),
        (error: unknown) => error instanceof FunctionError && error.code === 'NUMBER_OUT_OF_RANGE',
      );
    assert.throws(() => formatNumber(' '.repeat(1025) + '1'), FunctionError);
    assert.throws(() => formatNumber(' '), FunctionError);
    assert.throws(() => formatNumber(NaN), FunctionError);
    assert.throws(() => formatNumber(Infinity), FunctionError);
  });

  it('validates locale, currency and fraction limits without silently guessing', () => {
    for (const locale of ['en_US', 'not-a-real-locale', 'zz-ZZ', '', 'en-US,de-DE'])
      assert.throws(() => formatNumber('1', { locale }), FunctionError);
    for (const currency of ['XYZ', 'US', '123', 'BTC', ''])
      assert.throws(() => formatNumber('1', { currency, mode: 'currency' }), FunctionError);
    for (const decimals of [-1, 21, 1.5, NaN, Infinity])
      assert.throws(() => formatNumber('1', { decimals }), FunctionError);

    assert.equal(
      formatNumber('1.25', { currency: 'ignored-invalid-code', mode: 'decimal' }),
      '1.25',
    );

    assert.equal(formatNumber(' 1234.5 '), '1,234.5');
  });
});
