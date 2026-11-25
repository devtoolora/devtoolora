import { ToolDefinition, ToolError } from '@devtoolora/core';
import * as devFunctions from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const modes = ['inspect', 'generate'] as const;
const epochs = ['discord', 'twitter', 'custom'] as const;
const kinds = ['nanoid', 'uuid-v7', 'ksuid'] as const;
const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
const inspecting = { field: 'mode', is: ['inspect'] };
const nanoIdOnly = [
  { field: 'mode', is: ['generate'] },
  { field: 'kind', is: ['nanoid'] },
];

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

function customEpoch(value: string | undefined): number {
  const epoch = Number(value);

  if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(epoch))
    throw new ToolError('Custom epoch must be a whole number of milliseconds, 0 or more.');

  return epoch;
}

function inspect(text: string, fields: Record<string, string>) {
  const epoch = choiceField(fields.epoch, 'discord', epochs, 'Choose Discord, Twitter or Custom.');
  const results = devFunctions.inspectIds(text, {
    epoch: epoch === 'custom' ? customEpoch(fields.customEpoch) : epoch,
  });
  const unknown = results.filter(({ kind }) => kind === 'unknown').length;
  const json = JSON.stringify(results, null, 2);

  return {
    artifact: {
      base64: encodeBase64Text(json),
      fileName: 'ids.json',
      mimeType: 'application/json;charset=utf-8',
    },
    language: 'json',
    summary: `${plural(results.length, 'line')} · ${results.length - unknown} recognized · ${unknown} unrecognized.`,
    text: json,
  };
}

function generate(fields: Record<string, string>) {
  const kind = choiceField(fields.kind, 'nanoid', kinds, 'Choose Nano ID, UUID v7 or KSUID.');
  const count = Number(fields.count ?? '5');
  const size = Number(fields.size ?? '21');
  const ids = devFunctions.generateIds({
    alphabet: fields.alphabet ?? urlAlphabet,
    count,
    kind,
    size,
  });
  const text = ids.join('\n');
  const summaries = {
    ksuid: plural(count, 'KSUID'),
    nanoid: `${plural(count, 'Nano ID')} of ${plural(size, 'character')}`,
    'uuid-v7': plural(count, 'UUID v7', 'UUID v7s'),
  };

  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName: 'ids.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    language: 'plaintext',
    summary: `${summaries[kind]}.`,
    text,
  };
}

export const idInspectorTool: ToolDefinition = {
  autoRun: false,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Decode UUID, ULID, KSUID and Snowflake IDs into their timestamps and parts, or generate Nano IDs, UUID v7 and KSUIDs.',
  fields: [
    {
      defaultValue: 'inspect',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Inspect', value: 'inspect' },
        { label: 'Generate', value: 'generate' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'discord',
      id: 'epoch',
      label: 'Snowflake epoch',
      options: [
        { label: 'Discord', value: 'discord' },
        { label: 'Twitter', value: 'twitter' },
        { label: 'Custom', value: 'custom' },
      ],
      type: 'select',
      visibleWhen: inspecting,
    },
    {
      id: 'customEpoch',
      label: 'Custom epoch (ms)',
      placeholder: '1420070400000',
      type: 'number',
      visibleWhen: [inspecting, { field: 'epoch', is: ['custom'] }],
    },
    {
      defaultValue: 'nanoid',
      id: 'kind',
      label: 'Kind',
      options: [
        { label: 'Nano ID', value: 'nanoid' },
        { label: 'UUID v7', value: 'uuid-v7' },
        { label: 'KSUID', value: 'ksuid' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['generate'] },
    },
    {
      defaultValue: '5',
      id: 'count',
      label: 'Count',
      type: 'number',
      visibleWhen: { field: 'mode', is: ['generate'] },
    },
    {
      defaultValue: '21',
      id: 'size',
      label: 'Size',
      type: 'number',
      visibleWhen: nanoIdOnly,
    },
    {
      defaultValue: urlAlphabet,
      id: 'alphabet',
      label: 'Alphabet',
      type: 'text',
      visibleWhen: nanoIdOnly,
    },
  ],
  freshResults: true,
  id: 'id-inspector',
  inputKind: 'optionalText',
  inputVisibleWhen: inspecting,
  keywords: [
    'uuid decoder',
    'uuid version',
    'uuid v7',
    'ulid decoder',
    'ksuid',
    'snowflake',
    'discord id',
    'twitter id',
    'nano id',
    'id generator',
  ],
  name: 'ID Inspector & Generator',
  outputKind: 'text',
  relatedToolIds: ['uuid', 'ulid', 'timestamp-convert'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = choiceField(fields.mode, 'inspect', modes, 'Choose Inspect or Generate.');

      return mode === 'inspect' ? inspect(text, fields) : generate(fields);
    }),
  runRequires: [{ anyOf: ['$text'], when: inspecting }],
  samples: [
    {
      label: 'UUID v7, v1 and nil',
      text: '017F22E2-79B0-7CC3-98C4-DC0C0C07398F\nC232AB00-9414-11EC-B3C8-9F6BDECED846\n00000000-0000-0000-0000-000000000000',
    },
    {
      label: 'ULID and KSUID',
      text: '01ARZ3NDEKTSV4RRFFQ69G5FAV\n0ujtsYcgvSTl8PAuAdqWYSMnLOv',
    },
    { label: 'Discord snowflake', text: '175928847299117063' },
    { fields: { epoch: 'twitter' }, label: 'Twitter snowflake', text: '1212161226626838528' },
    {
      fields: { customEpoch: '1314220021721', epoch: 'custom' },
      label: 'Snowflake with a custom epoch',
      text: '1234567890123456789',
    },
    { label: 'Nano ID is not decodable', text: 'V1StGXR8_Z5jdHi6B-myT' },
    { fields: { count: '5', kind: 'nanoid', mode: 'generate', size: '21' }, label: '5 Nano IDs' },
    {
      fields: {
        alphabet: '0123456789abcdef',
        count: '3',
        kind: 'nanoid',
        mode: 'generate',
        size: '12',
      },
      label: 'Hex Nano IDs',
    },
    { fields: { count: '3', kind: 'uuid-v7', mode: 'generate' }, label: '3 UUID v7' },
    { fields: { count: '3', kind: 'ksuid', mode: 'generate' }, label: '3 KSUIDs' },
  ],
  supportsSelection: false,
};

export const uuidDecoderTool: ToolDefinition = {
  ...idInspectorTool,
  aliasOf: 'id-inspector',
  id: 'uuid-decoder',
  name: 'UUID Decoder',
};
