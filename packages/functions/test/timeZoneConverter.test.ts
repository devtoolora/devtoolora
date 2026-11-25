import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { convertTimeZones } from '@devtoolora/functions/datetime';

describe('time zone converter', () => {
  it('converts an absolute instant to several zones', () => {
    const zones = ['Europe/Prague', 'America/New_York', 'Asia/Kolkata'];
    const summer = convertTimeZones('2026-07-01T12:00', { fromZone: 'UTC', zones });

    assert.equal(summer.instant, '2026-07-01T12:00:00.000Z');

    assert.deepEqual(
      summer.rows.map((row) => [row.local, row.offset, row.dayShift]),
      [
        ['2026-07-01 14:00:00', '+02:00', 0],
        ['2026-07-01 08:00:00', '-04:00', 0],
        ['2026-07-01 17:30:00', '+05:30', 0],
      ],
    );

    assert.equal(
      convertTimeZones('2026-01-15T12:00', { fromZone: 'UTC', zones: ['Europe/Prague'] }).rows[0]!
        .offset,
      '+01:00',
    );
  });

  it('reports the day shift against the source zone', () => {
    const late = convertTimeZones('2026-07-01T23:00', {
      fromZone: 'America/Los_Angeles',
      zones: ['Asia/Tokyo'],
    });

    assert.deepEqual([late.rows[0]!.local, late.rows[0]!.dayShift], ['2026-07-02 15:00:00', 1]);
  });

  it('reads Unix seconds, offsets, date-only and blank input', () => {
    const utc = { fromZone: 'UTC', zones: ['UTC'] };

    assert.equal(convertTimeZones('1700000000', utc).instant, '2023-11-14T22:13:20.000Z');
    assert.equal(convertTimeZones('1700000000000', utc).instant, '2023-11-14T22:13:20.000Z');
    assert.equal(convertTimeZones('2026-07-01', utc).instant, '2026-07-01T00:00:00.000Z');

    assert.equal(
      convertTimeZones('2026-07-01T12:00:00+02:00', utc).instant,
      '2026-07-01T10:00:00.000Z',
    );

    assert.equal(
      convertTimeZones('', { ...utc, now: new Date(0) }).instant,
      '1970-01-01T00:00:00.000Z',
    );
  });

  it('resolves DST gaps and overlaps like timestamp-convert', () => {
    const prague = { fromZone: 'Europe/Prague', zones: ['UTC'] };
    const gap = convertTimeZones('2026-03-29T02:30', prague);
    const overlap = convertTimeZones('2026-10-25T02:30', prague);

    assert.equal(gap.instant, '2026-03-29T01:30:00.000Z');
    assert.match(gap.notes?.join(' ') ?? '', /does not exist/);
    assert.equal(overlap.instant, '2026-10-25T00:30:00.000Z');
    assert.match(overlap.notes?.join(' ') ?? '', /happens twice/);
  });

  it('reads microseconds, two-digit years and rejects impossible times', () => {
    const utc = { fromZone: 'UTC', zones: ['UTC'] };

    assert.equal(convertTimeZones('1700000000000000', utc).instant, '2023-11-14T22:13:20.000Z');
    assert.equal(convertTimeZones('0050-01-01T00:00', utc).instant, '0050-01-01T00:00:00.000Z');
    assert.equal(convertTimeZones('0050-01-01T00:00', utc).rows[0]!.local, '0050-01-01 00:00:00');
    assert.throws(() => convertTimeZones('2026-07-01T12:00:75', utc), /23:59:59/);
  });

  it('counts day shifts beyond one day', () => {
    const forward = convertTimeZones('2026-07-01T23:00', {
      fromZone: 'Pacific/Pago_Pago',
      zones: ['Pacific/Kiritimati'],
    });
    const backward = convertTimeZones('2026-07-03T00:30', {
      fromZone: 'Pacific/Kiritimati',
      zones: ['Pacific/Pago_Pago'],
    });

    assert.deepEqual(
      [forward.rows[0]!.local, forward.rows[0]!.dayShift],
      ['2026-07-03 00:00:00', 2],
    );

    assert.deepEqual(
      [backward.rows[0]!.local, backward.rows[0]!.dayShift],
      ['2026-07-01 23:30:00', -2],
    );
  });

  it('rejects unknown zones, bad input and bad zone lists', () => {
    assert.throws(
      () => convertTimeZones('2026-07-01T12:00', { fromZone: 'UTC', zones: ['Mars/Olympus'] }),
      /Unknown time zone "Mars\/Olympus"/,
    );

    assert.throws(
      () => convertTimeZones('2026-07-01T12:00', { fromZone: 'Mars/Olympus', zones: ['UTC'] }),
      /Unknown time zone "Mars\/Olympus"/,
    );

    assert.throws(
      () => convertTimeZones('tomorrow', { fromZone: 'UTC', zones: ['UTC'] }),
      /ISO 8601/,
    );

    assert.throws(() => convertTimeZones('', { fromZone: 'UTC', zones: [] }), /at least one/);

    assert.throws(
      () => convertTimeZones('', { fromZone: 'UTC', zones: Array(51).fill('UTC') }),
      /50/,
    );
  });

  it('names the year correctly for year 0 and BC dates', () => {
    const local = (input: string) =>
      convertTimeZones(input, { fromZone: 'UTC', zones: ['UTC'] }).rows[0]?.local;

    assert.equal(local('0000-01-01T00:00:00Z'), '0000-01-01 00:00:00');
    assert.equal(local('-000100-01-01T00:00:00Z'), '-000100-01-01 00:00:00');
    assert.equal(local('0001-01-01T00:00:00Z'), '0001-01-01 00:00:00');
  });

  it('keeps the seconds of a historic offset when reading a local time', () => {
    const result = convertTimeZones('1880-01-01T00:00', {
      fromZone: 'Europe/Prague',
      zones: ['Europe/Prague'],
    });

    assert.equal(result.instant, '1879-12-31T23:02:16.000Z');
    assert.equal(result.rows[0]?.local, '1880-01-01 00:00:00');
  });

  it('rejects an abbreviation as a source or target zone', () => {
    assert.throws(
      () => convertTimeZones('0', { fromZone: 'UTC', zones: ['BST'] }),
      /Unknown time zone "BST"/,
    );

    assert.throws(
      () => convertTimeZones('0', { fromZone: 'CST', zones: ['UTC'] }),
      /Unknown time zone "CST"/,
    );
  });
});
