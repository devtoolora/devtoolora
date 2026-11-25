import { ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { cleanLines } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const blankModes = ['remove', 'collapse', 'keep'] as const;
const numberModes = ['remove', 'keep'] as const;

function plural(count: number, noun: string, pluralNoun = `${noun}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? noun : pluralNoun}`;
}

function summarize(blankLinesRemoved: number, numbersRemoved: number): string {
  const parts = [
    blankLinesRemoved > 0 ? plural(blankLinesRemoved, 'blank line') : '',
    numbersRemoved > 0 ? plural(numbersRemoved, 'line number') : '',
  ].filter((part) => part !== '');

  return parts.length === 0
    ? 'No blank lines or line numbers to remove.'
    : `Removed ${parts.join(' and ')}.`;
}

export const removeBlankLinesTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Remove or collapse blank lines and strip leading line numbers from pasted text, keeping every other line and its line ending exactly as it was.',
  fields: [
    {
      defaultValue: 'remove',
      id: 'blankLines',
      label: 'Blank lines',
      options: [
        { label: 'Remove', value: 'remove' },
        { label: 'Collapse to one', value: 'collapse' },
        { label: 'Keep', value: 'keep' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'true',
      id: 'whitespaceIsBlank',
      label: 'Whitespace-only lines are blank',
      type: 'checkbox',
    },
    {
      defaultValue: 'remove',
      id: 'lineNumbers',
      label: 'Line numbers',
      options: [
        { label: 'Remove', value: 'remove' },
        { label: 'Keep', value: 'keep' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'remove-blank-lines',
  inputKind: 'text',
  keywords: [
    'blank lines',
    'empty lines',
    'remove blank lines',
    'remove empty lines',
    'line numbers',
    'remove line numbers',
    'strip line numbers',
    'collapse blank lines',
  ],
  name: 'Remove Blank Lines & Line Numbers',
  outputKind: 'text',
  relatedToolIds: ['whitespace-cleaner', 'number-lines', 'deduplicate-lines'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const result = cleanLines(text, {
        blankLines: choiceField(
          fields.blankLines,
          'remove',
          blankModes,
          'Choose Remove, Collapse to one or Keep for blank lines.',
        ),
        lineNumbers: choiceField(
          fields.lineNumbers,
          'remove',
          numberModes,
          'Choose Remove or Keep for line numbers.',
        ),
        whitespaceIsBlank: booleanField(fields.whitespaceIsBlank, true),
      });

      return {
        artifact: {
          base64: encodeBase64Text(result.text),
          fileName: 'cleaned.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: summarize(result.blankLinesRemoved, result.numbersRemoved),
        text: result.text,
      };
    }),
  samples: [
    {
      fields: { blankLines: 'remove', lineNumbers: 'keep' },
      label: 'Remove blank lines',
      text: 'first\n\n\nsecond\n   \nthird\n',
    },
    {
      fields: { blankLines: 'collapse', lineNumbers: 'keep' },
      label: 'Collapse to one',
      text: 'Intro\n\n\n\nBody\n\n\nEnd\n',
    },
    {
      fields: { blankLines: 'keep' },
      label: 'Numbered code',
      text: '1. const a = 1;\n2. const b = 2;\n3. return a + b;\n',
    },
    {
      fields: { blankLines: 'keep' },
      label: 'Editor copy with spaces',
      text: '  1 import fs from "fs";\n  2 \n  3 fs.readFileSync(path);\n',
    },
    {
      fields: { blankLines: 'remove' },
      label: 'Both at once',
      text: '1) alpha\n\n2) beta\n\n\n3) gamma\n',
    },
    {
      fields: { blankLines: 'keep', lineNumbers: 'keep', whitespaceIsBlank: 'false' },
      label: 'Nothing to change',
      text: 'plain\ntext\n',
    },
  ],
  supportsSelection: true,
};

export const removeLineNumbersTool: ToolDefinition = {
  ...removeBlankLinesTool,
  aliasOf: 'remove-blank-lines',
  fields: removeBlankLinesTool.fields?.map((field) =>
    field.id === 'blankLines' ? { ...field, defaultValue: 'keep' } : field,
  ),
  id: 'remove-line-numbers',
  name: 'Remove Line Numbers',
  run: (input) =>
    removeBlankLinesTool.run({ ...input, fields: { blankLines: 'keep', ...input.fields } }),
};
