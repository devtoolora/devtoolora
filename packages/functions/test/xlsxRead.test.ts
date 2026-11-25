import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readXlsx } from '../src/office';
import { buildXlsx, firstSheetExpected, legacyXls, odsZip, styles } from './fixtures/xlsx';

const first = { allSheets: false, sheet: '' };

function failure(run: () => unknown): { code?: string; message: string } {
  try {
    run();
  } catch (error) {
    return error as { code?: string; message: string };
  }

  return { message: '' };
}

describe('readXlsx errors', () => {
  it('words non-office input for the workbook', () => {
    expect(
      failure(() => readXlsx(strToU8('plain text, not a zip file at all'), first)).message,
    ).toBe('This is not a .xlsx file.');

    expect(failure(() => readXlsx(zipSync({ 'a.txt': strToU8('x') }), first)).message).toBe(
      'This is not a .xlsx file.',
    );

    expect(
      failure(() => readXlsx(zipSync({ 'xl/workbook.xml': strToU8('<a><b></a>') }), first)).message,
    ).toBe('The workbook looks corrupt: xl/workbook.xml is not valid XML.');
  });
});

describe('readXlsx', () => {
  it('reads every cell type, position rule and escape of the first sheet', () => {
    const { sheets, skipped } = readXlsx(buildXlsx(), first);

    expect(skipped).toEqual(['Chart']);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.name).toBe('First');
    expect(sheets[0]?.rows).toEqual(firstSheetExpected);
    expect(sheets[0]?.dates).toBe(2);
    expect(sheets[0]?.formulas).toBe(3);
  });

  it('switches the date epoch for date1904', () => {
    const rows = readXlsx(buildXlsx({ date1904: true }), first).sheets[0]?.rows;

    expect(rows?.[3]?.slice(0, 2)).toEqual(['2029-10-29', '2029-10-29T12:00:00']);
  });

  it('selects a sheet by name or by 1-based number', () => {
    for (const sheet of ['Second', '2']) {
      const result = readXlsx(buildXlsx(), { allSheets: false, sheet });

      expect(result.sheets.map((entry) => entry.name)).toEqual(['Second']);
      expect(result.sheets[0]?.rows).toEqual([['second']]);
    }
  });

  it('names the sheets when the requested one is missing or is a chart sheet', () => {
    expect(failure(() => readXlsx(buildXlsx(), { allSheets: false, sheet: 'Nope' })).message).toBe(
      'Sheet "Nope" was not found. The sheets are: First, Second, Chart.',
    );

    expect(failure(() => readXlsx(buildXlsx(), { allSheets: false, sheet: '3' })).message).toMatch(
      /chart sheet/,
    );
  });

  it('decodes escapes in shared strings', () => {
    const rows = '<row r="1"><c r="A1" t="s"><v>2</v></c><c r="B1" t="s"><v>3</v></c></row>';

    expect(readXlsx(buildXlsx({ firstRows: rows }), first).sheets[0]?.rows).toEqual([
      ['p\rq', '_x0041_'],
    ]);
  });

  it('finds shared strings through the workbook relationships', () => {
    const rows = '<row r="1"><c r="A1" t="s"><v>0</v></c></row>';
    const bytes = buildXlsx({ firstRows: rows, sharedStringsPath: 'xl/SharedStrings.xml' });

    expect(readXlsx(bytes, first).sheets[0]?.rows).toEqual([['Name']]);
  });

  it('reports a shared string cell without a table as corrupt', () => {
    const rows = '<row r="1"><c r="A1" t="s"><v>0</v></c></row>';
    const error = failure(() =>
      readXlsx(buildXlsx({ firstRows: rows, noSharedStrings: true }), first),
    );

    expect(error.code).toBe('INVALID_XLSX');
    expect(error.message).toMatch(/cell A1/);
  });

  it('matches sheet names case-insensitively after an exact match', () => {
    expect(readXlsx(buildXlsx(), { allSheets: false, sheet: 'second' }).sheets[0]?.name).toBe(
      'Second',
    );
  });

  it('reads all worksheets and names the skipped chart sheet', () => {
    const { sheets, skipped } = readXlsx(buildXlsx(), { allSheets: true, sheet: '' });

    expect(sheets.map((entry) => entry.name)).toEqual(['First', 'Second']);
    expect(skipped).toEqual(['Chart']);
  });

  it('reads the same workbook whatever namespace prefix the writer chose', () => {
    expect(readXlsx(buildXlsx({ prefix: 'x' }), first)).toEqual(readXlsx(buildXlsx(), first));
  });

  it('reads a workbook without styles and shared strings', () => {
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const zip = zipSync({
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Type="x/worksheet" Target="worksheets/s.xml"/></Relationships>',
      ),
      'xl/workbook.xml': strToU8(
        `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Only" sheetId="1" r:id="a"/></sheets></workbook>`,
      ),
      'xl/worksheets/s.xml': strToU8(
        `<worksheet xmlns="${ns}"><sheetData><row><c><v>7</v></c><c><v>abc</v></c></row></sheetData></worksheet>`,
      ),
    });

    expect(readXlsx(zip, first).sheets[0]?.rows).toEqual([[7, 'abc']]);
  });

  it('names legacy and OpenDocument files', () => {
    expect(failure(() => readXlsx(legacyXls, first)).message).toMatch(/legacy \.xls/);
    expect(failure(() => readXlsx(odsZip, first)).message).toMatch(/\.ods/);
  });

  it('reports a corrupt file instead of crashing', () => {
    const noWorkbook = zipSync({ 'xl/styles.xml': strToU8(styles) });
    const emptySheet = zipSync({
      ...unzipSync(buildXlsx()),
      'xl/worksheets/sheet1.xml': new Uint8Array(0),
    });

    expect(failure(() => readXlsx(noWorkbook, first)).message).toBe('This is not a .xlsx file.');
    expect(failure(() => readXlsx(emptySheet, first)).code).toBe('INVALID_XLSX');
    expect(failure(() => readXlsx(strToU8('not a zip'), first)).code).toBe('INVALID_XLSX');
  });

  it('refuses a file over 20 MiB', () => {
    expect(failure(() => readXlsx(new Uint8Array(20 * 1024 * 1024 + 1), first)).message).toMatch(
      /20 MiB/,
    );
  });

  it('refuses a sheet whose used range is beyond the CSV limits', () => {
    const rows =
      '<row r="1"><c r="A1"><v>1</v></c></row><row r="100002"><c r="A100002"><v>1</v></c></row>';

    expect(failure(() => readXlsx(buildXlsx({ firstRows: rows }), first)).message).toMatch(
      /100,000 rows/,
    );
  });
});
