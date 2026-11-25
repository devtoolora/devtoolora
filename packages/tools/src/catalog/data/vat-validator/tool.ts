import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { validateVatNumbers, vatCountries, vatCountryName } from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];
const columns = ['Input', 'Country', 'Format', 'Checksum', 'Result'];

function run(fields: Record<string, string>, text: string): ToolResult {
  if (!text.trim()) throw new ToolError('Paste one VAT number per line.');

  const checks = validateVatNumbers(text, fields.country ?? '');
  const rows = checks.map((check) => [
    check.input,
    check.country,
    check.format ? 'ok' : 'bad',
    check.checksum,
    check.valid ? 'valid' : 'invalid',
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
      fileName: 'vat-check.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    jsonTable: { columns, presentation: 'plain', rows },
    summary: `${checks.length} ${checks.length === 1 ? 'number' : 'numbers'} · ${valid} valid · ${checks.length - valid} invalid`,
    text: aligned,
  };
}

export const vatValidatorTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Data',
  description:
    'Check the format and checksum of European VAT numbers for 31 countries, detecting the country from the prefix or a forced country code.',
  fields: [
    {
      defaultValue: '',
      id: 'country',
      label: 'Country',
      options: [
        { label: 'Auto (prefix)', value: '' },
        ...vatCountries.map((code) => ({
          label: `${code} · ${vatCountryName(code)}`,
          value: code,
        })),
      ],
      searchable: true,
      type: 'select',
    },
  ],
  id: 'vat-validator',
  inputKind: 'text',
  inputPresentation: {
    label: 'VAT numbers',
    placeholder: 'One VAT number per line, for example DE136695976',
  },
  keywords: ['vat', 'tax id', 'eu', 'vies', 'checksum', 'dic', 'uid'],
  name: 'VAT Number Format Validator',
  outputKind: 'json',
  relatedToolIds: ['iban-validator', 'iso-codes', 'number-formatter'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => run(fields, text)),
  runRequires: [{ anyOf: ['$text'] }],
  samples: [
    {
      fields: { country: '' },
      label: 'Valid list',
      text: 'ATU13585627\nDE136695976\nFR40303265045\nNL810433941B01',
    },
    { fields: { country: '' }, label: 'Checksum failure', text: 'DE136695977' },
    { fields: { country: '' }, label: 'Format only (Spain)', text: 'ES B12345678' },
    { fields: { country: 'DE' }, label: 'Forced country', text: '136695976' },
    { fields: { country: '' }, label: 'Swiss number', text: 'CHE-123.456.788 MWST' },
    {
      fields: { country: '' },
      label: 'Mixed separators',
      text: 'de 136.695.976\nPL 526-025-09-95',
    },
  ],
  supportsSelection: true,
};
