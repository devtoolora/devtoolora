import { ToolDefinition, ToolError, ToolResult } from '@devtoolora/core';
import { calculateFinance } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, parseFiniteNumber, mathOutput } from '../shared';

export const financialCalculatorTool: ToolDefinition = {
  id: 'financial-calculator',
  keywords: [
    'loan',
    'mortgage',
    'monthly payment',
    'amortization',
    'compound interest',
    'interest rate',
    'savings',
  ],
  name: 'Loan & Compound Calculator',
  category: 'Math',
  description:
    'Estimate fixed-rate monthly principal-and-interest payments or annual compound growth with explicit assumptions.',

  inputKind: 'none',
  outputKind: 'json',
  supportsSelection: false,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      id: 'mode',
      label: 'Calculation',
      type: 'select',
      defaultValue: 'compound',
      options: [
        { label: 'Compound interest', value: 'compound' },
        { label: 'Loan payment', value: 'loan' },
      ],
    },
    {
      help: 'Nonnegative amount in one currency unit; fees are excluded.',
      id: 'principal',
      label: 'Principal',
      required: true,
      type: 'number',
    },
    {
      help: 'Nonnegative percent. Annual compounding or nominal loan rate divided by 12.',
      id: 'rate',
      label: 'Annual rate (%)',
      required: true,
      type: 'number',
    },
    {
      help: 'Positive years. Loan duration must equal a whole number of months.',
      id: 'years',
      label: 'Years',
      required: true,
      type: 'number',
    },
  ],
  samples: [
    {
      label: 'Mortgage / loan $250,000 at 5.5% for 30 yrs',
      fields: { mode: 'loan', principal: '250000', rate: '5.5', years: '30' },
    },
    {
      label: 'Compound growth $10,000 at 7% for 10 yrs',
      fields: { mode: 'compound', principal: '10000', rate: '7', years: '10' },
    },
    {
      label: 'Zero-interest loan',
      fields: { mode: 'loan', principal: '1200', rate: '0', years: '1' },
    },
    {
      label: 'Annual compounding example',
      fields: { mode: 'compound', principal: '1000', rate: '10', years: '2' },
    },
    {
      label: 'Monthly loan example',
      fields: { mode: 'loan', principal: '1200', rate: '12', years: '1' },
    },
    {
      label: 'No-interest growth',
      fields: { mode: 'compound', principal: '1000', rate: '0', years: '10' },
    },
  ],
  relatedToolIds: ['percentage-calculator', 'math-evaluator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => withToolError(() => financialFunctionResult(fields)),
};

function financialFunctionResult(fields: Record<string, string>): ToolResult {
  const principal = parseFiniteNumber(fields.principal, 'Principal');
  const rate = parseFiniteNumber(fields.rate, 'Annual rate');
  const years = parseFiniteNumber(fields.years, 'Years');
  const mode = fields.mode ?? 'compound';

  if (mode !== 'loan' && mode !== 'compound')
    throw new ToolError('Choose compound interest or loan payment.');

  const amounts = calculateFinance(mode, principal, rate, years);
  const report = {
    ...amounts,
    assumptions: {
      annualRatePercent: rate,
      compounding: mode === 'compound' ? 'annual' : 'monthly payments; nominal annual rate / 12',
      principal,
      years,
    },
    mode,
  };

  return mathOutput(
    JSON.stringify(report, null, 2),
    'financial-calculation',
    mode === 'loan'
      ? `Monthly payment: ${amounts.monthlyPayment} · Principal and interest only; excludes fees, tax and insurance.`
      : `Future value: ${amounts.futureValue} · Annual compounding; one deposit; no forecast or guarantee.`,
    true,
  );
}
