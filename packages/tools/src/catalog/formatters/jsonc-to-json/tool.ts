import { ToolDefinition, ToolError } from '@devtoolora/core';
import { jsoncToJson } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const jsoncToJsonTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Convert JSONC or JSON5 to strict JSON locally. Comments and trailing commas are removed, and big numbers stay exact.',
  fields: [
    {
      defaultValue: 'jsonc',
      id: 'dialect',
      label: 'Input',
      options: [
        { label: 'JSONC', value: 'jsonc' },
        { label: 'JSON5', value: 'json5' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '2',
      id: 'indentation',
      label: 'Indentation',
      options: [
        { label: '2 spaces', value: '2' },
        { label: '4 spaces', value: '4' },
        { label: 'Tabs', value: 'tab' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'jsonc-to-json',
  inputKind: 'text',
  keywords: [
    'jsonc',
    'json5',
    'json',
    'comments',
    'trailing commas',
    'tsconfig',
    'convert',
    'strip',
  ],
  name: 'JSONC to JSON',
  outputKind: 'text',
  relatedToolIds: ['json-format', 'json-canonicalize'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const dialect = fields.dialect ?? 'jsonc';
      const indentation = fields.indentation ?? '2';

      if (dialect !== 'jsonc' && dialect !== 'json5') throw new ToolError('Choose JSONC or JSON5.');
      if (indentation !== '2' && indentation !== '4' && indentation !== 'tab')
        throw new ToolError('Choose 2 spaces, 4 spaces or tabs.');

      const result = jsoncToJson(text, {
        dialect,
        indent: indentation === 'tab' ? 'tab' : (Number(indentation) as 2 | 4),
      });
      const duplicates = result.duplicateKeys
        ? ` · ${result.duplicateKeys} ${result.duplicateKeys === 1 ? 'duplicate key' : 'duplicate keys'}`
        : '';

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: 'converted.json',
          mimeType: 'application/json;charset=utf-8',
        },
        language: 'json',
        summary: `Converted to JSON · ${result.comments} ${result.comments === 1 ? 'comment' : 'comments'} removed${duplicates}.`,
        text: result.text,
      };
    }),
  samples: [
    {
      fields: { dialect: 'jsonc' },
      label: 'tsconfig with comments',
      text: '{\n  // Compiler settings\n  "compilerOptions": {\n    "strict": true, /* keep on */\n    "target": "ES2022",\n  },\n}\n',
    },
    {
      fields: { dialect: 'jsonc' },
      label: 'VS Code settings',
      text: '{\n  "editor.tabSize": 2, // spaces\n  "files.exclude": {\n    "**/node_modules": true,\n  },\n}\n',
    },
    {
      fields: { dialect: 'jsonc' },
      label: 'Comment markers in strings',
      text: '{\n  "url": "https://example.com/a,b", // real comment\n  "glob": "src/**/*.ts"\n}\n',
    },
    {
      fields: { dialect: 'json5' },
      label: 'JSON5 config',
      text: "{\n  name: 'demo',\n  port: 0x1F90,\n  ratio: .75,\n  offset: +3,\n  tags: ['a', 'b',],\n}\n",
    },
    {
      fields: { dialect: 'json5' },
      label: 'JSON5 strings',
      text: "{\n  quote: 'She said \"hi\"',\n  letter: '\\x41',\n  long: 'first \\\nsecond',\n}\n",
    },
    {
      fields: { dialect: 'json5' },
      label: 'Big integer',
      text: '{\n  // stays exact\n  id: 12345678901234567890123,\n}\n',
    },
  ],
  supportsSelection: true,
};

export const json5ToJsonTool: ToolDefinition = {
  ...jsoncToJsonTool,
  aliasOf: 'jsonc-to-json',
  fields: jsoncToJsonTool.fields?.map((field) =>
    field.id === 'dialect' ? { ...field, defaultValue: 'json5' } : field,
  ),
  id: 'json5-to-json',
  name: 'JSON5 to JSON',
  run: (input) => jsoncToJsonTool.run({ ...input, fields: { dialect: 'json5', ...input.fields } }),
};
