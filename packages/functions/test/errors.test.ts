import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { FunctionError } from '@devtoolora/functions/errors';

describe('function errors', () => {
  it('exposes a stable code without depending on tool contracts', () => {
    const error = new FunctionError('INVALID_COLOR', 'Color is invalid.');

    assert.equal(error.name, 'FunctionError');
    assert.equal(error.code, 'INVALID_COLOR');
    assert.equal(error.message, 'Color is invalid.');
    assert.equal(error instanceof Error, true);
  });
});
