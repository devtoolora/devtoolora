import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { isoKinds, lookupIsoCodes, type IsoKind } from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];
const columns = ['Kind', 'Alpha-2', 'Alpha-3', 'Numeric', 'Name', 'Detail'];
const plurals = { country: 'countries', currency: 'currencies', language: 'languages' } as const;

function isKind(value: string): value is IsoKind {
  return (isoKinds as readonly string[]).includes(value);
}

function summarize(kinds: string[]): string {
  return (Object.keys(plurals) as Array<keyof typeof plurals>)
    .map((kind) => [kind, kinds.filter((item) => item === kind).length] as const)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${count === 1 ? kind : plurals[kind]}`)
    .join(' · ');
}

function run(fields: Record<string, string>, text: string): ToolResult {
  const kind = fields.kind ?? 'all';
  const found = lookupIsoCodes(text, isKind(kind) ? kind : 'all');
  const rows = found.map((row) => [
    row.kind,
    row.alpha2,
    row.alpha3,
    row.numeric,
    row.name,
    row.detail,
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

  return {
    artifact: {
      base64: encodeBase64Text(aligned),
      fileName: 'iso-codes.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    jsonTable: { columns, presentation: 'plain', rows },
    summary: summarize(found.map((row) => row.kind)),
    text: aligned,
  };
}

export const isoCodesTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Data',
  description:
    'Look up ISO 3166 country, ISO 4217 currency and ISO 639 language codes by code or by English name.',
  fields: [
    {
      defaultValue: 'all',
      id: 'kind',
      label: 'Kind',
      options: [
        { label: 'All', value: 'all' },
        { label: 'Country', value: 'country' },
        { label: 'Currency', value: 'currency' },
        { label: 'Language', value: 'language' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'iso-codes',
  inputKind: 'optionalText',
  inputPresentation: {
    label: 'Code or name',
    placeholder: 'A code or name, for example CZ, 978 or czech. Leave empty to list a whole kind.',
  },
  keywords: [
    'iso',
    'country',
    'currency',
    'language',
    'alpha-2',
    'iso 3166',
    'iso 4217',
    'iso 639',
  ],
  name: 'Country, Currency & Language Codes',
  outputKind: 'json',
  relatedToolIds: ['vat-validator', 'phone-formatter', 'number-formatter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => run(fields, text)),
  samples: [
    { fields: { kind: 'all' }, label: 'Country code', text: 'CZ' },
    { fields: { kind: 'all' }, label: 'Name search', text: 'czech' },
    { fields: { kind: 'all' }, label: 'Numeric code', text: '978' },
    { fields: { kind: 'currency' }, label: 'All currencies', text: '' },
    { fields: { kind: 'all' }, label: 'Language code', text: 'cs' },
    { fields: { kind: 'all' }, label: 'Partial name', text: 'united' },
  ],
  supportsSelection: true,
};
