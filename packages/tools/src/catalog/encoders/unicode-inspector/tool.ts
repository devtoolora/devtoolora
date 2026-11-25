import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { inspectUnicode } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const outputs = ['table', 'json'] as const;

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function runInspector(fields: Record<string, string>, text: string): ToolResult {
  const output = choiceField(fields.output, 'table', outputs, 'Choose an output.');
  const { bytes, graphemes, rows } = inspectUnicode(text);
  const summary = `${plural(rows.length, 'code point')} · ${plural(graphemes, 'grapheme')} · ${plural(bytes, 'UTF-8 byte')}`;
  const json = JSON.stringify(rows, null, 2);

  if (output === 'json') return { language: 'json', summary, text: json };

  return {
    jsonTable: {
      columns: ['#', 'Grapheme', 'Char', 'Code point', 'Category', 'UTF-8', 'UTF-16'],
      rows: rows.map((row) => [
        String(row.index),
        String(row.grapheme),
        row.char,
        row.codePoint,
        row.category,
        row.utf8,
        row.utf16,
      ]),
    },
    language: 'json',
    summary,
    text: json,
  };
}

export const unicodeInspectorTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Inspect text one code point at a time with code point, general category, UTF-8 and UTF-16 encodings and grapheme grouping.',
  fields: [
    {
      defaultValue: 'table',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Table', value: 'table' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'unicode-inspector',
  inputKind: 'text',
  keywords: [
    'unicode',
    'code point',
    'inspector',
    'utf-8',
    'utf-16',
    'grapheme',
    'category',
    'surrogate',
    'character info',
  ],
  name: 'Unicode Inspector',
  outputKind: 'text',
  relatedToolIds: [
    'unicode-escape',
    'zero-width-detector',
    'text-statistics',
    'unicode-normalizer',
  ],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => withToolError(() => runInspector(fields, text)),
  samples: [
    { fields: { output: 'table' }, label: 'Accent and emoji', text: '\u00E9\u{1F600}' },
    { fields: { output: 'table' }, label: 'Combining accent', text: 'e\u0301' },
    { fields: { output: 'table' }, label: 'Czech word', text: 'P\u0159\u00EDli\u0161' },
    { fields: { output: 'table' }, label: 'Zero-width space', text: 'a\u200Bb' },
    {
      fields: { output: 'table' },
      label: 'Family emoji',
      text: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',
    },
    { fields: { output: 'json' }, label: 'JSON output', text: 'A\tz' },
  ],
  supportsSelection: true,
};
