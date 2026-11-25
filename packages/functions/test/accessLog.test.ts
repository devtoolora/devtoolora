import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseAccessLog, summarizeAccessLog } from '@devtoolora/functions/logs';

const wiki =
  '127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://www.example.com/start.html" "Mozilla/4.08 [en] (Win98; I ;Nav)"';

describe('access log parser', () => {
  it('parses a combined line', () => {
    const { entries, unparsed } = parseAccessLog(wiki);

    assert.deepEqual(unparsed, []);

    assert.deepEqual(entries, [
      {
        bytes: 2326,
        ip: '127.0.0.1',
        line: 1,
        method: 'GET',
        path: '/apache_pb.gif',
        protocol: 'HTTP/1.0',
        referer: 'http://www.example.com/start.html',
        status: 200,
        time: Date.UTC(2000, 9, 10, 20, 55, 36),
        timeText: '10/Oct/2000:13:55:36 -0700',
        user: 'frank',
        userAgent: 'Mozilla/4.08 [en] (Win98; I ;Nav)',
      },
    ]);
  });

  it('handles escaped quotes, common format, dashes and garbage', () => {
    const text = [
      '1.1.1.1 - - [10/Oct/2000:13:55:36 +0000] "GET / HTTP/1.1" 304 - "-" "a \\"q\\" b"',
      '',
      'garbage',
      '2.2.2.2 - - [bad time] "-" 400 12',
    ].join('\n');
    const { entries, unparsed } = parseAccessLog(text);

    assert.deepEqual(unparsed, [3]);
    assert.equal(entries[0]?.bytes, null);
    assert.equal(entries[0]?.user, '');
    assert.equal(entries[0]?.userAgent, 'a "q" b');
    assert.equal(entries[1]?.referer, '');
    assert.equal(entries[1]?.userAgent, '');
    assert.equal(entries[1]?.method, '-');
    assert.equal(entries[1]?.path, '-');
    assert.equal(entries[1]?.time, null);
    assert.equal(entries[1]?.timeText, 'bad time');
    assert.equal(entries[1]?.line, 4);
  });

  it('limits the line count', () => {
    assert.throws(() => parseAccessLog('\n'.repeat(100_001)), {
      message: 'Log input exceeds 100,000 lines.',
    });
  });

  it('summarizes entries', () => {
    const line = (path: string, status: number, bytes: string, ip = '1.1.1.1') =>
      `${ip} - - [10/Oct/2000:13:55:36 +0000] "GET ${path} HTTP/1.1" ${status} ${bytes}`;
    const { entries } = parseAccessLog(
      [
        line('/a', 200, '10'),
        line('/a', 404, '-'),
        line('/b', 500, '5', '2.2.2.2'),
        line('/__proto__', 200, '1'),
        line('/c', 301, '4'),
      ].join('\n'),
    );
    const summary = summarizeAccessLog(entries, 2);

    assert.deepEqual(summary.classes, { '1xx': 0, '2xx': 2, '3xx': 1, '4xx': 1, '5xx': 1 });
    assert.equal(summary.errors, 2);
    assert.equal(summary.totalBytes, 20);
    assert.equal(summary.firstTime, Date.UTC(2000, 9, 10, 13, 55, 36));

    assert.deepEqual(summary.topPaths, [
      ['/a', 2],
      ['/__proto__', 1],
    ]);

    assert.deepEqual(summary.topIps, [
      ['1.1.1.1', 4],
      ['2.2.2.2', 1],
    ]);

    assert.deepEqual(summary.byMethod, [['GET', 5]]);
    assert.deepEqual(summary.byStatus[0], ['200', 2]);
  });

  it('validates top', () => {
    assert.throws(() => summarizeAccessLog([], 0), { message: 'Top must be between 1 and 100.' });

    assert.throws(() => summarizeAccessLog([], 101), {
      message: 'Top must be between 1 and 100.',
    });
  });

  it('accepts exactly 100,000 lines with a trailing newline', () => {
    const text = `${Array.from({ length: 100_000 }, () => 'x').join('\n')}\n`;

    assert.equal(parseAccessLog(text).unparsed.length, 100_000);

    assert.throws(() => parseAccessLog(`${text}x`), {
      message: 'Log input exceeds 100,000 lines.',
    });
  });

  it('reads escaped quotes in the request and leaves other escapes as written', () => {
    const line = (request: string) =>
      `1.1.1.1 - - [10/Oct/2000:13:55:36 +0000] "${request}" 200 1 "x\\x22y" "-"`;
    const { entries } = parseAccessLog(
      [line('GET /\\"x HTTP/1.1'), line('GET /\\x22y HTTP/1.1')].join('\n'),
    );

    assert.equal(entries[0]?.path, '/"x');
    assert.equal(entries[0]?.protocol, 'HTTP/1.1');
    assert.equal(entries[1]?.path, '/\\x22y');
    assert.equal(entries[1]?.referer, 'x\\x22y');
  });
});
