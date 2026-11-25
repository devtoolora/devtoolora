import { describe, expect, it } from 'vitest';
import { dateFormatKind, excelSerialToIso, isoToExcelSerial } from '../src/office';

describe('excelSerialToIso', () => {
  it.each([
    [45958, 'date', '2025-10-28'],
    [45958.5, 'datetime', '2025-10-28T12:00:00'],
    [45958.999994, 'datetime', '2025-10-28T23:59:59'],
    [61, 'date', '1900-03-01'],
    [60, 'date', '1900-02-29'],
    [59, 'date', '1900-02-28'],
    [1, 'date', '1900-01-01'],
    [0.75, 'time', '18:00:00'],
    [0, 'time', '00:00:00'],
  ] as const)('1900 system: %s as %s', (serial, kind, expected) => {
    expect(excelSerialToIso(serial, kind, false)).toBe(expected);
  });

  it.each([
    [0, 'date', '1904-01-01'],
    [44496, 'date', '2025-10-28'],
    [44496.25, 'datetime', '2025-10-28T06:00:00'],
  ] as const)('1904 system: %s as %s', (serial, kind, expected) => {
    expect(excelSerialToIso(serial, kind, true)).toBe(expected);
  });

  it('keeps counting hours for elapsed time', () => {
    expect(excelSerialToIso(1.5, 'duration', false)).toBe('36:00:00');
    expect(excelSerialToIso(0.75, 'duration', false)).toBe('18:00:00');
    expect(excelSerialToIso(2, 'duration', false)).toBe('48:00:00');
  });

  it('leaves out-of-range serials as numbers unless the format is time only', () => {
    expect(excelSerialToIso(0.5, 'date', false)).toBeUndefined();
    expect(excelSerialToIso(-1, 'date', true)).toBeUndefined();
    expect(excelSerialToIso(-1, 'time', true)).toBeUndefined();
    expect(excelSerialToIso(1e12, 'date', false)).toBeUndefined();
    expect(excelSerialToIso(0.5, 'time', false)).toBe('12:00:00');
  });
});

describe('dateFormatKind', () => {
  it.each([
    ['yyyy-mm-dd', 'date'],
    ['h:mm:ss', 'time'],
    ['[h]:mm', 'duration'],
    ['[mm]:ss', 'duration'],
    ['mm:ss', 'time'],
    ['h:mm AM/PM', 'time'],
    ['dd/mm/yyyy hh:mm', 'datetime'],
    ['[$-409]mmmm d, yyyy', 'date'],
    ['"day" 0.00', undefined],
    ['[Red]0.00', undefined],
    ['\\d0', undefined],
    ['General', undefined],
    ['0.00E+00', undefined],
  ] as const)('%s is %s', (code, expected) => {
    expect(dateFormatKind(code)).toBe(expected);
  });
});

describe('isoToExcelSerial', () => {
  it('converts dates and times in the 1900 system', () => {
    expect(isoToExcelSerial('2026-10-28')).toBe(46323);
    expect(isoToExcelSerial('2026-10-28T10:00')).toBe(46323.416666666664);
    expect(isoToExcelSerial('1900-03-01')).toBe(61);
    expect(isoToExcelSerial('2000-02-29')).toBe(36585);
  });

  it('rejects dates before 1900-03-01 and impossible dates', () => {
    expect(isoToExcelSerial('1900-02-28')).toBeUndefined();
    expect(isoToExcelSerial('2025-02-30')).toBeUndefined();
    expect(isoToExcelSerial('not a date')).toBeUndefined();
  });
});
