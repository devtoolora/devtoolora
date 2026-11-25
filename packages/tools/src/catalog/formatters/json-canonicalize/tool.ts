import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  canonicalizeJson,
  parseJson,
  rejectOutOfRangeNumbers,
  sortJsonKeys,
  type JsonValue,
} from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { indentationField } from '../shared';

const modes = ['sort', 'canonical'] as const;
const orders = ['asc', 'desc'] as const;

function countKeys(value: JsonValue): number {
  if (typeof value !== 'object' || value === null) return 0;
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + countKeys(item), 0);

  return Object.values(value).reduce<number>(
    (sum, item) => sum + countKeys(item),
    Object.keys(value).length,
  );
}

function artifactOf(rendered: string, fileName: string) {
  return {
    base64: encodeBase64Text(rendered),
    fileName,
    mimeType: 'application/json;charset=utf-8',
  };
}

export const jsonCanonicalizeTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description:
    'Sort JSON object keys recursively, or produce the RFC 8785 canonical form used for signing and hashing.',
  fields: [
    {
      defaultValue: 'sort',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Sort keys', value: 'sort' },
        { label: 'Canonical (RFC 8785)', value: 'canonical' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'asc',
      id: 'order',
      label: 'Order',
      options: [
        { label: 'Ascending', value: 'asc' },
        { label: 'Descending', value: 'desc' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['sort'] },
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
      visibleWhen: { field: 'mode', is: ['sort'] },
    },
  ],
  id: 'json-canonicalize',
  inputKind: 'text',
  keywords: [
    'json sort keys',
    'sort json',
    'json canonicalize',
    'canonical json',
    'rfc 8785',
    'jcs',
    'json signing',
    'stable json',
  ],
  name: 'JSON Sort Keys & Canonicalize',
  outputKind: 'json',
  relatedToolIds: ['json-format', 'json-flatten', 'hash', 'hmac'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = choiceField(fields.mode, 'sort', modes, 'Choose Sort keys or Canonical.');
      const sortOnly =
        mode === 'sort'
          ? {
              indentation: indentationField(fields),
              order: choiceField(fields.order, 'asc', orders, 'Choose Ascending or Descending.'),
            }
          : undefined;
      const value = parseJson(text, { exactIntegers: mode === 'sort' });

      rejectOutOfRangeNumbers(text);

      if (!sortOnly) {
        const canonical = canonicalizeJson(value);
        const bytes = new TextEncoder().encode(canonical).length;

        return {
          artifact: artifactOf(canonical, 'canonical.json'),
          language: 'json',
          summary: `RFC 8785 · ${bytes} UTF-8 bytes`,
          text: canonical,
        };
      }

      const { indentation, order } = sortOnly;
      const rendered = sortJsonKeys(value, { indentation, order });

      return {
        artifact: artifactOf(rendered, 'sorted.json'),
        language: 'json',
        summary: `${order} · ${countKeys(value)} keys sorted`,
        text: rendered,
      };
    }),
  samples: [
    {
      fields: { indentation: '2', mode: 'sort', order: 'asc' },
      label: 'Sort keys ascending',
      text: '{"name":"Ada","age":36,"address":{"zip":"10115","city":"Berlin"}}',
    },
    {
      fields: { indentation: '2', mode: 'sort', order: 'desc' },
      label: 'Sort keys descending',
      text: '{"alpha":1,"gamma":3,"beta":{"y":2,"x":1}}',
    },
    {
      fields: { mode: 'canonical' },
      label: 'Canonical JSON for signing',
      text: '{\n  "to": "alice",\n  "amount": 10.50,\n  "currency": "EUR",\n  "id": 7\n}',
    },
    {
      fields: { mode: 'canonical' },
      label: 'RFC 8785 number forms',
      text: '{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001,-0]}',
    },
    {
      fields: { mode: 'canonical' },
      label: 'Unicode keys',
      text: '{"é":1,"z":2,"a":3,"\\uD83D\\uDE00":4,"\\uFF5E":5}',
    },
    {
      fields: { mode: 'canonical' },
      label: 'Already canonical',
      text: '{"a":1,"b":[true,null],"c":"text"}',
    },
  ],
  supportsSelection: true,
};
