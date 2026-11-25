import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { lookupHttpStatus, lookupMimeType } from '../../functions/src/web';
import { canRunTool } from '../../core/src';
import { httpStatusTool, mimeLookupTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';

describe('Web reference lookup behavior', () => {
  it('distinguishes valid known, bundled-unknown and malformed status queries', () => {
    assert.deepEqual(lookupHttpStatus('404'), ['404 Not Found']);
    assert.match(lookupHttpStatus('418')[0]!, /Unused/);
    assert.deepEqual(lookupHttpStatus('499'), ['499: Not in the bundled status reference.']);
    assert.ok(lookupHttpStatus('').includes('1xx Informational'));
    assert.ok(lookupHttpStatus('').includes('5xx Server Error'));
    for (const value of ['constructor', '99', '600', '404.0', '1'.repeat(33)])
      assert.throws(() => lookupHttpStatus(value));
  });

  it('looks up extensions, filenames, URL paths and reverse MIME types without false fallback', () => {
    for (const value of [
      'json',
      '.JSON',
      'report.JSON',
      'C:\\demo\\report.json',
      'https://example.com/report.json?q=pdf#fragment',
      'application/json; charset=utf-8',
    ])
      assert.deepEqual(lookupMimeType(value), ['json: application/json']);
    assert.deepEqual(lookupMimeType('image/jpeg'), ['jpeg: image/jpeg', 'jpg: image/jpeg']);

    assert.deepEqual(lookupMimeType('file.unknown'), [
      'No MIME mapping found in the bundled reference.',
    ]);

    assert.throws(() => lookupMimeType('x'.repeat(4097)));
  });

  it('allows empty reference inputs and supplies byte-identical exports', async () => {
    for (const tool of [httpStatusTool, mimeLookupTool]) {
      assert.equal(canRunTool(tool, '', {}), true);
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.equal(tool.samples?.length, 6);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6);

      for (const text of ['', tool.samples?.[0]?.text ?? '']) {
        const result = await tool.run({ fields: {}, text });

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );
      }
    }
  });
});
