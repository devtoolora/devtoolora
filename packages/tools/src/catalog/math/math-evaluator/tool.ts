import { ToolDefinition } from '@devtoolora/core';
import { evaluateExpression } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, mathOutput } from '../shared';

export const mathEvaluatorTool: ToolDefinition = {
  id: 'math-evaluator',
  keywords: [
    'calculator',
    'arithmetic',
    'expression',
    'formula',
    'scientific notation',
    'parentheses',
  ],
  name: 'Math Evaluator',
  category: 'Math',
  description:
    'Evaluate arithmetic with precedence, parentheses and scientific notation, without executing code.',

  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  samples: [
    { label: 'Expression', text: '(12 + 8) * 3 / 4' },
    { label: 'Operator precedence', text: '2 + 3 * 4' },
    { label: 'Decimal fractions', text: '.5 + 1.5' },
    { label: 'Scientific notation', text: '1e3 / 4' },
    { label: 'Signed remainder', text: '-7 % 3' },
    { label: 'Floating-point precision', text: '0.1 + 0.2' },
  ],
  relatedToolIds: ['percentage-calculator', 'base-converter', 'number-formatter'],
  run: ({ text }) =>
    withToolError(() =>
      mathOutput(
        String(evaluateExpression(text)),
        'math-result',
        'Floating-point arithmetic · % means remainder.',
        false,
      ),
    ),
};
