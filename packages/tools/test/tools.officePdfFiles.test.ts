import { afterEach, beforeEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { readXlsx } from '@devtoolora/functions/office';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { reportPdf, signatureNotes } from '../src/catalog/documentsPdf/shared';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';
import { installFakeImageApis } from './fakeImageApis';

const toolIds = [
  'xlsx-to-csv',
  'csv-to-xlsx',
  'docx-to-text',
  'pdf-text-extractor',
  'pdf-form-filler',
  'pdf-crop-resize',
  'pdf-signature-inspector',
  'sprite-sheet-generator',
];
const aliases = {
  'json-to-xlsx': 'csv-to-xlsx',
  'docx-to-markdown': 'docx-to-text',
  'social-media-image-resizer': 'batch-image-tools',
  'xlsx-to-json': 'xlsx-to-csv',
};

describe('office and PDF file tools', () => {
  let restoreImages = () => {};

  beforeEach(() => {
    restoreImages = installFakeImageApis().restore;
  });

  afterEach(() => restoreImages());

  it('documents every tool and runs each of its six samples', async () => {
    for (const id of toolIds) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.ok((contentOf(tool).documentation?.length ?? 0) >= 2, id);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.ok((contentOf(tool).faq?.length ?? 0) >= 4, id);
      assert.equal(tool.samples?.length, 6, id);
      const fieldIds = new Set(tool.fields?.map((field) => field.id));

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).filter((key) => !fieldIds.has(key)),
          [],
          `${id}: ${sample.label}`,
        );

        const output = await result(id, sample.text ?? '', {
          ...Object.fromEntries(
            (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
          ),
          ...sample.fields,
        });

        assert.ok(output.text.length > 0, `${id}: ${sample.label}`);
        assert.ok((output.summary ?? '').length > 0, `${id}: ${sample.label}`);
      }
    }
  });

  it('keeps the alias map', () => {
    const actual = Object.fromEntries(
      listBrowserWorkerTools()
        .filter((tool) => tool.aliasOf)
        .map((tool) => [tool.id, tool.aliasOf]),
    );

    for (const [id, target] of Object.entries(aliases)) assert.equal(actual[id], target, id);
  });
});

