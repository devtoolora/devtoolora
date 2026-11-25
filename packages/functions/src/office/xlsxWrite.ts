import { strToU8, zipSync } from 'fflate';
import { FunctionError } from '../errors';
import type { XlsxCellIn } from './cellTypes';

const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
const docRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const limits = { cell: 32_767, columns: 16_384, rows: 1_048_576 };

export type XlsxWriteTypes = { boolean: number; date: number; number: number; text: number };

function columnLetters(index: number): string {
  let letters = '';

  for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26))
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;

  return letters;
}

// CR is escaped too: XML parsers normalize CR LF to LF, and Excel writes _x000D_ itself.
// A literal _xHHHH_ is protected by escaping its underscore; XML 1.0 cannot hold the rest.
const unsafeText = new RegExp(
  '_(?=x[0-9A-Fa-f]{4}_)|[\u0000-\u0008\u000B-\u000D\u000E-\u001F\uFFFE\uFFFF]|' +
    '[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]',
  'g',
);

function escapeText(text: string): string {
  return text
    .replace(
      unsafeText,
      (char) => `_x${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}_`,
    )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const escapeAttribute = (text: string): string => escapeText(text).replace(/"/g, '&quot;');

function assertSheetName(name: string): void {
  if (
    name.length < 1 ||
    name.length > 31 ||
    !name.trim() ||
    name.toLowerCase() === 'history' ||
    /[[\]:*?/\\\u0000-\u001F]/.test(name) ||
    /^'|'$/.test(name)
  )
    throw new FunctionError(
      'INVALID_SHEET_NAME',
      'The sheet name must be 1 to 31 characters, without [ ] : * ? / \\ and without a leading or trailing apostrophe.',
    );
}

const fonts =
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>';

// Style index: 0-2 plain, general/date/datetime; 3-5 the same in bold for the header row.
const styles = `${declaration}<styleSheet xmlns="${main}"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts>${fonts}<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6">${[
  0, 1, 2, 3, 4, 5,
]
  .map((style) => {
    const numFmt = [0, 164, 165][style % 3];
    const bold = style > 2 ? ' fontId="1" applyFont="1"' : ' fontId="0"';

    return `<xf numFmtId="${numFmt}"${bold} fillId="0" borderId="0" xfId="0"${numFmt ? ' applyNumberFormat="1"' : ''}/>`;
  })
  .join(
    '',
  )}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const dateStyles = { date: 1, datetime: 2 };

function sheetXml(rows: XlsxCellIn[][], headerRow: boolean) {
  const types: XlsxWriteTypes = { boolean: 0, date: 0, number: 0, text: 0 };
  const strings = new Map<string, number>();
  const lines = rows.map((row, rowIndex) => {
    const cells: string[] = [];

    row.forEach((cell, columnIndex) => {
      const ref = `${columnLetters(columnIndex)}${rowIndex + 1}`;
      const bold = headerRow && rowIndex === 0 ? 3 : 0;

      if (cell === null || cell === '') return;

      if (typeof cell === 'string') {
        if (cell.length > limits.cell)
          throw new FunctionError(
            'XLSX_LIMIT',
            `Cell ${ref} is longer than ${limits.cell.toLocaleString('en-US')} characters.`,
          );

        types.text += 1;
        strings.set(cell, strings.get(cell) ?? strings.size);
        cells.push(`<c r="${ref}"${bold ? ' s="3"' : ''} t="s"><v>${strings.get(cell)}</v></c>`);
      } else if (typeof cell === 'boolean') {
        types.boolean += 1;
        cells.push(`<c r="${ref}"${bold ? ' s="3"' : ''} t="b"><v>${cell ? 1 : 0}</v></c>`);
      } else {
        const date = typeof cell === 'object';

        types[date ? 'date' : 'number'] += 1;

        const style = bold + (date ? dateStyles[cell.format] : 0);

        cells.push(
          `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${date ? cell.serial : cell}</v></c>`,
        );
      }
    });

    return cells.length ? `<row r="${rowIndex + 1}">${cells.join('')}</row>` : '';
  });

  return { lines, strings, types };
}

export function writeXlsx(
  rows: XlsxCellIn[][],
  options: { headerRow: boolean; sheetName: string },
): { bytes: Uint8Array; columns: number; types: XlsxWriteTypes } {
  assertSheetName(options.sheetName);

  if (rows.length === 0) throw new FunctionError('XLSX_EMPTY', 'There is no data to write.');
  if (rows.length > limits.rows)
    throw new FunctionError(
      'XLSX_LIMIT',
      `A sheet is limited to ${limits.rows.toLocaleString('en-US')} rows; row ${(limits.rows + 1).toLocaleString('en-US')} starts at A${limits.rows + 1}.`,
    );

  let columns = 1;

  for (const [index, row] of rows.entries()) {
    if (row.length > limits.columns)
      throw new FunctionError(
        'XLSX_LIMIT',
        `A sheet is limited to ${limits.columns.toLocaleString('en-US')} columns; cell ${columnLetters(limits.columns)}${index + 1} is beyond the last one.`,
      );

    columns = Math.max(columns, row.length);
  }

  const { lines, strings, types } = sheetXml(rows, options.headerRow);
  const dimension = `A1:${columnLetters(columns - 1)}${rows.length}`;
  const pane = options.headerRow
    ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>'
    : '';
  const list = [...strings.keys()];
  const parts: Record<string, string> = {
    '[Content_Types].xml': `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    '_rels/.rels': `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="${docRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/_rels/workbook.xml.rels': `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="${docRel}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${docRel}/styles" Target="styles.xml"/><Relationship Id="rId3" Type="${docRel}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `${declaration}<sst xmlns="${main}" count="${types.text}" uniqueCount="${list.length}">${list
      .map(
        (text) =>
          `<si><t${/^\s|\s$/.test(text) ? ' xml:space="preserve"' : ''}>${escapeText(text)}</t></si>`,
      )
      .join('')}</sst>`,
    'xl/styles.xml': styles,
    'xl/workbook.xml': `${declaration}<workbook xmlns="${main}" xmlns:r="${docRel}"><sheets><sheet name="${escapeAttribute(options.sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/worksheets/sheet1.xml': `${declaration}<worksheet xmlns="${main}"><dimension ref="${dimension}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${lines.join('')}</sheetData></worksheet>`,
  };

  return {
    columns,
    bytes: zipSync(
      Object.fromEntries(Object.entries(parts).map(([name, xml]) => [name, strToU8(xml)])),
      {
        mtime: new Date(1980, 0, 1),
      },
    ),
    types,
  };
}
