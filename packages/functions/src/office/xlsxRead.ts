import { FunctionError } from '../errors';
import { csvLimits } from '../format/csv';
import { childElements, firstChild, localName, textContent } from '../format/xmlElements';
import { XmlElement } from '@rgrove/parse-xml';
import {
  assertOfficeZip,
  corruptOffice,
  notOfficeFile,
  officeMaxBytes,
  officeXml,
  readOfficeZip,
  resolveOfficePart,
} from './container';
import { excelSerialToIso } from './excelDates';
import { dateKindsByStyle, richText, sharedStringTexts, unescapeOoxml } from './xlsxStyles';

export type XlsxValue = boolean | number | string | null;
export type XlsxSheet = { dates: number; formulas: number; name: string; rows: XlsxValue[][] };

type SheetRef = { kind: string; name: string; path: string };

const corrupt = (message: string): FunctionError => corruptOffice('xlsx', message);

function rootOf(entries: Map<string, Uint8Array>, path: string, name: string): XmlElement {
  if (!entries.get(path)?.length) throw corrupt(`${path} is missing or empty.`);

  const root = officeXml(entries, path, 'xlsx')?.root;

  if (!root || localName(root.name) !== name) throw corrupt(`${path} has no ${name} element.`);

  return root;
}

type Workbook = { date1904: boolean; sharedStrings: string; sheets: SheetRef[]; styles: string };

