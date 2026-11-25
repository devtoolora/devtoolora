import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'vitest';
import { importPdfjs } from '../../src/webview/client/pdfjs/importPdfjs';

const scope = globalThis as { pdfjsLib?: unknown };

afterEach(() => {
  delete scope.pdfjsLib;
});

describe('VS Code tool worker importPdfjs', () => {
  it('returns the pdfjsLib that assets/pdfjs.js published', async () => {
    const pdfjsLib = { getDocument: () => undefined };

    scope.pdfjsLib = pdfjsLib;
    assert.equal(await importPdfjs(), pdfjsLib);
  });

  it('rejects in a worker started without assets/pdfjs.js', async () => {
    await assert.rejects(importPdfjs(), { message: 'pdfjs is not loaded in this worker.' });
  });
});
