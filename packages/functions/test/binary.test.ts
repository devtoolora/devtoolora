import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  base64Decode,
  base64Encode,
  bytesToUtf8,
  createZip,
  dataUriFromBytes,
  parseDataUri,
  utf8Bytes,
} from '@devtoolora/functions/binary';
import { FunctionError } from '@devtoolora/functions/errors';

describe('binary functions', () => {
  it('round-trips UTF-8, Base64, and data URIs', () => {
    const bytes = utf8Bytes('Dev Toolora ✓');

    assert.equal(bytesToUtf8(base64Decode(base64Encode(bytes))), 'Dev Toolora ✓');

    const arbitraryBytes = Uint8Array.from({ length: 256 }, (_, index) => index);

    assert.deepEqual(base64Decode(base64Encode(arbitraryBytes)), arbitraryBytes);

    const parsed = parseDataUri(dataUriFromBytes(bytes, 'text/plain'));

    assert.equal(parsed.mimeType, 'text/plain');
    assert.equal(bytesToUtf8(parsed.bytes), 'Dev Toolora ✓');
  });

  it('creates ZIP bytes without returning a tool artifact', () => {
    const zipped = createZip([{ name: 'signal.txt', bytes: utf8Bytes('field') }]);

    assert.equal(zipped[0], 0x50);
    assert.equal(zipped[1], 0x4b);
  });

  it('reports invalid standalone values with stable codes', () => {
    assert.throws(
      () => base64Decode('not@base64'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_BASE64',
    );

    assert.throws(
      () => parseDataUri('not-a-data-uri'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_DATA_URI',
    );

    assert.throws(
      () => createZip([]),
      (error: unknown) => error instanceof FunctionError && error.code === 'FILES_REQUIRED',
    );
  });
});
