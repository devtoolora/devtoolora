import { ToolDefinition, ToolError } from '@devtoolora/core';
import {
  convertDotenv,
  dotenvConversions,
  type DotenvConversion,
} from '@devtoolora/functions/config';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities, configResult } from '../shared';

const modeInfo: Record<DotenvConversion, { fileName: string; label: string; language: string }> = {
  'env-to-json': { fileName: '.env.json', label: '.env → JSON', language: 'json' },
  'env-to-yaml': { fileName: '.env.yaml', label: '.env → YAML', language: 'yaml' },
  example: { fileName: '.env.example', label: '.env.example', language: 'plaintext' },
  'json-to-env': { fileName: '.env', label: 'JSON → .env', language: 'plaintext' },
  'yaml-to-env': { fileName: '.env', label: 'YAML → .env', language: 'plaintext' },
};

const envSample =
  'PORT=3000\nexport DEBUG=false\nMSG="hello world" # greet\n\n# db\nDB_URL=postgres://u:p@h/db\n';

export const dotenvConverterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Config & Secrets',
  description:
    'Convert a .env file to JSON or YAML, turn a flat JSON or YAML mapping into .env, or blank every value for a .env.example.',
  fields: [
    {
      defaultValue: 'env-to-json',
      id: 'mode',
      label: 'Conversion',
      options: dotenvConversions.map((value) => ({ label: modeInfo[value].label, value })),
      type: 'select',
    },
    {
      defaultValue: '',
      id: 'placeholder',
      label: 'Placeholder value',
      type: 'text',
      visibleWhen: { field: 'mode', is: ['example'] },
    },
    {
      defaultValue: 'true',
      id: 'keepComments',
      label: 'Keep comments',
      type: 'checkbox',
      visibleWhen: { field: 'mode', is: ['example'] },
    },
  ],
  freshResults: true,
  id: 'dotenv-converter',
  inputKind: 'text',
  inputPresentation: {
    byMode: {
      'json-to-env': { label: 'JSON object' },
      'yaml-to-env': { label: 'YAML mapping' },
    },
    label: '.env file',
  },
  keywords: ['dotenv', 'env', 'json', 'yaml', 'env.example', 'convert', 'environment variables'],
  name: '.env ↔ JSON / YAML Converter',
  outputKind: 'text',
  relatedToolIds: ['dotenv-formatter', 'dotenv-validator', 'json-to-yaml', 'json-flatten'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => runConverter(text, fields)),
  samples: [
    { fields: { mode: 'env-to-json' }, label: '.env to JSON', text: envSample },
    { fields: { mode: 'env-to-yaml' }, label: '.env to YAML', text: envSample },
    {
      fields: { mode: 'json-to-env' },
      label: 'JSON to .env',
      text: '{"PORT":3000,"MSG":"hello world","EMPTY":null,"FLAG":true}',
    },
    {
      fields: { mode: 'yaml-to-env' },
      label: 'YAML to .env',
      text: 'PORT: 3000\nNAME: app\nGREETING: hello world\n',
    },
    { fields: { mode: 'example' }, label: '.env.example with comments', text: envSample },
    {
      fields: { keepComments: 'false', mode: 'example', placeholder: '<value>' },
      label: '.env.example with placeholder',
      text: envSample,
    },
  ],
  sensitiveInput: true,
  supportsSelection: true,
};

export const dotenvExampleTool: ToolDefinition = {
  ...dotenvConverterTool,
  aliasOf: 'dotenv-converter',
  description:
    'Blank every value of a .env file to produce a .env.example, keeping keys and comments.',
  fields: dotenvConverterTool.fields?.map((field) =>
    field.id === 'mode' ? { ...field, defaultValue: 'example' } : field,
  ),
  id: 'dotenv-example',
  name: '.env.example Generator',
  samples: [
    { fields: { mode: 'example' }, label: '.env.example with comments', text: envSample },
    {
      fields: { keepComments: 'false', mode: 'example' },
      label: '.env.example without comments',
      text: envSample,
    },
    {
      fields: { mode: 'example', placeholder: '<value>' },
      label: '.env.example with placeholder',
      text: envSample,
    },
    {
      fields: { mode: 'example', placeholder: 'changeme' },
      label: 'Changeme placeholder',
      text: 'API_KEY=sk-live-123\nexport DB_PASSWORD="s3cret value"\n',
    },
    {
      fields: { mode: 'example' },
      label: 'Only comments and blanks',
      text: '# Nothing here yet\n\nEMPTY=\n',
    },
    {
      fields: { mode: 'example' },
      label: 'Hash touching a value is dropped',
      text: 'DB_PASSWORD=abc#def\nPORT=3000 # development\n',
    },
  ],
};

function runConverter(text: string, fields: Record<string, string>) {
  const mode = dotenvConversions.find((value) => value === (fields.mode || 'env-to-json'));

  if (!mode) throw new ToolError('Choose a conversion from the list.');

  const {
    text: output,
    variables,
    warning,
  } = convertDotenv(text, mode, {
    keepComments: fields.keepComments !== 'false',
    placeholder: fields.placeholder ?? '',
  });
  const info = modeInfo[mode];

  return configResult(
    output,
    info.fileName,
    withWarning(
      `${variables} ${variables === 1 ? 'variable' : 'variables'} · ${info.label}`,
      warning,
    ),
    info.language,
  );
}
