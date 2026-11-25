import { ToolDefinition, ToolError } from '@devtoolora/core';
import { convertBase as convertNumericBase } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { browserSafeCapabilities } from '../shared';

export const baseConverterTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Math',
  description: 'Convert whole numbers exactly between bases 2–36, without rounding large integers.',
  samples: [
    { fields: { from: '16', report: 'value', to: '10', value: 'ff' }, label: 'Hex FF' },
    {
      fields: { from: '2', report: 'value', to: '16', value: '0b11111111' },
      label: 'Binary prefix',
    },
    {
      fields: { from: '8', report: 'value', to: '10', value: '0755' },
      label: 'Octal permissions',
    },
    {
      fields: { from: '10', report: 'json', to: '16', value: '18446744073709551615' },
      label: 'Exact 64-bit integer',
    },
    { fields: { from: '10', report: 'value', to: '2', value: '-42' }, label: 'Negative integer' },
    { fields: { from: '36', report: 'value', to: '10', value: 'zz' }, label: 'Base 36 letters' },
  ],
  fields: [
    {
      help: 'A whole number, optionally signed. Matching 0b, 0o and 0x prefixes are accepted. No decimal point, separators or internal spaces.',
      id: 'value',
      label: 'Value',
      placeholder: 'ff',
      type: 'text',
    },
    {
      defaultValue: '16',
      help: 'The base used by the input: binary 2, octal 8, decimal 10, hex 16 or any integer up to 36.',
      id: 'from',
      label: 'From base',
      type: 'number',
    },
    {
      defaultValue: '10',
      help: 'The output uses lowercase letters a–z for digits 10–35.',
      id: 'to',
      label: 'To base',
      type: 'number',
    },
    {
      defaultValue: 'value',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Converted value', value: 'value' },
        { label: 'JSON report', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'base-converter',
  inputKind: 'none',
  keywords: ['radix', 'binary', 'octal', 'hexadecimal', 'decimal', 'bigint', 'integer', 'base36'],
  name: 'Base Converter',
  outputKind: 'text',
  relatedToolIds: ['text-binary', 'hex-text', 'math-evaluator'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const report = fields.report || 'value';

      if (report !== 'value' && report !== 'json')
        throw new ToolError('Choose converted value or JSON report.');

      const conversion = convertNumericBase(
        fields.value || text,
        parseBaseField(fields.from, 16),
        parseBaseField(fields.to, 10),
      );
      const output = report === 'json' ? JSON.stringify(conversion, null, 2) : conversion.output;

      return {
        artifact: {
          base64: encodeBase64Text(output),
          fileName: `base-conversion.${report === 'json' ? 'json' : 'txt'}`,
          mimeType:
            report === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8',
        },
        language: report === 'json' ? 'json' : 'plaintext',
        summary: `Exact integer conversion · base ${conversion.fromBase} → ${conversion.toBase}.`,
        text: output,
      };
    }),
  selectionTarget: { field: 'value' },
  supportsSelection: true,
};

function parseBaseField(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  if (!/^\d+$/.test(value.trim()))
    throw new ToolError('Base must be an integer from 2 through 36.');

  return Number(value);
}
