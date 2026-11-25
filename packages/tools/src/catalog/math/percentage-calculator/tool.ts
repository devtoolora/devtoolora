import { ToolDefinition, ToolError } from '@devtoolora/core';
import { calculatePercentage } from '@devtoolora/functions/math';
import type { PercentageOptions } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, mathOutput, parseFiniteNumber } from '../shared';

export const percentageCalculatorTool: ToolDefinition = {
  id: 'percentage-calculator',
  keywords: ['percent', 'percent change', 'discount', 'markup', 'increase', 'decrease'],
  name: 'Percentage Calculator',
  category: 'Math',
  description: 'Calculate percent of, what percent, percent change and add/subtract percent.',

  inputKind: 'none',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      id: 'mode',
      label: 'Mode',
      type: 'select',
      defaultValue: 'percent-of',
      options: [
        { label: 'What is X% of Y?', value: 'percent-of' },
        { label: 'X is what % of Y?', value: 'what-percent' },
        { label: 'Percent change', value: 'percent-change' },
        { label: 'Add/subtract %', value: 'add-percent' },
      ],
    },
    {
      id: 'percent',
      label: 'Percent',
      type: 'number',
      defaultValue: '25',
      visibleWhen: { field: 'mode', is: ['percent-of', 'add-percent'] },
    },
    {
      id: 'value',
      label: 'Value',
      type: 'number',
      defaultValue: '200',
      visibleWhen: { field: 'mode', is: ['percent-of', 'add-percent'] },
    },
    {
      id: 'part',
      label: 'Part',
      type: 'number',
      defaultValue: '25',
      visibleWhen: { field: 'mode', is: ['what-percent'] },
    },
    {
      id: 'total',
      label: 'Total',
      type: 'number',
      defaultValue: '200',
      visibleWhen: { field: 'mode', is: ['what-percent'] },
    },
    {
      id: 'oldValue',
      label: 'Old value',
      type: 'number',
      defaultValue: '200',
      visibleWhen: { field: 'mode', is: ['percent-change'] },
    },
    {
      id: 'newValue',
      label: 'New value',
      type: 'number',
      defaultValue: '250',
      visibleWhen: { field: 'mode', is: ['percent-change'] },
    },
  ],
  autoRun: true,
  samples: [
    { label: '25% of 200', fields: { mode: 'percent-of', percent: '25', value: '200' } },
    { label: '25 of 200', fields: { mode: 'what-percent', part: '25', total: '200' } },
    { label: '200 to 250', fields: { mode: 'percent-change', oldValue: '200', newValue: '250' } },
    { label: '200 +/- 15%', fields: { mode: 'add-percent', value: '200', percent: '15' } },
    {
      label: 'Reverse change (20% decrease)',
      fields: { mode: 'percent-change', oldValue: '250', newValue: '200' },
    },
    { label: 'Zero adjustment', fields: { mode: 'add-percent', value: '200', percent: '0' } },
  ],
  relatedToolIds: ['math-evaluator', 'financial-calculator', 'number-formatter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const report = calculatePercentage(percentageOptions(fields));
      const answer =
        typeof report.result === 'number'
          ? `${report.result}${report.mode === 'what-percent' || report.mode === 'percent-change' ? '%' : ''}`
          : `Increased: ${report.result.increased} · Decreased: ${report.result.decreased}`;

      return mathOutput(
        JSON.stringify(report, null, 2),
        'percentage-calculation',
        `${answer} · ${report.formula}`,
        true,
      );
    }),
};

function percentageOptions(fields: Record<string, string>): PercentageOptions {
  switch (fields.mode ?? 'percent-of') {
    case 'what-percent':
      return {
        mode: 'what-percent',
        part: parseFiniteNumber(fields.part, 'Part'),
        total: parseFiniteNumber(fields.total, 'Total'),
      };
    case 'percent-change':
      return {
        mode: 'percent-change',
        oldValue: parseFiniteNumber(fields.oldValue, 'Old value'),
        newValue: parseFiniteNumber(fields.newValue, 'New value'),
      };
    case 'add-percent':
      return {
        mode: 'add-percent',
        value: parseFiniteNumber(fields.value, 'Value'),
        percent: parseFiniteNumber(fields.percent, 'Percent'),
      };
    case 'percent-of':
      return {
        mode: 'percent-of',
        value: parseFiniteNumber(fields.value, 'Value'),
        percent: parseFiniteNumber(fields.percent, 'Percent'),
      };
    default:
      throw new ToolError(`Unknown percentage mode: ${fields.mode}`);
  }
}