function sheetRefs(entries: Map<string, Uint8Array>): Workbook {
  const workbook = rootOf(entries, 'xl/workbook.xml', 'workbook');
  const rels = rootOf(entries, 'xl/_rels/workbook.xml.rels', 'Relationships');
  const targets = new Map(
    childElements(rels).map((rel) => [rel.attributes.Id, rel.attributes] as const),
  );
  const properties = firstChild(workbook, 'workbookPr')?.attributes.date1904;
  const list = firstChild(workbook, 'sheets');

  if (!list) throw corrupt('xl/workbook.xml has no sheets.');

  const partOf = (kind: string, fallback: string): string => {
    const rel = childElements(rels).find((entry) =>
      (entry.attributes.Type ?? '').endsWith(`/${kind}`),
    );

    return rel?.attributes.Target ? resolveOfficePart('xl/', rel.attributes.Target) : fallback;
  };

  return {
    date1904: properties === '1' || properties === 'true',
    sharedStrings: partOf('sharedStrings', 'xl/sharedStrings.xml'),
    styles: partOf('styles', 'xl/styles.xml'),
    sheets: childElements(list).map((sheet) => {
      // The relationship id attribute is r:id whatever prefix the writer bound.
      const key = Object.keys(sheet.attributes).find((name) => localName(name) === 'id');
      const rel = targets.get(key ? sheet.attributes[key] : undefined);

      if (!rel?.Target) throw corrupt(`sheet "${sheet.attributes.name}" has no target.`);

      return {
        kind: localName(rel.Type ?? '').replace(/^.*\//, ''),
        name: sheet.attributes.name ?? '',
        path: resolveOfficePart('xl/', rel.Target),
      };
    }),
  };
}

function chooseSheets(sheets: SheetRef[], options: { allSheets: boolean; sheet: string }) {
  const readable = sheets.filter((sheet) => sheet.kind === 'worksheet');
  const skipped = sheets.filter((sheet) => sheet.kind !== 'worksheet').map((sheet) => sheet.name);
  const request = options.sheet.trim();

  if (options.allSheets) {
    if (!readable.length) throw new FunctionError('XLSX_SHEET', 'The workbook has no worksheet.');

    return { chosen: readable, skipped };
  }

  const found = request
    ? (sheets.find((sheet) => sheet.name === request) ??
      sheets.find((sheet) => sheet.name.toLowerCase() === request.toLowerCase()) ??
      (/^\d+$/.test(request) ? sheets[Number(request) - 1] : undefined))
    : readable[0];

  if (!found)
    throw new FunctionError(
      'XLSX_SHEET',
      request
        ? `Sheet "${request}" was not found. The sheets are: ${sheets.map((sheet) => sheet.name).join(', ')}.`
        : 'The workbook has no worksheet.',
    );

  if (found.kind !== 'worksheet')
    throw new FunctionError(
      'XLSX_SHEET',
      `"${found.name}" is a ${found.kind.replace(/sheet$/, ' sheet')} and has no cells.`,
    );

  return { chosen: [found], skipped };
}

export function readXlsx(
  bytes: Uint8Array,
  options: { allSheets: boolean; sheet: string },
): { sheets: XlsxSheet[]; skipped: string[] } {
  if (bytes.length > officeMaxBytes)
    throw new FunctionError('XLSX_LIMIT', 'An XLSX file is limited to 20 MiB.');

  assertOfficeZip(bytes, 'xlsx');

  const head = readOfficeZip(
    bytes,
    'xlsx',
    (name) => name === 'xl/workbook.xml' || name === 'xl/_rels/workbook.xml.rels',
  );

  if (!head.has('xl/workbook.xml')) throw notOfficeFile('xlsx');

  const { date1904, sharedStrings, sheets, styles } = sheetRefs(head);
  const { chosen, skipped } = chooseSheets(sheets, options);
  const paths = new Set(chosen.map((sheet) => sheet.path));
  const entries = readOfficeZip(
    bytes,
    'xlsx',
    (name) => name === sharedStrings || name === styles || paths.has(name),
  );
  const context = {
    date1904,
    kinds: dateKindsByStyle(
      entries.has(styles) ? rootOf(entries, styles, 'styleSheet') : undefined,
    ),
    strings: sharedStringTexts(
      entries.has(sharedStrings) ? rootOf(entries, sharedStrings, 'sst') : undefined,
    ),
  };

  return {
    sheets: chosen.map((sheet) =>
      readSheet(sheet.name, rootOf(entries, sheet.path, 'worksheet'), context),
    ),
    skipped,
  };
}

type Context = { date1904: boolean; kinds: ReturnType<typeof dateKindsByStyle>; strings: string[] };

function columnIndex(letters: string): number {
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function cellValue(cell: XmlElement, context: Context, tally: { dates: number }): XlsxValue {
  const type = cell.attributes.t ?? 'n';
  const raw = firstChild(cell, 'v');
  const text = raw ? textContent(raw) : '';

  if (type === 'inlineStr') {
    const inline = firstChild(cell, 'is');

    return inline ? unescapeOoxml(richText(inline)) : null;
  }

  if (!text) return null;
  if (type === 's') {
    const shared = context.strings[Number(text)];

    if (shared === undefined)
      throw corrupt(
        `cell ${cell.attributes.r ?? '(without a reference)'} points to a missing shared string.`,
      );

    return shared;
  }
  if (type === 'b') return text === '1' || text === 'true';
  if (type === 'n') return numberValue(text, cell.attributes.s, context, tally);

  return type === 'd' ? text : unescapeOoxml(text);
}

function numberValue(
  text: string,
  style: string | undefined,
  context: Context,
  tally: { dates: number },
): XlsxValue {
  const value = Number(text);

  if (!text.trim() || !Number.isFinite(value)) return text;

  const kind = style === undefined ? undefined : context.kinds[Number(style)];

  const iso = kind && excelSerialToIso(value, kind, context.date1904);

  if (iso) tally.dates += 1;

  return iso || value;
}

function readSheet(name: string, root: XmlElement, context: Context): XlsxSheet {
  const cells = new Map<number, Map<number, XlsxValue>>();
  const tally = { dates: 0 };
  let formulas = 0;
  let rowNumber = 0;
  let width = 0;
  let height = 0;

  for (const row of childElements(firstChild(root, 'sheetData') ?? root)) {
    if (localName(row.name) !== 'row') continue;

    const declared = Number(row.attributes.r);

    rowNumber = Number.isInteger(declared) && declared > 0 ? declared : rowNumber + 1;

    let column = -1;

    for (const cell of childElements(row)) {
      if (localName(cell.name) !== 'c') continue;

      const ref = /^([A-Za-z]+)(\d+)$/.exec(cell.attributes.r ?? '');

      column = ref?.[1] ? columnIndex(ref[1].toUpperCase()) : column + 1;

      const at = ref?.[2] ? Number(ref[2]) : rowNumber;

      if (firstChild(cell, 'f')) formulas += 1;

      const value = cellValue(cell, context, tally);

      if (value === null || value === '') continue;

      if (column >= csvLimits.columns || at > csvLimits.rows + 1)
        throw limit(column >= csvLimits.columns);

      const line = cells.get(at) ?? new Map<number, XlsxValue>();

      line.set(column, value);
      cells.set(at, line);
      width = Math.max(width, column + 1);
      height = Math.max(height, at);
    }
  }

  if (width * height > csvLimits.cells) throw limit(false);

  const rows = Array.from({ length: height }, (_, index) =>
    Array.from({ length: width }, (__, col): XlsxValue => cells.get(index + 1)?.get(col) ?? null),
  );

  return { dates: tally.dates, formulas, name, rows };
}

function limit(columns: boolean): FunctionError {
  return new FunctionError(
    'XLSX_LIMIT',
    columns
      ? `A sheet is limited to ${csvLimits.columns.toLocaleString('en-US')} columns.`
      : `A sheet is limited to ${csvLimits.rows.toLocaleString('en-US')} rows and ${csvLimits.cells.toLocaleString('en-US')} cells.`,
  );
}
