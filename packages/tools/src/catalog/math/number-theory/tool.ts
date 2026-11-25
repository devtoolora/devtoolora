import type { ToolDefinition, ToolResult } from '@devtoolora/core';
import { factorize, gcdLcm, testPrimality } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities, mathOutput } from '../shared';

const modes = ['factorize', 'primality', 'gcd'] as const;

function runMode(mode: (typeof modes)[number], text: string): ToolResult {
  if (mode === 'primality') {
    const result = testPrimality(text);

    const notPrime = /^Result +not prime$/m.test(result.text);

    return mathOutput(result.text, 'primality', notPrime ? 'not prime' : result.result, false);
  }

  if (mode === 'gcd') {
    const result = gcdLcm(text);

    return mathOutput(result.text, 'gcd-lcm', `GCD ${result.gcd} · LCM ${result.lcm}`, false);
  }

  const result = factorize(text);
  const summary = result.factors
    .map(([prime, exponent]) => (exponent === 1 ? `${prime}` : `${prime}^${exponent}`))
    .join(' × ');

  return mathOutput(result.text, 'factorization', summary, false);
}

export const numberTheoryTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Math',
  description:
    'Factorize integers up to 2^64 - 1, test primality with Miller-Rabin, and find the GCD and LCM of a list of integers.',
  fields: [
    {
      defaultValue: 'factorize',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Factorize', value: 'factorize' },
        { label: 'Primality', value: 'primality' },
        { label: 'GCD & LCM', value: 'gcd' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'number-theory',
  inputKind: 'text',
  keywords: [
    'prime',
    'factorization',
    'factors',
    'gcd',
    'lcm',
    'divisors',
    'totient',
    'miller-rabin',
  ],
  name: 'Number Theory Calculator',
  outputKind: 'text',
  relatedToolIds: ['math-evaluator', 'base-converter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() =>
      runMode(
        choiceField(fields.mode, 'factorize', modes, 'Choose factorize, primality or GCD & LCM.'),
        text,
      ),
    ),
  samples: [
    { label: 'Factorize 360', text: '360' },
    { label: 'Factorize 2^64 - 1', text: '18446744073709551615' },
    { fields: { mode: 'primality' }, label: 'Largest 64-bit prime', text: '18446744073709551557' },
    { fields: { mode: 'primality' }, label: 'Carmichael number', text: '561' },
    {
      fields: { mode: 'primality' },
      label: 'Mersenne prime 2^127 - 1',
      text: '170141183460469231731687303715884105727',
    },
    { fields: { mode: 'gcd' }, label: 'GCD & LCM of a list', text: '84, 126, 210' },
    { fields: { mode: 'gcd' }, label: 'Negative and zero', text: '-12 18 0' },
  ],
  supportsSelection: true,
};
