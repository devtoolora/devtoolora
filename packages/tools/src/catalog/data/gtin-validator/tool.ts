import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { gtinKindLabel, gtinKinds, validateGtins } from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];
const columns = ['Input', 'Type', 'Valid', 'Check digit', 'Conversions'];

function run(fields: Record<string, string>, text: string): ToolResult {
  if (!text.trim()) throw new ToolError('Paste one ISBN, EAN, UPC or GTIN per line.');

  const kind = gtinKinds.find((item) => item === (fields.kind || 'auto'));

  if (!kind) throw new ToolError('Choose a code type.');

  const checks = validateGtins(text, kind);
  const rows = checks.map((check) => [
    check.input,
    check.type,
    check.valid ? 'yes' : 'no',
    check.checkDigit,
    check.conversions.join('; '),
  ]);
  const widths = columns.map((column, index) =>
    Math.max(column.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const aligned = [columns, ...rows]
    .map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index] ?? 0))
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
  const valid = checks.filter((check) => check.valid).length;

  return {
    artifact: {
      base64: encodeBase64Text(aligned),
      fileName: 'gtin-check.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    jsonTable: { columns, presentation: 'plain', rows },
    summary: `${checks.length} ${checks.length === 1 ? 'code' : 'codes'} · ${valid} valid · ${checks.length - valid} invalid`,
    text: aligned,
  };
}

export const gtinValidatorTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Data',
  description:
    'Validate ISBN-10, ISBN-13, EAN-13, EAN-8, UPC-A, GTIN-14 and ISSN check digits, detect the code type and convert between formats.',
  fields: [
    {
      defaultValue: 'auto',
      id: 'kind',
      label: 'Code type',
      options: gtinKinds.map((kind) => ({ label: gtinKindLabel(kind), value: kind })),
      type: 'select',
    },
  ],
  id: 'gtin-validator',
  inputKind: 'text',
  inputPresentation: {
    label: 'Codes',
    placeholder: 'One ISBN, EAN, UPC, GTIN or ISSN per line',
  },
  keywords: ['isbn', 'ean', 'upc', 'gtin', 'barcode', 'issn', 'check digit'],
  name: 'ISBN / EAN / UPC / GTIN Validator',
  outputKind: 'json',
  relatedToolIds: ['iban-validator', 'checksum', 'qr-code-generator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => run(fields, text)),
  runRequires: [{ anyOf: ['$text'] }],
  samples: [
    {
      fields: { kind: 'auto' },
      label: 'EAN-13 valid and invalid',
      text: '4006381333931\n4006381333932',
    },
    { fields: { kind: 'auto' }, label: 'UPC-A', text: '036000291452' },
    { fields: { kind: 'auto' }, label: 'EAN-8', text: '73513537' },
    { fields: { kind: 'auto' }, label: 'ISBN-10 to ISBN-13', text: '0-306-40615-2' },
    { fields: { kind: 'auto' }, label: 'ISSN', text: '0378-5955' },
    { fields: { kind: 'auto' }, label: 'GTIN-14', text: '12345678901231' },
  ],
  supportsSelection: true,
};
