import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { FunctionError } from '@devtoolora/functions/errors';
import {
  assertSingleLine,
  boundedInteger,
  boundedNumber,
  finiteNumber,
  nonEmptyString,
  oneOf,
} from '@devtoolora/functions/validation';

describe('function validation', () => {
  it('returns valid typed values', () => {
    assert.equal(finiteNumber(1.5, 'Value'), 1.5);
    assert.equal(boundedNumber(2.5, 'Value', 0, 3), 2.5);
    assert.equal(boundedInteger(2, 'Count', 1, 3), 2);
    assert.equal(nonEmptyString('  value  ', 'Value'), 'value');
    assert.equal(oneOf('hex', ['hex', 'base64'] as const, 'Encoding'), 'hex');
  });

  it('throws coded errors for invalid values', () => {
    assertFunctionError(() => finiteNumber(Number.NaN, 'Value'), 'INVALID_NUMBER');
    assertFunctionError(() => boundedNumber(4, 'Value', 0, 3), 'NUMBER_OUT_OF_RANGE');
    assertFunctionError(() => boundedInteger(1.5, 'Count', 1, 3), 'INVALID_INTEGER');
    assertFunctionError(() => nonEmptyString('   ', 'Value'), 'REQUIRED_STRING');

    assertFunctionError(
      () => oneOf('pem', ['hex', 'base64'] as const, 'Encoding'),
      'UNSUPPORTED_VALUE',
    );
  });
});

function assertFunctionError(callback: () => unknown, code: string): void {
  assert.throws(
    callback,
    (error: unknown) => error instanceof FunctionError && error.code === code,
  );
}

describe('assertSingleLine', () => {
  it('rejects every C0 control, DEL and the Unicode line separators', () => {
    for (const code of [0x00, 0x09, 0x0a, 0x0d, 0x1b, 0x1f, 0x7f, 0x2028, 0x2029]) {
      assert.throws(
        () => assertSingleLine(`a${String.fromCharCode(code)}b`, 'Host'),
        (error: unknown) =>
          error instanceof FunctionError &&
          error.code === 'SINGLE_LINE' &&
          error.message === 'Host must be one line without control characters.',
      );
    }
  });

  it('accepts spaces, non-ASCII, C1 and a trailing backslash', () => {
    for (const value of ['a b', 'Žluťoučký', `a${String.fromCharCode(0x85)}b`, 'C:\\keys\\', '']) {
      assert.doesNotThrow(() => assertSingleLine(value, 'Host'));
    }
  });
});
