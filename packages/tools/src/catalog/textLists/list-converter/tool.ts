import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  convertList,
  type ListConvertOptions,
  type ListInputFormat,
  type ListOutputFormat,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const inputFormats: readonly ListInputFormat[] = [
  'auto',
  'lines',
  'comma',
  'semicolon',
  'space',
  'tab',
  'json',
];
const outputFormats: readonly ListOutputFormat[] = ['lines', 'comma', 'json', 'sql', 'custom'];
const quoteStyles: readonly ListConvertOptions['quote'][] = ['none', 'single', 'double'];

const defaults: Record<string, string> = {
  dedupe: 'false',
  dropEmpty: 'true',
  input: 'auto',
  output: 'comma',
  quote: 'none',
  separator: ' | ',
  trim: 'true',
};

function readOptions(fields: Record<string, string>): ListConvertOptions {
  return {
    dedupe: booleanField(fields.dedupe, false),
    dropEmpty: booleanField(fields.dropEmpty, true),
    input: choiceField(
      fields.input,
      'auto',
      inputFormats,
      'Choose Auto, Lines, Comma, Semicolon, Space, Tab or JSON input.',
    ),
    output: choiceField(
      fields.output,
      'comma',
      outputFormats,
      'Choose Lines, Comma, JSON, SQL or Custom output.',
    ),
    quote: choiceField(fields.quote, 'none', quoteStyles, 'Choose None, Single or Double quotes.'),
    separator: fields.separator ?? ' | ',
    trim: booleanField(fields.trim, true),
  };
}

function runListConverter(fields: Record<string, string>, text: string): ToolResult {
  const options = readOptions(fields);
  const result = withToolError(() => convertList(text, options));

  return {
    artifact: {
      base64: encodeBase64Text(result.text),
      fileName: options.output === 'json' ? 'list.json' : 'list.txt',
      mimeType:
        options.output === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
    },
    language: options.output === 'json' ? 'json' : 'plaintext',
    summary: `${result.items.length} items · input ${result.inputFormat} · ${result.duplicatesRemoved} duplicates removed · ${result.emptyDropped} empty dropped`,
    text: result.text,
  };
}

export const listConverterTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Convert a list between lines, comma, semicolon, tab, JSON array and SQL IN formats, with trimming, empty-item removal, deduplication and quoting.',
  fields: [
    {
      defaultValue: 'auto',
      help: 'Auto picks JSON for a bracketed array, then lines, comma, semicolon, tab or space, in that order.',
      id: 'input',
      label: 'Input format',
      options: [
        { label: 'Auto-detect', value: 'auto' },
        { label: 'Lines', value: 'lines' },
        { label: 'Comma', value: 'comma' },
        { label: 'Semicolon', value: 'semicolon' },
        { label: 'Space', value: 'space' },
        { label: 'Tab', value: 'tab' },
        { label: 'JSON array', value: 'json' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'comma',
      id: 'output',
      label: 'Output format',
      options: [
        { label: 'Lines', value: 'lines' },
        { label: 'Comma separated', value: 'comma' },
        { label: 'JSON array', value: 'json' },
        { label: 'SQL IN list', value: 'sql' },
        { label: 'Custom separator', value: 'custom' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'none',
      id: 'quote',
      label: 'Quote items',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Single', value: 'single' },
        { label: 'Double', value: 'double' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'output', is: ['lines', 'comma', 'custom'] },
    },
    {
      defaultValue: ' | ',
      help: 'One to 32 UTF-16 units placed between items.',
      id: 'separator',
      label: 'Separator',
      type: 'text',
      visibleWhen: { field: 'output', is: ['custom'] },
    },
    { defaultValue: 'true', id: 'trim', label: 'Trim items', type: 'checkbox' },
    { defaultValue: 'true', id: 'dropEmpty', label: 'Drop empty items', type: 'checkbox' },
    { defaultValue: 'false', id: 'dedupe', label: 'Remove duplicates', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'list-converter',
  inputKind: 'text',
  keywords: ['list', 'csv', 'comma', 'sql', 'in', 'json', 'array', 'lines', 'separator'],
  name: 'List Converter',
  outputKind: 'text',
  relatedToolIds: ['sort-lines', 'deduplicate-lines', 'json-format', 'join-split-lines'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runListConverter(fields, text),
  samples: [
    {
      fields: { ...defaults, dedupe: 'true', output: 'sql' },
      label: 'Lines to SQL IN list',
      text: 'alice\nbob\nbob\ncarol\n',
    },
    {
      fields: { ...defaults, output: 'json' },
      label: 'Comma list to JSON array',
      text: 'red, green, blue',
    },
    {
      fields: { ...defaults, output: 'lines', quote: 'double' },
      label: 'JSON array to quoted lines',
      text: '["one", "two", 3, null]',
    },
    {
      fields: { ...defaults, dedupe: 'true' },
      label: 'Deduplicate and trim',
      text: '  a \n\nb\na\n b',
    },
    {
      fields: { ...defaults, output: 'custom' },
      label: 'Custom separator',
      text: 'one\ntwo\nthree',
    },
    {
      fields: { ...defaults, input: 'tab' },
      label: 'Tab-separated to comma',
      text: 'id\tname\temail',
    },
  ],
  supportsSelection: true,
};
