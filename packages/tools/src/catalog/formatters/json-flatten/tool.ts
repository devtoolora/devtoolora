import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  duplicateKeysWarning,
  flattenJson,
  JsonNumberToken,
  parseExactJson,
  parseFlatPath,
  stringifyExactJson,
  unflattenJson,
  type ExactJsonValue,
  type FlattenOptions,
} from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { withWarning } from '../../../adapters/summary';
import { indentationField } from '../shared';

const modes = ['flatten', 'unflatten'] as const;
const notations: readonly FlattenOptions['notation'][] = ['dot', 'bracket'];
const arrayModes: readonly FlattenOptions['arrays'][] = ['index', 'keep'];

// maxDepth is the deepest key, counted in path segments (`a.b[0]` has 3).
function summarize(record: Record<string, ExactJsonValue>, notation: string): string {
  const keys = Object.keys(record);
  const maxDepth = Math.max(
    0,
    ...keys.map((key) => parseFlatPath(key, notation as FlattenOptions['notation']).length),
  );

  return `${keys.length} keys · ${notation} notation · depth ${maxDepth}`;
}

export const jsonFlattenTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description:
    'Flatten nested JSON into path keys with dot or bracket notation, or rebuild nested JSON from flat keys.',
  fields: [
    {
      defaultValue: 'flatten',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Flatten', value: 'flatten' },
        { label: 'Unflatten', value: 'unflatten' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'dot',
      help: 'Bracket notation writes array indexes as [0] and quotes keys that contain separators.',
      id: 'notation',
      label: 'Notation',
      options: [
        { label: 'Dot (a.b.0)', value: 'dot' },
        { label: 'Bracket (a.b[0])', value: 'bracket' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'index',
      id: 'arrays',
      label: 'Arrays',
      options: [
        { label: 'Index items', value: 'index' },
        { label: 'Keep as values', value: 'keep' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['flatten'] },
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
      type: 'select',
    },
  ],
  id: 'json-flatten',
  inputKind: 'text',
  keywords: [
    'json flatten',
    'json unflatten',
    'flatten json',
    'unflatten json',
    'dot notation',
    'bracket notation',
    'path keys',
    'nested json',
  ],
  name: 'JSON Flatten & Unflatten',
  outputKind: 'json',
  relatedToolIds: ['json-format', 'json-query', 'json-table', 'json-canonicalize'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = choiceField(fields.mode, 'flatten', modes, 'Choose Flatten or Unflatten.');
      const notation = choiceField(
        fields.notation,
        'dot',
        notations,
        'Choose Dot or Bracket notation.',
      );
      const indentation = indentationField(fields);
      const { duplicates, value } = parseExactJson(text);
      let record: Record<string, ExactJsonValue>;
      let output: ExactJsonValue;

      if (mode === 'flatten') {
        const arrays = choiceField(fields.arrays, 'index', arrayModes, 'Choose Index or Keep.');

        record = flattenJson(value, { arrays, notation });
        output = record;
      } else {
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value) ||
          value instanceof JsonNumberToken
        )
          throw new ToolError('Unflatten expects a JSON object of flat keys.');

        record = value;
        output = unflattenJson(record, { notation });
      }

      const rendered = stringifyExactJson(output, indentation === 'tab' ? '\t' : indentation);

      return {
        artifact: {
          base64: encodeBase64Text(rendered),
          fileName: mode === 'flatten' ? 'flattened.json' : 'unflattened.json',
          mimeType: 'application/json;charset=utf-8',
        },
        language: 'json',
        summary: withWarning(summarize(record, notation), duplicateKeysWarning(duplicates)),
        text: rendered,
      };
    }),
  samples: [
    {
      fields: { arrays: 'index', indentation: '2', mode: 'flatten', notation: 'dot' },
      label: 'Flatten nested config',
      text: '{"server":{"host":"localhost","ports":[80,443]},"debug":false,"tags":{}}',
    },
    {
      fields: { arrays: 'index', indentation: '2', mode: 'flatten', notation: 'bracket' },
      label: 'Bracket notation with arrays',
      text: '{"users":[{"name":"Ada","roles":["dev"]},{"name":"Grace","roles":[]}]}',
    },
    {
      fields: { arrays: 'keep', indentation: '2', mode: 'flatten', notation: 'dot' },
      label: 'Keep arrays as values',
      text: '{"build":{"targets":["web","vscode"],"minify":true}}',
    },
    {
      fields: { indentation: '2', mode: 'unflatten', notation: 'dot' },
      label: 'Unflatten dotted keys',
      text: '{"server.host":"localhost","server.ports.0":80,"server.ports.1":443}',
    },
    {
      fields: { indentation: '2', mode: 'unflatten', notation: 'bracket' },
      label: 'Unflatten bracket keys',
      text: '{"users[0].name":"Ada","users[1].name":"Grace","users[1].roles":[]}',
    },
    {
      fields: { arrays: 'index', indentation: '2', mode: 'flatten', notation: 'bracket' },
      label: 'Keys with dots',
      text: '{"example.com":{"a\\"b":1,"plain":2}}',
    },
  ],
  supportsSelection: true,
};
