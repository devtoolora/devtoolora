import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  normalizeLogTimestamps,
  parseApacheTime,
  type NormalizeOptions,
} from '@devtoolora/functions/logs';

const o: NormalizeOptions = {
  dateOrder: 'mdy',
  mode: 'replace',
  target: 'iso-utc',
  timeZone: 'Europe/Prague',
  year: 2026,
};
const n = (text: string, extra: Partial<NormalizeOptions> = {}) =>
  normalizeLogTimestamps(text, { ...o, ...extra });

describe('log timestamp normalizer', () => {
  it('normalizes every supported format', () => {
    assert.equal(n('Oct 27 10:48:01 host sshd[1]: x').text, '2026-10-27T09:48:01Z host sshd[1]: x');
    assert.equal(n('Oct  7 10:48:01 x').text, '2026-10-07T08:48:01Z x');
    assert.equal(n('[27/Oct/2026:10:48:01 +0200] GET /').text, '[2026-10-27T08:48:01Z] GET /');
    assert.equal(n('1793090881 start').text, '2026-10-27T08:48:01Z start');
    assert.equal(n('1793090881123 start').text, '2026-10-27T08:48:01.123Z start');
    assert.equal(n('ts=1793090881.5 x').text, 'ts=2026-10-27T08:48:01.500Z x');
    assert.equal(n('2026-10-27 10:48:01,123 INFO x').text, '2026-10-27T09:48:01.123Z INFO x');
    assert.equal(n('2026-10-27T10:48:01+02:00 x').text, '2026-10-27T08:48:01Z x');
    assert.equal(n('2026-10-27T10:48:01+0200 x').text, '2026-10-27T08:48:01Z x');
    assert.equal(n('2026-10-27T08:48:01Z x', { timeZone: 'UTC' }).text, '2026-10-27T08:48:01Z x');
    assert.equal(n('Tue, 27 Oct 2026 10:48:01 +0200 x').text, '2026-10-27T08:48:01Z x');
    assert.equal(n('Tue, 27 Oct 2026 10:48:01 GMT x').text, '2026-10-27T10:48:01Z x');
    assert.equal(n('1793090881.1234 x').text, '2026-10-27T08:48:01.123Z x');
    assert.equal(n('10/27/2026 10:48:01 x').text, '2026-10-27T09:48:01Z x');
    assert.equal(n('27/10/2026 10:48:01 x', { dateOrder: 'dmy' }).text, '2026-10-27T09:48:01Z x');
  });

  it('supports targets and modes', () => {
    assert.equal(
      n('1793090881 start', { target: 'iso-zone' }).text,
      '2026-10-27T09:48:01+01:00 start',
    );

    assert.equal(n('1793090881 start', { target: 'unix-ms' }).text, '1793090881000 start');
    assert.equal(n('2026-10-27T08:48:01.123Z x', { target: 'unix-s' }).text, '1793090881 x');

    assert.equal(
      n('Oct 27 10:48:01 x', { mode: 'prefix' }).text,
      '2026-10-27T09:48:01Z\tOct 27 10:48:01 x',
    );
  });

  it('leaves non-timestamps and impossible dates alone', () => {
    assert.equal(n('call 0123456789 now').text, 'call 0123456789 now');
    assert.equal(n('id=1793090881x').text, 'id=1793090881x');
    assert.equal(n('Feb 30 10:00:00 x').text, 'Feb 30 10:00:00 x');
    assert.equal(n('Oct 32 10:00:00 x').text, 'Oct 32 10:00:00 x');
    assert.equal(n('2026-10-27 25:00:00 x').text, '2026-10-27 25:00:00 x');
  });

  it('counts lines and formats', () => {
    assert.deepEqual(n('Oct 27 10:48:01 a\nplain\n1793090881 b'), {
      formats: ['syslog', 'unix-s'],
      normalized: 2,
      text: '2026-10-27T09:48:01Z a\nplain\n2026-10-27T08:48:01Z b',
      unchanged: 1,
    });
  });

  it('rejects bad options and oversized input', () => {
    assert.throws(() => n('x', { year: 1969 }), /Year must be between 1970 and 2100\./);
    assert.throws(() => n('x\n'.repeat(100_001)), /Log input exceeds 100,000 lines\./);
    assert.throws(() => n('x', { timeZone: 'Mars/Olympus' }));
  });

  it('parses Apache times', () => {
    assert.equal(parseApacheTime('10/Oct/2000:13:55:36 -0700'), Date.UTC(2000, 9, 10, 20, 55, 36));
  });

  it('matches zone words only as whole words', () => {
    assert.equal(n('Tue, 27 Oct 2026 10:48:01 GMT x').text, '2026-10-27T10:48:01Z x');
    assert.equal(n('Tue, 27 Oct 2026 10:48:01 GMTX x').text, 'Tue, 27 Oct 2026 10:48:01 GMTX x');
  });

  it('handles years below 100, two stamps, DST gaps and CRLF', () => {
    assert.equal(n('0026-10-27T10:48:01Z x').text, '0026-10-27T10:48:01Z x');
    assert.equal(n('a 1793090881 b 1793090882').text, 'a 2026-10-27T08:48:01Z b 1793090882');
    assert.equal(n('2026-03-29 02:30:00 x').text, '2026-03-29T01:30:00Z x');

    assert.equal(
      n('Oct 27 10:48:01 x\r\nOct 27 10:48:02 y').text,
      '2026-10-27T09:48:01Z x\r\n2026-10-27T09:48:02Z y',
    );

    assert.equal(
      n('2026-10-27 10:48:01', { target: 'iso-zone' }).text,
      '2026-10-27T10:48:01+01:00',
    );
  });

  it('pins low years and rejects zone words followed by more characters', () => {
    assert.equal(n('0026-10-27T10:48:01Z', { target: 'unix-ms' }).text, '-61320805919000');

    for (const zone of ['UTCX', 'ESTX', 'GMT+1', 'GMT-0500', 'EST\u00e9', '+02000', 'GMT_x']) {
      const line = `Tue, 27 Oct 2026 10:48:01 ${zone}`;

      assert.equal(n(line).text, line, zone);
    }

    assert.equal(n('Tue, 27 Oct 2026 10:48:01 GMT, x').text, '2026-10-27T10:48:01Z, x');
  });
});

