import { ToolDefinition, ToolError } from '@devtoolora/core';
import { countFrequency } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField } from '../../../adapters/fields';

const units = ['words', 'characters'] as const;

function positiveInteger(value: string | undefined, fallback: number, message: string): number {
  if (value === undefined || value.trim() === '') return fallback;
  if (!/^\d+$/.test(value.trim())) throw new ToolError(message);

  return Number(value.trim());
}

function plural(count: number, unit: (typeof units)[number]): string {
  const singular = unit === 'words' ? 'word' : 'character';

  return `${count} ${count === 1 ? singular : unit}`;
}

export const wordFrequencyTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Count the most frequent words or characters in a text, with counts and percentages.',
  fields: [
    {
      defaultValue: 'words',
      id: 'unit',
      label: 'Count',
      options: [
        { label: 'Words', value: 'words' },
        { label: 'Characters', value: 'characters' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'false',
      id: 'caseSensitive',
      label: 'Distinguish letter case',
      type: 'checkbox',
    },
    {
      defaultValue: 'false',
      id: 'ignoreStopWords',
      label: 'Ignore English stop words',
      type: 'checkbox',
      visibleWhen: { field: 'unit', is: ['words'] },
    },
    {
      defaultValue: '1',
      help: 'Words shorter than this are skipped.',
      id: 'minLength',
      label: 'Minimum word length',
      type: 'number',
      visibleWhen: { field: 'unit', is: ['words'] },
    },
    {
      defaultValue: '50',
      help: 'Whole number from 1 to 1,000.',
      id: 'limit',
      label: 'Top entries',
      type: 'number',
    },
  ],
  freshResults: true,
  id: 'word-frequency',
  inputKind: 'text',
  keywords: ['word frequency', 'word count', 'character frequency', 'top words', 'stop words'],
  name: 'Word Frequency Counter',
  outputKind: 'text',
  relatedToolIds: ['text-statistics', 'readability-score', 'deduplicate-lines'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const unit = choiceField(fields.unit, 'words', units, 'Choose words or characters.');
      const result = countFrequency(text, {
        caseSensitive: booleanField(fields.caseSensitive, false),
        ignoreStopWords: booleanField(fields.ignoreStopWords, false),
        limit: positiveInteger(
          fields.limit,
          50,
          'Top entries must be a whole number from 1 to 1,000.',
        ),
        minLength:
          unit === 'words'
            ? positiveInteger(fields.minLength, 1, 'Minimum length must be a whole number.')
            : 1,
        unit,
      });

      return {
        jsonTable: {
          columns: ['Rank', 'Value', 'Count', 'Percent'],
          rows: result.rows.map((row, index) => [
            String(index + 1),
            row.value,
            String(row.count),
            `${row.percent}%`,
          ]),
        },
        language: 'plaintext',
        summary: `${plural(result.total, unit)} \u00B7 ${result.distinct} distinct`,
        text: result.rows.map((row) => `${row.value}\t${row.count}`).join('\n'),
      };
    }),
  samples: [
    {
      fields: { unit: 'words' },
      label: 'Pangram with repeats',
      text: 'The cat and the hat. THE end',
    },
    {
      fields: { ignoreStopWords: 'true', unit: 'words' },
      label: 'Skip stop words',
      text: 'The quick fox and the lazy dog and the quick cat',
    },
    { fields: { unit: 'words' }, label: 'Czech accents', text: 'Příliš žluťoučký kůň, příliš!' },
    {
      fields: { caseSensitive: 'true', unit: 'words' },
      label: 'Case sensitive',
      text: 'Apple apple APPLE Apple',
    },
    {
      fields: { minLength: '4', unit: 'words' },
      label: 'Longer words only',
      text: 'to be or not to be, that is the question',
    },
    { fields: { unit: 'characters' }, label: 'Character counts', text: 'hello world' },
  ],
  supportsSelection: true,
};