const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function workbook(rows: string, sheetName = 'Data'): string {
  const parts = {
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a" Type="x/worksheet" Target="worksheets/a.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${main}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="a"/></sheets></workbook>`,
    'xl/worksheets/a.xml': `<worksheet xmlns="${main}"><sheetData>${rows}</sheetData></worksheet>`,
  };
  const zip = zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])));

  return `data:application/octet-stream;base64,${Buffer.from(zip).toString('base64')}`;
}

const text = (ref: string, value: string) =>
  `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const sampleTool = () => listBrowserWorkerTools().find((tool) => tool.id === 'xlsx-to-csv');
const sample = () => ({
  file: String(sampleTool()?.samples?.[0]?.fields?.file),
  fileName: 'timesheet.xlsx',
});

describe('xlsx to csv', () => {
  it('writes the sample as csv starting with its header row', async () => {
    const out = await result('xlsx-to-csv', '', { ...sample(), output: 'csv' });

    assert.ok(out.text.startsWith('Name,Team,Joined,Hours,Billable\n'));
    assert.match(out.text, /Ada Lovelace,Platform,2024-03-11,38.5,TRUE\n/);
    assert.equal(out.artifact?.fileName, 'timesheet.csv');
    assert.match(out.summary ?? '', /^Sheet "Timesheet": 6 rows × 5 columns, 4 dates, 1 formula/);
  });

  it('defaults the alias to json and keeps typed values', async () => {
    const out = await result('xlsx-to-json', '', sample());
    const records = JSON.parse(out.text);

    assert.equal(out.artifact?.fileName, 'timesheet.json');

    assert.deepEqual(records[0], {
      Billable: true,
      Hours: 38.5,
      Joined: '2024-03-11',
      Name: 'Ada Lovelace',
      Team: 'Platform',
    });

    assert.equal(records[4].Hours, 146.75);
  });

  it('writes every sheet as csv sections with one artifact per sheet', async () => {
    const out = await result('xlsx-to-csv', '', { ...sample(), allSheets: 'true', output: 'csv' });

    assert.ok(out.text.startsWith('# Timesheet\nName,Team'));
    assert.match(out.text, /\n# Notes\nTopic,Detail\n/);

    assert.deepEqual(
      out.artifacts?.map((artifact) => artifact.fileName),
      ['timesheet-Timesheet.csv', 'timesheet-Notes.csv'],
    );
  });

  it('writes every sheet as one json object', async () => {
    const out = await result('xlsx-to-csv', '', { ...sample(), allSheets: 'true', output: 'json' });

    assert.deepEqual(Object.keys(JSON.parse(out.text)), ['Timesheet', 'Notes']);
    assert.equal(out.artifact?.fileName, 'timesheet.json');
  });

  it('names blank and duplicate headers in json records', async () => {
    const file = workbook(
      `<row r="1">${text('A1', 'id')}${text('C1', 'id')}</row><row r="2"><c r="A2"><v>1</v></c><c r="C2"><v>2</v></c></row>`,
    );
    const records = JSON.parse(
      (await result('xlsx-to-csv', '', { file, fileName: 'x.xlsx', output: 'json' })).text,
    );

    assert.deepEqual(records, [{ 'Column 2': null, id: 1, id_2: 2 }]);

    const rows = JSON.parse(
      (await result('xlsx-to-csv', '', { file, jsonShape: 'rows', output: 'json' })).text,
    );

    assert.deepEqual(rows, [
      ['id', null, 'id'],
      [1, null, 2],
    ]);
  });

  it('names downloads after the upload, keeping spaces', async () => {
    const out = await result('xlsx-to-csv', '', { ...sample(), fileName: 'Q3 Hours.xlsx' });

    assert.equal(out.artifact?.fileName, 'Q3 Hours.csv');
  });

  it('adds the sheet name only for a picked sheet or several sheets', async () => {
    const file = workbook(`<row r="1">${text('A1', 'id')}</row>`);
    const run = (extra: Record<string, string>) =>
      result('xlsx-to-csv', '', { file, fileName: 'one.xlsx', ...extra });

    assert.equal((await run({})).artifact?.fileName, 'one.csv');
    assert.equal((await run({ sheet: 'Data' })).artifact?.fileName, 'one-Data.csv');
    assert.equal((await run({ allSheets: 'true' })).artifact?.fileName, 'one.csv');
    assert.equal((await run({ allSheets: 'true', output: 'json' })).artifact?.fileName, 'one.json');

    const unsafe = workbook(`<row r="1">${text('A1', 'id')}</row>`, 'a/b\\c:d');

    assert.equal(
      (await result('xlsx-to-csv', '', { file: unsafe, fileName: 'one.xlsx', sheet: '1' })).artifact
        ?.fileName,
      'one-a_b_c_d.csv',
    );

    assert.equal(
      (await result('xlsx-to-csv', '', { ...sample(), sheet: 'Notes' })).artifact?.fileName,
      'timesheet-Notes.csv',
    );
  });

  it('gives a header-only sheet an empty record list and reports bad input', async () => {
    const file = workbook(`<row r="1">${text('A1', 'id')}</row>`);

    assert.equal((await result('xlsx-to-csv', '', { file, output: 'json' })).text, '[]');
    await assert.rejects(result('xlsx-to-csv', '', { ...sample(), sheet: 'Nope' }), /not found/);
    await assert.rejects(result('xlsx-to-csv', '', { ...sample(), output: 'xml' }), /csv or json/);
    await assert.rejects(result('xlsx-to-csv', ''), /Workbook is required/);
  });
});

const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const readArtifact = (base64: string | undefined) =>
  readXlsx(new Uint8Array(Buffer.from(base64 ?? '', 'base64')), { allSheets: false, sheet: '' });

describe('csv to xlsx', () => {
  it('writes a typed workbook that xlsx-to-csv reads back', async () => {
    const out = await result('csv-to-xlsx', 'id,when,ok,zip\n1,2026-10-28T10:00,TRUE,007', {
      sheetName: 'Orders',
    });
    const [sheet] = readArtifact(out.artifact?.base64).sheets;

    assert.equal(out.artifact?.mimeType, xlsxMime);
    assert.equal(out.artifact?.fileName, 'Orders.xlsx');

    assert.deepEqual(JSON.parse(out.text), {
      columns: 4,
      rows: 2,
      sheet: 'Orders',
      types: { boolean: 1, date: 1, number: 1, text: 5 },
    });

    assert.deepEqual(sheet?.rows, [
      ['id', 'when', 'ok', 'zip'],
      [1, '2026-10-28T10:00:00', true, '007'],
    ]);
  });

  it('defaults the alias to json and reports bad input', async () => {
    const out = await result('json-to-xlsx', '[{"a":1},{"a":2}]');

    assert.equal(JSON.parse(out.text).rows, 3);
    await assert.rejects(result('csv-to-xlsx', '[1]', { inputFormat: 'json' }), /array of/);
    await assert.rejects(result('csv-to-xlsx', 'a', { sheetName: 'a/b' }), /sheet name/);
    await assert.rejects(result('csv-to-xlsx', '', {}), /no data/);
  });
});

describe('docx to text', () => {
  const sampleDocx = () => ({
    file: String(
      listBrowserWorkerTools().find((tool) => tool.id === 'docx-to-text')?.samples?.[0]?.fields
        ?.file,
    ),
    fileName: 'Sprint notes.docx',
  });

  it('defaults to text, and the alias defaults to markdown', async () => {
    const text = await result('docx-to-text', '', sampleDocx());
    const markdown = await result('docx-to-markdown', '', sampleDocx());

    assert.ok(text.text.startsWith('Sprint 42 notes\n\nThis sprint shipped three features'));
    assert.equal(text.artifact?.fileName, 'Sprint notes.txt');

    assert.ok(
      markdown.text.startsWith('# Sprint 42 notes\n\nThis sprint shipped **three features**'),
    );

    assert.ok(markdown.text.includes('[the changelog](https://example.com/changelog)'));
    assert.equal(markdown.artifact?.fileName, 'Sprint notes.md');
    assert.equal(markdown.summary, '8 paragraphs, 4 headings, 2 lists, 1 table.');
  });

  it('reports bad input', async () => {
    await assert.rejects(
      result('docx-to-text', '', { ...sampleDocx(), output: 'rtf' }),
      /text or markdown/,
    );

    await assert.rejects(result('docx-to-text', ''), /Document is required/);
  });
});

describe('pdf text extractor', () => {
  it('keeps spaces in the download names', async () => {
    const out = await result('pdf-text-extractor', '', {
      pdfs: reportPdf,
      pdfsName: 'Q3 report.pdf',
    });

    assert.equal(out.artifacts?.[0]?.fileName, 'Q3 report.txt');
  });

  it('extracts the sample text with a txt and a json artifact', async () => {
    const out = await result('pdf-text-extractor', '', {
      pdfs: reportPdf,
      pdfsName: 'quarterly-report.pdf',
    });
    const json = JSON.parse(Buffer.from(out.artifacts?.[1]?.base64 ?? '', 'base64').toString());

    assert.ok(out.text.startsWith('--- Page 1 ---\nQuarterly report\nSummary\n1\n'));

    assert.deepEqual(
      out.artifacts?.map((artifact) => artifact.fileName),
      ['quarterly-report.txt', 'quarterly-report-text.json'],
    );

    assert.deepEqual(json.pages[3], {
      page: 4,
      text: 'Quarterly report\nOutlook\n4\nSample page 4 of 4',
    });

    assert.match(out.summary ?? '', /^\d+ characters from all 4 pages\.$/);
  });

  it('uses singular forms for a single scanned page', async () => {
    const blank = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF',
    ).toString('base64');
    const out = await result('pdf-text-extractor', '', {
      pdfs: `data:application/pdf;base64,${blank}`,
    });

    assert.match(out.summary ?? '', /from all 1 page\./);
    assert.match(out.summary ?? '', /No text layer on 1 of 1 page;/);
  });

  it('reports bad input', async () => {
    await assert.rejects(result('pdf-text-extractor', ''), /PDF file is required/);

    await assert.rejects(
      result('pdf-text-extractor', '', { pages: '99', pdfs: reportPdf }),
      /does not exist/,
    );
  });
});

describe('pdf form filler', () => {
  const formFile = () => ({
    pdfs: String(
      listBrowserWorkerTools().find((tool) => tool.id === 'pdf-form-filler')?.samples?.[0]?.fields
        ?.pdfs,
    ),
  });

  it('lists the fields as an editable values template', async () => {
    const out = await result('pdf-form-filler', '', { ...formFile(), mode: 'list' });

    assert.deepEqual(Object.keys(JSON.parse(out.text)), ['fullName', 'country', 'size']);

    assert.deepEqual(out.jsonTable?.columns, [
      'Name',
      'Type',
      'Value',
      'Options',
      'Required',
      'Read-only',
      'Max length',
    ]);

    assert.equal(out.jsonTable?.rows.length, 3);
    assert.ok(out.jsonTable?.rows.flat().includes('—'));
    assert.ok(!out.jsonTable?.rows.flat().includes(null));

    assert.ok(
      listBrowserWorkerTools()
        .find((t) => t.id === 'pdf-form-filler')
        ?.resultActions?.includes('copy'),
    );

    assert.equal(out.artifact?.fileName, 'document-fields.json');
  });

  it('treats empty fill values as idle and hides JSON.parse jargon', async () => {
    const idle = await result('pdf-form-filler', '', { ...formFile(), mode: 'fill', values: ' ' });

    assert.equal(idle.text, '');
    assert.match(idle.summary ?? '', /Enter the field values/);

    await assert.rejects(
      result('pdf-form-filler', '', { ...formFile(), mode: 'fill', values: '{' }),
      (error: Error) => !/Unexpected|position/.test(error.message),
    );
  });

  it('fills the sample into a -filled.pdf artifact and reports bad values', async () => {
    const values = JSON.stringify({ country: 'CZ', fullName: 'Žluťoučký kůň' });
    const out = await result('pdf-form-filler', '', { ...formFile(), mode: 'fill', values });

    assert.equal(out.artifact?.fileName, 'document-filled.pdf');
    assert.match(out.summary ?? '', /^Filled 2 of 3 fields/);

    for (const [bad, pattern] of [
      ['{', /JSON object/],
      ['[1]', /JSON object/],
      ['{"__proto__":"x"}', /Unknown form field "__proto__"/],
      ['{"fullName":"日本"}', /"fullName" contains "日"/],
    ] as const) {
      await assert.rejects(
        result('pdf-form-filler', '', { ...formFile(), mode: 'fill', values: bad }),
        pattern,
      );
    }
  });

  it('fills the sample with the listed template pasted back unchanged', async () => {
    const listed = await result('pdf-form-filler', '', { ...formFile(), mode: 'list' });
    const out = await result('pdf-form-filler', '', {
      ...formFile(),
      mode: 'fill',
      values: listed.text,
    });

    assert.deepEqual(JSON.parse(listed.text), { country: null, fullName: '', size: null });
    assert.match(out.summary ?? '', /^Filled 1 of 3 fields/);
  });
});

describe('pdf crop and resize', () => {
  const file = { pdfs: reportPdf, pdfsName: 'quarterly-report.pdf' };

  it('converts units to points and reports sizes with millimeters', async () => {
    const out = await result('pdf-crop-resize', '', {
      ...file,
      bottom: '0',
      left: '0',
      right: '0',
      top: '1',
      unit: 'in',
    });
    const mmOut = await result('pdf-crop-resize', '', {
      ...file,
      bottom: '0',
      left: '0',
      right: '0',
      top: '25.4',
      unit: 'mm',
    });
    const [first] = JSON.parse(out.text);

    assert.equal(out.artifact?.fileName, 'quarterly-report-cropped.pdf');
    assert.ok(Math.abs(first.before.height - first.after.height - 72) < 0.02);
    assert.ok(Math.abs(JSON.parse(mmOut.text)[0].after.height - first.after.height) < 0.02);
    assert.equal(typeof first.after.mm.width, 'number');
    assert.match(out.summary ?? '', /^Cropped 4 pages; the MediaBox is unchanged/);
  });

  it('resizes to a named or custom size and reports bad input', async () => {
    const out = await result('pdf-crop-resize', '', {
      ...file,
      mode: 'resize',
      paperSize: 'Letter',
      pages: '1',
    });
    const custom = await result('pdf-crop-resize', '', {
      ...file,
      customHeight: '10',
      customWidth: '7',
      mode: 'resize',
      paperSize: 'custom',
      unit: 'in',
    });

    assert.equal(out.artifact?.fileName, 'quarterly-report-resized.pdf');

    assert.deepEqual(
      JSON.parse(out.text).map((entry: { page: number }) => entry.page),
      [1],
    );

    assert.deepEqual(JSON.parse(custom.text)[0].after.height, 720);
    await assert.rejects(result('pdf-crop-resize', '', { ...file, top: '-1' }), /Top must be/);

    await assert.rejects(
      result('pdf-crop-resize', '', { ...file, left: '400', right: '400' }),
      /Page 1/,
    );

    await assert.rejects(result('pdf-crop-resize', '', { ...file, mode: 'bogus' }), /Choose Crop/);
    await assert.rejects(result('pdf-crop-resize', '', { mode: 'crop' }), /PDF file is required/);
  });
});

describe('pdf signature inspector', () => {
  it('lists the signature and offers the signer certificate as PEM', async () => {
    const sampleFile = listBrowserWorkerTools().find(
      (tool) => tool.id === 'pdf-signature-inspector',
    )?.samples?.[0]?.fields?.pdfs;
    const out = await result('pdf-signature-inspector', '', { pdfs: String(sampleFile) });
    const pem = Buffer.from(out.artifacts?.[0]?.base64 ?? '', 'base64').toString();

    assert.deepEqual(
      out.artifacts?.map((artifact) => artifact.fileName),
      ['document-signature-1.pem', 'document-signatures.json'],
    );

    assert.ok(pem.startsWith('-----BEGIN CERTIFICATE-----'));
    assert.equal(JSON.parse(out.text).signatures[0].field, 'Signature1');
    assert.ok(out.summary?.endsWith('This tool does not check whether the signature is valid.'));
  });
});

describe('signature inspector without signatures', () => {
  it('offers no download for a PDF that is not signed', async () => {
    const out = await result('pdf-signature-inspector', '', {
      pdfs: String(
        listBrowserWorkerTools().find((tool) => tool.id === 'pdf-text-extractor')?.samples?.[0]
          ?.fields?.pdfs,
      ),
    });

    assert.equal(out.artifacts, undefined);
    assert.deepEqual(JSON.parse(out.text).signatures, []);
  });
});

describe('batch image prefix and PDF signature notes', () => {
  it('hides the rename prefix when a size preset names the files', () => {
    const prefix = listBrowserWorkerTools()
      .find((tool) => tool.id === 'batch-image-tools')
      ?.fields?.find((field) => field.id === 'prefix');

    assert.deepEqual(prefix?.visibleWhen, [
      { field: 'mode', is: ['batch'] },
      { field: 'preset', is: ['custom'] },
    ]);
  });

  it('warns only when the file carries a signature byte range', () => {
    assert.deepEqual(signatureNotes(strToU8('<< /ByteRange [0 1 2 3] >>')), [
      'existing digital signatures no longer validate',
    ]);

    assert.deepEqual(signatureNotes(strToU8('%PDF-1.4')), []);
  });
});
