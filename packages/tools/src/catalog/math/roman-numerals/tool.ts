import type { ToolDefinition } from '@devtoolora/core';
import { convertRomanLines } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, mathOutput } from '../shared';

export const romanNumeralsTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Math',
  description:
    'Convert numbers to Roman numerals and back, one value per line, for the range 1 to 3,999.',
  id: 'roman-numerals',
  inputKind: 'text',
  keywords: ['roman', 'numeral', 'numerals', 'convert', 'mmxxiv', 'year', 'number'],
  name: 'Roman Numeral Converter',
  outputKind: 'text',
  relatedToolIds: ['number-to-words', 'base-converter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ text }) =>
    withToolError(() => {
      const result = convertRomanLines(text);

      return mathOutput(
        result.text,
        'roman-numerals',
        `${result.valid} converted · ${result.invalid} invalid`,
        false,
      );
    }),
  samples: [
    { label: 'Year to Roman', text: '2024' },
    { label: 'Roman to number', text: 'MCMXCIV' },
    { label: 'Largest value', text: '3999' },
    { label: 'Several lines', text: '1\n4\n9\n14\n40\n90\n400\n1990' },
    { label: 'Lowercase Roman', text: 'xlii' },
    { label: 'Mixed valid and invalid', text: '2024\nIIII\n0\nhello' },
  ],
  supportsSelection: true,
};
