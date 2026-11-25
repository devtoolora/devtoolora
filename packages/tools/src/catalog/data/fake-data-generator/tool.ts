import { ToolError, type ToolDefinition } from '@devtoolora/core';
import {
  generateFakeDataset,
  renderFakeDataset,
  type FakeDataFormat,
} from '@devtoolora/functions/data';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';

const mimeTypes: Record<FakeDataFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  ndjson: 'application/x-ndjson',
};

export const fakeDataGeneratorTool: ToolDefinition = {
  samples: [
    {
      fields: { count: '10', format: 'json', seed: '42', view: 'code' },
      label: 'Users with roles',
      text: 'id: sequence\nname: name\nemail: email\nage: integer(18,90)\nactive: boolean(0.8)\nrole: enum(admin,editor,viewer)\njoined: date(2024-01-01,2026-06-30)',
    },
    {
      fields: { count: '20', format: 'csv', seed: '7', view: 'code' },
      label: 'Orders as CSV',
      text: 'orderId: uuid\ncustomer: name\ncompany: company\ntotal: float(5,500,2)\nstatus: enum(paid,pending,refunded)\ncreatedAt: datetime(2026-01-01,2026-03-31)',
    },
    {
      fields: { count: '25', format: 'json', seed: '2026', view: 'table' },
      label: 'Contacts with nulls (table)',
      text: '# Contacts for an address book demo\nid: sequence(1001)\nfirstName: firstName\nlastName: lastName\nphone: phone?\ncity: city\ncountry: country\ncountryCode: countryCode\nnickname: firstName?',
    },
    {
      fields: { count: '15', format: 'ndjson', seed: '99', view: 'code' },
      label: 'Event stream as JSON Lines',
      text: 'eventId: uuid\ntype: enum(click|view|purchase)\nuser: username\nip: ipv4\nat: datetime\nnote: sentence?',
    },
    {
      fields: { count: '5', format: 'json', seed: '42', view: 'code' },
      label: 'Built-in users (seed 42)',
      text: '',
    },
    {
      fields: { count: '5', format: 'csv', seed: '42', view: 'code' },
      label: 'Built-in users as CSV',
      text: '',
    },
  ],
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Data',
  description:
    'Generate repeatable fake records from a field list, with realistic names, emails, places, numbers and dates, as JSON, JSON Lines or CSV.',
  fields: [
    {
      defaultValue: '42',
      help: 'Unsigned integer: 0–4294967295. The same seed gives the same records.',
      id: 'seed',
      label: 'Seed',
      type: 'number',
    },
    {
      defaultValue: '10',
      help: 'Integer: 1–1000 records.',
      id: 'count',
      label: 'Count',
      type: 'number',
    },
    {
      defaultValue: 'json',
      id: 'format',
      label: 'Output',
      options: [
        { label: 'JSON', value: 'json' },
        { label: 'JSON Lines', value: 'ndjson' },
        { label: 'CSV', value: 'csv' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'code',
      help: 'Table shows every record as rows; copy and save still use the chosen output.',
      id: 'view',
      label: 'Preview',
      options: [
        { label: 'Code', value: 'code' },
        { label: 'Table', value: 'table' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'fake-data-generator',
  inputKind: 'optionalText',
  keywords: [
    'fake data',
    'seeded fake data',
    'mock data',
    'faker',
    'fixtures',
    'test data',
    'seed',
    'sample data',
    'dummy data',
    'csv',
    'json lines',
  ],
  name: 'Fake Data Generator',
  outputKind: 'json',
  relatedToolIds: [
    'json-to-typescript',
    'json-to-zod',
    'json-to-csv',
    'json-table',
    'csv-profiler',
  ],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const seed = integerField(fields.seed, 'Seed', 42, 0, 0xffffffff);
      const count = integerField(fields.count, 'Count', 10, 1, 1000);
      const format = fields.format || 'json';

      if (format !== 'json' && format !== 'ndjson' && format !== 'csv')
        throw new ToolError('Choose JSON, JSON Lines or CSV output.');

      const view = fields.view || 'code';

      if (view !== 'code' && view !== 'table')
        throw new ToolError('Choose a code or table preview.');

      const dataset = generateFakeDataset(text, seed, count);
      const output = renderFakeDataset(dataset, format);
      const baseName = dataset.defaultUsers ? 'seeded-users' : 'fake-data';

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: `${baseName}.${format}`,
          mimeType: `${mimeTypes[format]};charset=utf-8`,
        },
        jsonTable:
          view === 'table'
            ? {
                columns: dataset.columns,
                rows: dataset.records.map((record) =>
                  dataset.columns.map((column) => JSON.stringify(record[column])),
                ),
              }
            : undefined,
        language: format === 'json' ? 'json' : 'plaintext',
        summary: dataset.defaultUsers
          ? `${count} synthetic users · seed ${seed} · unique IDs and emails within this batch.`
          : `${count} ${count === 1 ? 'record' : 'records'} · ${dataset.fields.length} ${dataset.fields.length === 1 ? 'field' : 'fields'} · seed ${seed}.`,
        text: output,
      };
    }),
  supportsSelection: false,
};

export const seededFakeDataTool: ToolDefinition = {
  ...fakeDataGeneratorTool,
  aliasOf: 'fake-data-generator',
  id: 'seeded-fake-data',
  name: 'Seeded Fake Data',
};

function integerField(
  value: string | undefined,
  label: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;

  const input = value.trim();

  if (!/^\d{1,10}$/.test(input) || Number(input) < min || Number(input) > max) {
    throw new ToolError(`${label} must be an integer from ${min} through ${max}.`);
  }

  return Number(input);
}
