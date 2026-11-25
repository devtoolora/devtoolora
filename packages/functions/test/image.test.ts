import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { inspectImage } from '@devtoolora/functions/image';
import { FunctionError } from '@devtoolora/functions/errors';

describe('image functions', () => {
  it('reports an explicit runtime error without browser image APIs', async () => {
    await assert.rejects(
      inspectImage({ name: 'pixel.png', mimeType: 'image/png', bytes: new Uint8Array() }),
      (error: unknown) => error instanceof FunctionError && error.code === 'IMAGE_ERROR',
    );
  });
});
