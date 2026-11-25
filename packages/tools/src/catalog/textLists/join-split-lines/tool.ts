import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { joinLines, splitText, type SplitTextOptions } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const modes = ['join', 'split'] as const;
const splitModes = ['separator', 'length'] as const;

const defaults: Record<string, string> = {
  dropEmpty: 'true',
  length: '80',
  mode: 'join',
  separator: ', ',
  splitBy: 'separator',
  trim: 'true',
};

function readSplit(fields: Record<string, string>): Pick<SplitTextOptions, 'by' | 'length'> {
  const by = choiceField(fields.splitBy, 'separator', splitModes, 'Choose Separator or Length.');
  const length = fields.length === undefined || fields.length === '' ? 80 : Number(fields.length);

  return { by, length };
}

function runJoinSplit(fields: Record<string, string>, text: string): ToolResult {
  const mode = choiceField(fields.mode, 'join', modes, 'Choose Join or Split.');
  const dropEmpty = booleanField(fields.dropEmpty, true);
  const trim = booleanField(fields.trim, true);
  const separator = (fields.separator ?? ', ').replaceAll('\\n', '\n').replaceAll('\\t', '\t');
  const result = withToolError(() =>
    mode === 'join'
      ? joinLines(text, { dropEmpty, separator, trim })
      : splitText(text, { ...readSplit(fields), dropEmpty, separator, trim }),
  );

  return {
    artifact: {
      base64: encodeBase64Text(result.text),
      fileName: mode === 'join' ? 'joined.txt' : 'split.txt',
      mimeType: 'text/plain;charset=utf-8',
    },
    language: 'plaintext',
    summary: mode === 'join' ? `${result.count} lines joined` : `${result.count} pieces`,
    text: result.text,
  };
}

export const joinSplitLinesTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Join lines into one line with any separator, or split text into lines on a separator or into fixed-length pieces.',
  fields: [
    {
      defaultValue: 'join',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Join lines', value: 'join' },
        { label: 'Split text', value: 'split' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: ', ',
      help: 'Use \\n for a newline and \\t for a tab. Up to 32 characters; split needs at least 1.',
      id: 'separator',
      label: 'Separator',
      type: 'text',
      visibleWhen: {
        anyOf: [
          { field: 'mode', is: ['join'] },
          { field: 'splitBy', is: ['separator'] },
        ],
      },
    },
    {
      defaultValue: 'separator',
      id: 'splitBy',
      label: 'Split by',
      options: [
        { label: 'Separator', value: 'separator' },
        { label: 'Length', value: 'length' },
      ],
      presentation: 'segmented',
      type: 'select',
      visibleWhen: { field: 'mode', is: ['split'] },
    },
    {
      defaultValue: '80',
      help: 'Whole number 1–10,000 UTF-16 units. A surrogate pair is never cut in half.',
      id: 'length',
      label: 'Piece length',
      type: 'number',
      visibleWhen: [
        { field: 'mode', is: ['split'] },
        { field: 'splitBy', is: ['length'] },
      ],
    },
    { defaultValue: 'true', id: 'trim', label: 'Trim items', type: 'checkbox' },
    { defaultValue: 'true', id: 'dropEmpty', label: 'Drop empty items', type: 'checkbox' },
  ],
  freshResults: true,
  id: 'join-split-lines',
  inputKind: 'text',
  keywords: ['join', 'split', 'lines', 'separator', 'merge', 'chunk', 'delimiter', 'newline'],
  name: 'Join & Split Lines',
  outputKind: 'text',
  relatedToolIds: ['list-converter', 'wrap-text', 'prefix-suffix-lines', 'number-lines'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => runJoinSplit(fields, text),
  samples: [
    { fields: { ...defaults }, label: 'Join with comma', text: 'alpha\nbeta\n\ngamma' },
    {
      fields: { ...defaults, separator: ' | ' },
      label: 'Join with custom separator',
      text: 'one\ntwo\nthree',
    },
    {
      fields: { ...defaults, mode: 'split', separator: ';' },
      label: 'Split on semicolons',
      text: 'red; green;blue; ',
    },
    {
      fields: { ...defaults, length: '10', mode: 'split', splitBy: 'length' },
      label: 'Split into 10-character pieces',
      text: 'abcdefghijklmnopqrstuvwxyz',
    },
    {
      fields: { ...defaults, dropEmpty: 'false', mode: 'split', separator: ',' },
      label: 'Keep empty pieces',
      text: 'a,,b,',
    },
    {
      fields: { ...defaults, separator: '\\t' },
      label: 'Escaped tab separator',
      text: 'id\nname\nemail',
    },
  ],
  supportsSelection: true,
};
