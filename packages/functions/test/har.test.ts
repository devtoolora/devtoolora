import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { formatSize, parseHar, shortenUrl, summarizeHar } from '@devtoolora/functions/logs';
import { harBasic, harMalformed } from './fixtures/har';

describe('har viewer functions', () => {
  it('maps entry fields', () => {
    const { entries, version } = parseHar(harBasic);

    assert.equal(version, '1.2');
    assert.equal(entries.length, 3);

    assert.deepEqual(
      entries.map((entry) => [entry.index, entry.method, entry.status, entry.type]),
      [
        [1, 'GET', 200, 'html'],
        [2, 'POST', 404, 'json'],
        [3, 'GET', 0, 'svg'],
      ],
    );

    assert.deepEqual(
      entries.map((entry) => [entry.size, entry.time, entry.wait]),
      [
        [1024, 120, 80],
        [512, 300, 250],
        [null, 50, null],
      ],
    );

    assert.equal(entries[2]?.error, 'net::ERR_CONNECTION_REFUSED');
  });

  it('maps malformed fields without throwing', () => {
    const { entries } = parseHar(harMalformed);

    assert.equal(entries[0]?.size, null);
    assert.equal(entries[0]?.time, null);
    assert.equal(entries[1]?.url, '');
    assert.equal(entries[1]?.type, '-');
    assert.equal(entries[1]?.status, 0);
  });

  it('summarizes entries', () => {
    const summary = summarizeHar(parseHar(harBasic).entries);

    assert.deepEqual(summary.classes, { '0': 1, '2xx': 1, '3xx': 0, '4xx': 1, '5xx': 0, other: 0 });
    assert.equal(summary.failures.length, 2);
    assert.equal(summary.totalBytes, 1536);
    assert.equal(summary.spanMs, 2050);

    assert.deepEqual(summary.hosts, [
      ['example.com', 2],
      ['api.example.com', 1],
    ]);

    assert.deepEqual(summary.byType[0], ['html', { bytes: 1024, count: 1 }]);
    assert.equal(summary.slowest[0]?.index, 2);
    assert.equal(summary.largest[0]?.index, 1);
    assert.equal(summarizeHar([]).spanMs, null);
  });

  it('formats sizes and urls', () => {
    assert.equal(formatSize(0), '0 B');
    assert.equal(formatSize(512), '512 B');
    assert.equal(formatSize(1536), '1.5 kB');
    assert.equal(formatSize(1_200_000), '1.2 MB');
    assert.deepEqual([999, 1000, 999_950].map(formatSize), ['999 B', '1.0 kB', '1.0 MB']);
    assert.equal(shortenUrl('a'.repeat(200)).length, 120);
    assert.equal(shortenUrl('short'), 'short');
    assert.equal(shortenUrl('a'.repeat(120)), 'a'.repeat(120));
    assert.equal(shortenUrl('a'.repeat(121)).length, 120);
  });

  it('rejects invalid input with exact messages', () => {
    assert.throws(() => parseHar('{"log":{}}'), /no log\.entries array\./);
    assert.throws(() => parseHar('x'), /not valid JSON\./);

    assert.throws(
      () => parseHar('{"log":{"entries":[' + '{},'.repeat(10_000) + '{}]}}'),
      /HAR input exceeds 10,000 entries\./,
    );

    assert.throws(
      () => parseHar(' '.repeat(10_485_761)),
      /HAR input exceeds 10,485,760 characters\./,
    );
  });

  it('strips a leading byte order mark and rejects blank input', () => {
    const bom = String.fromCharCode(0xfeff);

    assert.equal(parseHar(`${bom}${harBasic}`).entries.length, 3);
    assert.throws(() => parseHar(''), /HAR input is empty\./);
    assert.throws(() => parseHar(' \n\t '), /HAR input is empty\./);
  });

  it('treats a negative or missing time as unknown', () => {
    const { entries } = parseHar(
      JSON.stringify({ log: { entries: [{ time: -1 }, {}], version: '1.2' } }),
    );

    assert.deepEqual(
      entries.map((entry) => entry.time),
      [null, null],
    );
  });

  it('reads the error Chromium records on the response', () => {
    const har = JSON.stringify({
      log: {
        entries: [
          { request: {}, response: { _error: 'net::ERR_CONNECTION_REFUSED', status: 0 } },
          { _error: 'net::ERR_ABORTED', request: {}, response: { status: 0 } },
        ],
      },
    });

    assert.deepEqual(
      parseHar(har).entries.map((entry) => entry.error),
      ['net::ERR_CONNECTION_REFUSED', 'net::ERR_ABORTED'],
    );
  });
});
