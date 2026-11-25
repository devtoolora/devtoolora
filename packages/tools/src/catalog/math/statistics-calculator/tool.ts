import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { describeNumbers, formatDouble } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities, mathOutput } from '../shared';

const outputs = ['table', 'json'] as const;
const percentileMessage = 'Custom percentile must be a number from 0 to 100.';

function parsePercentile(value: string | undefined): number | undefined {
  const input = value?.trim() ?? '';

  if (!input) return undefined;

  const percentile = Number(input);

  if (!Number.isFinite(percentile) || percentile < 0 || percentile > 100) {
    throw new ToolError(percentileMessage);
  }

  return percentile;
}

export const statisticsCalculatorTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Math',
  description:
    'Describe a list of numbers: count, sum, mean, median, mode, standard deviation, variance, percentiles and quartile range.',
  fields: [
    {
      id: 'percentile',
      label: 'Custom percentile',
      placeholder: '0-100',
      type: 'text',
    },
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
  id: 'statistics-calculator',
  inputKind: 'text',
  keywords: [
    'statistics',
    'mean',
    'median',
    'mode',
    'variance',
    'deviation',
    'percentile',
    'average',
  ],
  name: 'Statistics Calculator',
  outputKind: 'text',
  relatedToolIds: ['math-evaluator', 'percentage-calculator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const output = choiceField(fields.output, 'table', outputs, 'Choose table or JSON output.');
      const result = describeNumbers(text, { percentile: parsePercentile(fields.percentile) });
      const noun = result.count === 1 ? 'number' : 'numbers';
      const summary = `${result.count} ${noun} · mean ${formatDouble(Number(result.json.mean))}`;

      if (output === 'json') {
        return mathOutput(`${JSON.stringify(result.json, null, 2)}\n`, 'statistics', summary, true);
      }

      return mathOutput(result.text, 'statistics', summary, false);
    }),
  samples: [
    { label: 'Mixed separators', text: '2, 4; 4 4\n5 5 7 9' },
    { label: 'Exam scores', text: '72 85 90 66 78 92 85 70' },
    { fields: { percentile: '10' }, label: 'Custom percentile', text: '1 2 3 4' },
    { fields: { output: 'json' }, label: 'JSON output', text: '3 1 4 1 5 9 2 6' },
    { label: 'Geometric mean', text: '1 4 16' },
    { label: 'Negative values', text: '-5 -1 0 3 8' },
    { label: 'Single value', text: '42' },
  ],
  supportsSelection: true,
};