describe('log timestamp zones', () => {
  const utc = (text: string) => n(text, { timeZone: 'UTC' }).text;

  it('reads an hours-only offset', () => {
    assert.equal(utc('2026-10-27 10:48:01+02 pg log'), '2026-10-27T08:48:01Z pg log');
    assert.equal(utc('2026-10-27 10:48:01.5-05: pg'), '2026-10-27T15:48:01.500Z: pg');
  });

  it('does not take the start of another value for an offset', () => {
    assert.equal(utc('2026-10-27 10:48:01-12345 x'), '2026-10-27T10:48:01Z-12345 x');
    assert.equal(utc('2026-10-27 10:48:01-10:49:00 x'), '2026-10-27T10:48:01Z-10:49:00 x');
  });

  it('reads an offset after a space', () => {
    assert.equal(utc('2026-10-27 10:48:01 +0200 x'), '2026-10-27T08:48:01Z x');
    assert.equal(utc('2026-10-27 10:48:01 -05:00 x'), '2026-10-27T15:48:01Z x');
    assert.equal(utc('2026-10-27 10:48:01 -12 items'), '2026-10-27T10:48:01Z -12 items');
  });

  it('reads a zone name instead of the selected zone', () => {
    assert.equal(
      n('2026-10-27 10:48:01.123 UTC [123] LOG: x').text,
      '2026-10-27T10:48:01.123Z [123] LOG: x',
    );

    assert.equal(utc('2026-10-27 10:48:01 CET x'), '2026-10-27T09:48:01Z x');
    assert.equal(utc('2026-07-27 10:48:01 CEST x'), '2026-07-27T08:48:01Z x');
    assert.equal(utc('2026-10-27 10:48:01 EST x'), '2026-10-27T15:48:01Z x');
    assert.equal(utc('2026-10-27 10:48:01 INFO x'), '2026-10-27T10:48:01Z INFO x');
    assert.equal(utc('2026-10-27 10:48:01 UTCX'), '2026-10-27T10:48:01Z UTCX');
  });
});

describe('log timestamp choice', () => {
  it('prefers a dated timestamp over an earlier bare number', () => {
    assert.equal(
      n('req 1234567890 at 2026-10-27T10:48:01Z done').text,
      'req 1234567890 at 2026-10-27T10:48:01Z done',
    );

    assert.equal(
      n('req 1234567890 at 2026-10-27T10:48:01+02:00 done').text,
      'req 1234567890 at 2026-10-27T08:48:01Z done',
    );

    assert.equal(n('req 1793090881 done').text, 'req 2026-10-27T08:48:01Z done');
  });

  it('does not count the empty text after a final newline as a line', () => {
    assert.deepEqual(n('x 2026-10-27T10:48:01Z\n'), {
      formats: ['iso'],
      normalized: 1,
      text: 'x 2026-10-27T10:48:01Z\n',
      unchanged: 0,
    });

    assert.equal(n('plain\n\nplain\n').unchanged, 3);
  });
});
