import { strToU8, zipSync } from 'fflate';

const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relationships = 'http://schemas.openxmlformats.org/package/2006/relationships';
const officeRelationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function withPrefix(xml: string, prefix: string): string {
  return xml
    .replace(/<(\/?)([A-Za-z][\w]*)(?=[\s/>])/g, `<$1${prefix}:$2`)
    .replace(/ xmlns="/, ` xmlns:${prefix}="`);
}

const sharedStrings = [
  '<si><t>Name</t></si>',
  '<si><r><rPr><b/></rPr><t xml:space="preserve">Rich </t></r><r><t>text</t></r><rPh sb="0" eb="1"><t>ignored</t></rPh><phoneticPr fontId="1"/></si>',
  '<si><t>p_x000D_q</t></si>',
  '<si><t>_x005F_x0041_</t></si>',
].join('');

export const styles = `<styleSheet xmlns="${main}"><numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="&quot;day&quot; 0.00"/><numFmt numFmtId="166" formatCode="[Red]0.00"/></numFmts><cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="166"/></cellXfs></styleSheet>`;

const firstSheetRows = [
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>',
  '<row r="2"><c r="A2" t="inlineStr"><is><t>inline</t></is></c><c r="B2"><f>1+1</f><v>2</v></c><c r="C2" t="str"><f>A2&amp;"!"</f><v>inline!</v></c></row>',
  '<row r="3"><c r="A3" t="b"><v>1</v></c><c r="B3" t="b"><v>0</v></c><c r="C3" t="e"><v>#N/A</v></c></row>',
  '<row r="4"><c r="A4" s="1"><v>45958</v></c><c r="B4" s="2"><v>45958.5</v></c><c r="C4"><v>1.5</v></c><c r="D4" s="3"><v>45958</v></c><c r="E4" s="4"><v>2</v></c></row>',
  '<row><c t="inlineStr"><is><t>a_x000D_b</t></is></c><c t="inlineStr"><is><t>_x005F_x0041_</t></is></c><c><f>X</f></c></row>',
].join('');

export const firstSheetExpected = [
  ['Name', null, 'Rich text', null, null],
  ['inline', 2, 'inline!', null, null],
  [true, false, '#N/A', null, null],
  ['2025-10-28', '2025-10-28T12:00:00', 1.5, 45958, 2],
  ['a\rb', '_x0041_', null, null, null],
];

function worksheet(rows: string): string {
  return `${declaration}<worksheet xmlns="${main}"><sheetData>${rows}</sheetData></worksheet>`;
}

export type XlsxOptions = {
  date1904?: boolean;
  firstRows?: string;
  noSharedStrings?: boolean;
  prefix?: string;
  sharedStringsPath?: string;
};

export function buildXlsx(options: XlsxOptions = {}): Uint8Array {
  const { date1904 = false, firstRows = firstSheetRows, prefix } = options;
  const sstPath = options.sharedStringsPath ?? 'xl/sharedStrings.xml';
  const workbook = `${declaration}<workbook xmlns="${main}" xmlns:r="${officeRelationships}"><workbookPr${date1904 ? ' date1904="1"' : ''}/><sheets><sheet name="First" sheetId="1" r:id="rId1"/><sheet name="Second" sheetId="2" r:id="rId2"/><sheet name="Chart" sheetId="3" r:id="rId3"/></sheets></workbook>`;
  const type = (name: string) => `${officeRelationships}/${name}`;
  const rels = `${declaration}<Relationships xmlns="${relationships}"><Relationship Id="rId1" Type="${type('worksheet')}" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${type('worksheet')}" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${type('chartsheet')}" Target="chartsheets/sheet1.xml"/><Relationship Id="rId4" Type="${type('styles')}" Target="styles.xml"/><Relationship Id="rId5" Type="${type('sharedStrings')}" Target="${sstPath.replace(/^xl\//, '')}"/></Relationships>`;
  const parts: Record<string, string> = {
    'xl/_rels/workbook.xml.rels': rels,
    [sstPath]: `${declaration}<sst xmlns="${main}" count="4" uniqueCount="4">${sharedStrings}</sst>`,
    'xl/styles.xml': `${declaration}${styles}`,
    'xl/workbook.xml': workbook,
    'xl/worksheets/sheet1.xml': worksheet(firstRows),
    'xl/worksheets/sheet2.xml': worksheet(
      '<row r="1"><c r="A1" t="inlineStr"><is><t>second</t></is></c></row>',
    ),
  };

  if (options.noSharedStrings) delete parts[sstPath];

  return zipSync(
    Object.fromEntries(
      Object.entries(parts).map(([name, xml]) => [
        name,
        strToU8(prefix ? withPrefix(xml, prefix) : xml),
      ]),
    ),
  );
}

export const legacyXls = new Uint8Array([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0,
]);

export const odsZip: Uint8Array = zipSync({
  mimetype: [strToU8('application/vnd.oasis.opendocument.spreadsheet'), { level: 0 }],
});
