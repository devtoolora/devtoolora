import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  applyJsonPatch,
  generateJsonPatch,
  jsonDuplicateWarning,
  type JsonPatchOperation,
} from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { withWarning } from '../../../adapters/summary';
import { browserSafeCapabilities } from '../shared';

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

function patchSummary(operations: JsonPatchOperation[]): string {
  if (operations.length === 0) return 'No differences; the patch is empty.';

  const kinds = (['add', 'remove', 'replace'] as const)
    .map((op) => [op, operations.filter((operation) => operation.op === op).length] as const)
    .filter(([, count]) => count > 0)
    .map(([op, count]) => `${count.toLocaleString('en-US')} ${op}`);

  return `${plural(operations.length, 'operation')} (${kinds.join(', ')}).`;
}

function jsonResult(text: string, fileName: string, summary: string) {
  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName,
      mimeType: 'application/json;charset=utf-8',
    },
    language: 'json',
    summary,
    text,
  };
}

export const jsonPatchTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Generate an RFC 6902 JSON Patch from two JSON documents, or apply a patch with exact numbers and kept key order.',
  fields: [
    {
      defaultValue: 'generate',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Generate patch', value: 'generate' },
        { label: 'Apply patch', value: 'apply' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      help: 'The JSON the patch should produce from the original.',
      id: 'target',
      label: 'Target JSON',
      placeholder: '{"name":"after"}',
      rows: 10,
      type: 'textarea',
      visibleWhen: { field: 'mode', is: ['generate'] },
    },
    {
      help: 'An array of add, remove, replace, move, copy and test operations.',
      id: 'patch',
      label: 'JSON Patch',
      placeholder: '[{"op":"replace","path":"/name","value":"after"}]',
      rows: 10,
      type: 'textarea',
      visibleWhen: { field: 'mode', is: ['apply'] },
    },
  ],
  id: 'json-patch',
  inputKind: 'text',
  keywords: ['json patch', 'rfc 6902', 'diff', 'apply', 'json pointer', 'add remove replace'],
  name: 'JSON Patch Generator & Applier',
  outputKind: 'json',
  relatedToolIds: ['json-diff', 'json-format', 'json-query'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = fields.mode ?? 'generate';

      if (mode !== 'generate' && mode !== 'apply')
        throw new ToolError('Choose Generate patch or Apply patch.');

      if (mode === 'apply') {
        const result = applyJsonPatch(text, fields.patch ?? '');

        return jsonResult(
          result.text,
          'patched.json',
          withWarning(
            `Applied ${plural(result.applied, 'operation')}.`,
            jsonDuplicateWarning(text),
          ),
        );
      }

      const patch = generateJsonPatch(text, fields.target ?? '');

      const warnings = [
        ['Original', text],
        ['Target', fields.target ?? ''],
      ].flatMap(([label, source]) => {
        const warning = jsonDuplicateWarning(source ?? '');

        return warning ? [`${label}: ${warning}`] : [];
      });

      return jsonResult(
        patch.text,
        'patch.json',
        withWarning(patchSummary(patch.operations), warnings.join(' ')),
      );
    }),
  runRequires: [
    { anyOf: ['$text'] },
    { anyOf: ['target'], when: { field: 'mode', is: ['generate'] } },
    { anyOf: ['patch'], when: { field: 'mode', is: ['apply'] } },
  ],
  samples: [
    {
      fields: { mode: 'generate', target: '{"name":"Ada Lovelace","tags":["dev"],"active":true}' },
      label: 'Generate from a changed profile',
      text: '{"name":"Ada","tags":["dev","admin"]}',
    },
    {
      fields: { mode: 'generate', target: '{"a/b":2,"m~n":null}' },
      label: 'Keys with / and ~',
      text: '{"a/b":1}',
    },
    {
      fields: { mode: 'generate', target: '{"id":9007199254740993,"price":1e0}' },
      label: 'Exact numbers',
      text: '{"id":9007199254740992,"price":1.00}',
    },
    {
      fields: {
        mode: 'apply',
        patch:
          '[{"op":"add","path":"/tags/-","value":"editor"},{"op":"replace","path":"/name","value":"Grace"}]',
      },
      label: 'Apply add and replace',
      text: '{"name":"Ada","tags":["dev"]}',
    },
    {
      fields: {
        mode: 'apply',
        patch:
          '[{"op":"move","from":"/draft","path":"/published"},{"op":"copy","from":"/published","path":"/backup"}]',
      },
      label: 'Move and copy',
      text: '{"draft":{"title":"Notes"}}',
    },
    {
      fields: {
        mode: 'apply',
        patch:
          '[{"op":"test","path":"/version","value":1.0},{"op":"replace","path":"/version","value":2}]',
      },
      label: 'Guard with test',
      text: '{"version":1}',
    },
  ],
  supportsSelection: true,
};
