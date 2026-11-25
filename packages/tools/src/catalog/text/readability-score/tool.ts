import { ToolDefinition } from '@devtoolora/core';
import { readability } from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const outputs = ['report', 'json'] as const;
const fleschBands: Array<[number, string]> = [
  [90, 'Very easy'],
  [80, 'Easy'],
  [70, 'Fairly easy'],
  [60, 'Standard'],
  [50, 'Fairly difficult'],
  [30, 'Difficult'],
];

function fleschBand(ease: number): string {
  return fleschBands.find(([minimum]) => ease >= minimum)?.[1] ?? 'Very difficult';
}

function gradeBand(grade: number): string {
  if (grade <= 5) return 'Elementary school';
  if (grade <= 8) return 'Middle school';
  if (grade <= 12) return 'High school';

  return 'College';
}

export const readabilityScoreTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Score English text with Flesch reading ease, Flesch-Kincaid grade and Gunning fog index.',
  fields: [
    {
      defaultValue: 'report',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Report', value: 'report' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'readability-score',
  inputKind: 'text',
  keywords: [
    'readability',
    'flesch',
    'flesch-kincaid',
    'gunning fog',
    'reading level',
    'syllables',
  ],
  name: 'Readability Score',
  outputKind: 'text',
  relatedToolIds: ['text-statistics', 'word-frequency'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = choiceField(fields.output, 'report', outputs, 'Choose report or JSON.');
      const report = readability(text);
      const ease = report.fleschReadingEase;
      const grade = report.fleschKincaidGrade;
      const fog = report.gunningFog;

      return {
        language: output === 'json' ? 'json' : 'plaintext',
        summary: `Flesch ${ease} \u00B7 grade ${grade} \u00B7 fog ${fog}`,
        text:
          output === 'json'
            ? JSON.stringify(report, null, 2)
            : [
                `Flesch reading ease: ${ease} (${fleschBand(ease)})`,
                `Flesch-Kincaid grade: ${grade} (${gradeBand(grade)})`,
                `Gunning fog index: ${fog} (${gradeBand(fog)})`,
                '',
                `Words: ${report.words}`,
                `Sentences: ${report.sentences}`,
                `Syllables: ${report.syllables}`,
                `Complex words: ${report.complexWords}`,
              ].join('\n'),
      };
    }),
  samples: [
    { fields: {}, label: 'Simple sentence', text: 'The cat sat on the mat.' },
    {
      fields: {},
      label: 'Dense prose',
      text: 'Readability formulas estimate difficulty. Short words help.',
    },
    {
      fields: {},
      label: 'Plain advice',
      text: 'Write short sentences. Use simple words. Cut what you do not need.',
    },
    {
      fields: {},
      label: 'Academic style',
      text: 'The implementation of comprehensive organizational methodologies necessitates considerable administrative coordination.',
    },
    { fields: { output: 'json' }, label: 'JSON output', text: 'It is a good day. We can go out.' },
    {
      fields: {},
      label: 'Contractions',
      text: "Don't worry. It's fine, and we'll fix it soon!",
    },
  ],
  supportsSelection: true,
};
