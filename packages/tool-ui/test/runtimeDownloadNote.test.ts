import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { runtimeDownloadNote } from '../src/tool-runner/hooks/runtimeDownloadNote';

describe('runtimeDownloadNote', () => {
  it('sums the OCR engine and English and names Czech separately', () => {
    assert.equal(
      runtimeDownloadNote('ocr'),
      'Downloads about 5.8 MB on first use (engine 2.9 MB + English 3.0 MB; Czech 2.2 MB more when selected). Cached for offline use.',
    );
  });

  it('gives the HEIC decoder size alone', () => {
    assert.equal(
      runtimeDownloadNote('heic'),
      'Downloads about 1.5 MB on first use. Cached for offline use.',
    );
  });
});
