import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  duplicateKeysWarning,
  jsonArrayToLines,
  jsonLinesToArray,
  parseExactJson,
  stringifyExactJson,
} from '@devtoolora/functions/format';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { withWarning } from '../../../adapters/summary';

const modes = ['toArray', 'toLines'] as const;
const indents = ['2', '4', '0'] as const;

function artifactOf(rendered: string, fileName: string, mimeType: string) {
  return { base64: encodeBase64Text(rendered), fileName, mimeType };
}

export const jsonLinesConverterTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Formatters',
  description: 'Convert JSON Lines (JSONL, NDJSON) to a JSON array and back.',
  fields: [
    {
      defaultValue: 'toArray',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'JSONL → array', value: 'toArray' },
        { label: 'Array → JSONL', value: 'toLines' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '2',
      id: 'indent',
      label: 'Indentation',
      options: [
        { label: '2 spaces', value: '2' },
        { label: '4 spaces', value: '4' },
        { label: 'Minified', value: '0' },
      ],
      type: 'select',
      visibleWhen: { field: 'mode', is: ['toArray'] },
    },
  ],
  id: 'json-lines-converter',
  inputKind: 'text',
  keywords: ['jsonl', 'ndjson', 'json lines', 'json array', 'newline delimited json', 'log lines'],
  name: 'JSON Lines ↔ JSON Array',
  outputKind: 'json',
  relatedToolIds: ['json-lines-inspector', 'json-format', 'json-table', 'json-to-csv'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = choiceField(
        fields.mode,
        'toArray',
        modes,
        'Choose JSONL → array or Array → JSONL.',
      );

      if (mode === 'toLines') {
        const { duplicates, value } = parseExactJson(text);
        const lines = jsonArrayToLines(value);

        return {
          artifact: artifactOf(lines, 'records.jsonl', 'application/x-ndjson;charset=utf-8'),
          language: 'json',
          summary: withWarning(
            `${lines ? lines.split('\n').length : 0} lines`,
            duplicateKeysWarning(duplicates),
          ),
          text: lines,
        };
      }

      const indent = choiceField(
        fields.indent,
        '2',
        indents,
        'Choose 2 spaces, 4 spaces or Minified.',
      );
      const { blankSkipped, duplicates, lines, value } = jsonLinesToArray(text);
      const rendered = stringifyExactJson(value, Number(indent));

      return {
        artifact: artifactOf(rendered, 'records.json', 'application/json;charset=utf-8'),
        language: 'json',
        summary: withWarning(
          `${lines} records · ${blankSkipped} blank lines skipped`,
          duplicateKeysWarning(duplicates),
        ),
        text: rendered,
      };
    }),
  samples: [
    {
      fields: { indent: '2', mode: 'toArray' },
      label: 'Log lines to array',
      text: '{"level":"info","msg":"started"}\n{"level":"warn","msg":"slow request","ms":1840}\n{"level":"error","msg":"timeout"}',
    },
    {
      fields: { mode: 'toLines' },
      label: 'Array to JSONL',
      text: '[\n  {"id": 1, "name": "Ada"},\n  {"id": 2, "name": "Linus"}\n]',
    },
    {
      fields: { indent: '2', mode: 'toArray' },
      label: 'Blank lines are skipped',
      text: '{"a":1}\n\n{"a":2}\n   \n{"a":3}\n',
    },
    {
      fields: { indent: '0', mode: 'toArray' },
      label: 'Minified array',
      text: '{"a":1}\n{"a":2}\n{"a":3}',
    },
    {
      fields: { indent: '2', mode: 'toArray' },
      label: 'Nested records',
      text: '{"user":{"id":1,"tags":["a","b"]},"ok":true}\n{"user":{"id":2,"tags":[]},"ok":false}',
    },
    {
      fields: { indent: '2', mode: 'toArray' },
      label: 'CRLF input',
      text: '{"id":1}\r\n{"id":2}\r\n{"id":3}',
    },
  ],
  supportsSelection: true,
};
