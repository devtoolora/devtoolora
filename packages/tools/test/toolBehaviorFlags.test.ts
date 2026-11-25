import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';

describe('tool behavior flags', () => {
  const tools = listBrowserWorkerTools();

  it('keeps config, secret and log input out of editor drafts', () => {
    const unprotected = tools
      .filter(
        (tool) =>
          ['Config & Secrets', 'Logs & Diagnostics'].includes(tool.category) &&
          !tool.sensitiveInput,
      )
      .map((tool) => tool.id);

    assert.deepEqual(unprotected, []);

    for (const id of [
      'password-strength',
      'pem-key-inspector',
      'curl-to-fetch',
      'fetch-to-curl',
      'http-headers-parser',
      'wifi-qr',
    ]) {
      assert.equal(tools.find((tool) => tool.id === id)?.sensitiveInput, true, id);
    }
  });

  it('clears stale results for visual, generator and file tools', () => {
    const stale = tools
      .filter(
        (tool) =>
          ['CSS & Design', 'Images & Codes', 'Crypto'].includes(tool.category) &&
          !tool.freshResults,
      )
      .map((tool) => tool.id);

    assert.deepEqual(stale, []);
    assert.ok(tools.filter((tool) => tool.textConversion).every((tool) => tool.freshResults));
  });

  it('keeps pdfjs tools out of isolated workers', () => {
    // Isolated VS Code workers start without pdfjs; add every tool that calls extractPdfText here.
    const pdfjsToolIds = ['pdf-text-extractor', 'pdf-compare'];

    assert.deepEqual(
      tools.filter((tool) => tool.isolatedWorker && pdfjsToolIds.includes(tool.id)),
      [],
    );
  });

  it('runs user-supplied patterns in an isolated worker', () => {
    assert.deepEqual(
      tools
        .filter((tool) => tool.isolatedWorker)
        .map((tool) => tool.id)
        .sort(),
      ['find-replace', 'log-filter', 'pattern-extractor', 'regex-test'],
    );
  });
});
