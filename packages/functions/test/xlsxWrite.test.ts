import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import {
  detectCell,
  isoToExcelSerial,
  readXlsx,
  rowsFromJson,
  writeXlsx,
  type XlsxCellIn,
} from '../src/office';

const dump = (rows: XlsxCellIn[][], headerRow = false, sheetName = 'Sheet1') =>
  writeXlsx(rows, { headerRow, sheetName });
const read = (bytes: Uint8Array) => readXlsx(bytes, { allSheets: false, sheet: '' }).sheets[0];
const part = (bytes: Uint8Array, name: string) =>
  new TextDecoder().decode(unzipSync(bytes)[name] as Uint8Array);

describe('detectCell', () => {
  it('detects numbers and keeps id-like text', () => {
    assert.equal(detectCell('42'), 42);
    assert.equal(detectCell('-0.5'), -0.5);
    assert.equal(detectCell('1e3'), 1000);

    for (const text of [
      '-0',
      '-0.0',
      '1e-400',
      '1e308',
      '0001-01-01',
      '0099-12-31',
      '007',
      '+5',
      '1,000',
      '5%',
      '1234567890123456',
      ' 4',
      '1e999',
      '',
    ])
      assert.equal(detectCell(text), text, text);
  });

  it('detects booleans and dates', () => {
    assert.equal(detectCell('TRUE'), true);
    assert.equal(detectCell('false'), false);
    assert.deepEqual(detectCell('2026-10-28'), { format: 'date', serial: 46323 });

    assert.deepEqual(detectCell('2026-10-28T10:00'), {
      format: 'datetime',
      serial: 46323.416666666664,
    });

    assert.deepEqual(detectCell('2000-02-29'), { format: 'date', serial: 36585 });
    assert.equal(detectCell('1899-12-31'), '1899-12-31');
    assert.equal(detectCell('1900-02-28'), '1900-02-28');
    assert.equal(detectCell('2026-02-30'), '2026-02-30');
  });
});

describe('writeXlsx', () => {
  it('round trips text, numbers, booleans and dates through readXlsx', () => {
    const odd = [
      ' lead',
      'trail ',
      'a & <b>',
      'tab\tline\nbreak',
      '\u00fcn\u00ef \u65e5\u672c',
      'plain',
    ];
    const rows: XlsxCellIn[][] = [
      odd,
      [
        1.5,
        true,
        false,
        -3,
        { format: 'date', serial: 46323 },
        { format: 'datetime', serial: 46323.5 },
      ],
    ];
    const { bytes, types } = dump(rows);

    assert.deepEqual(read(bytes)?.rows, [
      odd,
      [1.5, true, false, -3, '2026-10-28', '2026-10-28T12:00:00'],
    ]);

    assert.deepEqual(types, { boolean: 2, date: 2, number: 2, text: 6 });
  });

  it('escapes characters XML cannot hold and literal escapes', () => {
    const odd = [`x${String.fromCharCode(1)}y`, '_x0041_', 'a\r\nb', '_x005F_'];
    const { bytes } = dump([odd]);

    assert.deepEqual(read(bytes)?.rows, [odd]);
    assert.match(part(bytes, 'xl/sharedStrings.xml'), /<t>_x005F_x0041_<\/t>/);
  });

  it('is deterministic and freezes the header only on request', () => {
    const rows: XlsxCellIn[][] = [['a'], [1]];
    const framed = dump(rows, true).bytes;

    assert.deepEqual(framed, dump(rows, true).bytes);
    assert.match(part(framed, 'xl/worksheets/sheet1.xml'), /<pane [^>]*ySplit="1"/);
    assert.match(part(framed, 'xl/styles.xml'), /<b\/>/);
    assert.doesNotMatch(part(dump(rows).bytes, 'xl/worksheets/sheet1.xml'), /<pane/);
  });

  it('names the part files, counts shared strings and anchors the frozen pane', () => {
    const { bytes } = dump([['a', 'a', 'b']], true);

    assert.deepEqual(Object.keys(unzipSync(bytes)).sort(), [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/sharedStrings.xml',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);

    assert.match(
      part(bytes, '[Content_Types].xml'),
      /worksheet\+xml.*styles\+xml.*sharedStrings\+xml/,
    );

    assert.match(part(bytes, 'xl/sharedStrings.xml'), /count="3" uniqueCount="2"/);
    assert.match(part(bytes, 'xl/worksheets/sheet1.xml'), /topLeftCell="A2"[^>]*state="frozen"/);
  });

  it('bounds rows and columns, naming the cell', () => {
    assert.throws(() => dump(Array.from({ length: 1_048_577 }, () => [1])), /A1048577/);
    assert.throws(() => dump([[1], Array.from({ length: 16385 }, () => 1)]), /XFE2/);
    assert.equal(dump(Array.from({ length: 200_000 }, () => [1])).columns, 1);
  });

  it('rejects bad sheet names and Excel limits', () => {
    for (const name of ['a/b', '', '  ', 'history', 'a\u0001b', 'x'.repeat(32), "'x", "x'", 'a[1]'])
      assert.throws(() => dump([['a']], false, name), /sheet name/i, name);

    assert.equal(dump([['a']], false, 'x'.repeat(31)).types.text, 1);
    assert.throws(() => dump([['a', 'b'.repeat(32768)]]), /B1/);
    assert.throws(() => dump([Array.from({ length: 16385 }, () => 1)]), /16,384 columns/);
    assert.throws(() => dump([]), /no data/i);
  });
});

describe('isoToExcelSerial', () => {
  it('has no serial for years before 1900', () => {
    assert.equal(isoToExcelSerial('0001-01-01'), undefined);
    assert.equal(isoToExcelSerial('0099-12-31'), undefined);
  });
});

describe('rowsFromJson', () => {
  it('keeps numbers outside the Excel range as text', () => {
    assert.deepEqual(rowsFromJson('[[1e308, 5e-324, -0, 1.5]]', true), [
      ['1e+308', '5e-324', 0, 1.5],
    ]);
  });

  it('builds a header from the union of keys', () => {
    assert.deepEqual(rowsFromJson('[{"a":1,"b":true},{"b":null,"c":{"x":1}}]', true), [
      ['a', 'b', 'c'],
      [1, true, null],
      [null, null, '{"x":1}'],
    ]);
  });

  it('detects types in strings only when asked and accepts arrays of arrays', () => {
    assert.deepEqual(rowsFromJson('[["1","x"],[2]]', true), [[1, 'x'], [2]]);
    assert.deepEqual(rowsFromJson('[["1"]]', false), [['1']]);
  });

  it('rejects other shapes', () => {
    for (const source of ['{}', '[]', '[1]', '[{"a":1},[2]]', 'nope', '[[1e999]]'])
      assert.throws(() => rowsFromJson(source, true), source);
  });
});
