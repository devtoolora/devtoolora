import type { ToolDefinition } from '@devtoolora/core';
import {
  calculateBitwise,
  type BitwiseOperation,
  type BitwiseWidth,
} from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';

const operations: readonly BitwiseOperation[] = [
  'and',
  'or',
  'xor',
  'nand',
  'nor',
  'xnor',
  'not',
  'shl',
  'shr',
  'sar',
  'rol',
  'ror',
  'add',
  'sub',
  'mul',
  'udiv',
  'urem',
  'sdiv',
  'srem',
];
const widths = ['8', '16', '32', '64'] as const;

const sample = (label: string, a: string, operation: string, b: string, width = '32') => ({
  fields: { a, b, operation, width },
  label,
});

export const bitwiseCalculatorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Apply arithmetic, AND, OR, XOR, NOT, shifts and rotates to 8, 16, 32 or 64-bit values, with carry and overflow flags, in hex, decimal and binary.',
  fields: [
    {
      defaultValue: '12',
      id: 'a',
      label: 'A',
      required: true,
      type: 'text',
    },
    {
      defaultValue: 'and',
      id: 'operation',
      label: 'Operation',
      options: [
        { label: 'AND', value: 'and' },
        { label: 'OR', value: 'or' },
        { label: 'XOR', value: 'xor' },
        { label: 'NAND', value: 'nand' },
        { label: 'NOR', value: 'nor' },
        { label: 'XNOR', value: 'xnor' },
        { label: 'NOT', value: 'not' },
        { label: 'Shift left', value: 'shl' },
        { label: 'Logical shift right', value: 'shr' },
        { label: 'Arithmetic shift right', value: 'sar' },
        { label: 'Rotate left', value: 'rol' },
        { label: 'Rotate right', value: 'ror' },
        { label: 'Add', value: 'add' },
        { label: 'Subtract', value: 'sub' },
        { label: 'Multiply', value: 'mul' },
        { label: 'Divide (unsigned)', value: 'udiv' },
        { label: 'Remainder (unsigned)', value: 'urem' },
        { label: 'Divide (signed)', value: 'sdiv' },
        { label: 'Remainder (signed)', value: 'srem' },
      ],
      type: 'select',
    },
    {
      defaultValue: '10',
      id: 'b',
      label: 'B or shift amount',
      type: 'text',
      visibleWhen: { field: 'operation', isNot: ['not'] },
    },
    {
      defaultValue: '32',
      id: 'width',
      label: 'Width',
      options: [
        { label: '8 bits', value: '8' },
        { label: '16 bits', value: '16' },
        { label: '32 bits', value: '32' },
        { label: '64 bits', value: '64' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'bitwise-calculator',
  inputKind: 'none',
  keywords: ['bitwise', 'bit', 'xor', 'shift', 'rotate', 'binary', 'two’s complement', 'mask'],
  name: 'Bitwise Calculator',
  outputKind: 'text',
  relatedToolIds: ['base-converter', 'chmod-calculator', 'math-evaluator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) =>
    withToolError(() => {
      const operation = choiceField(fields.operation, 'and', operations, 'Choose an operation.');
      const width = Number(
        choiceField(fields.width, '32', widths, 'Choose 8, 16, 32 or 64 bits.'),
      ) as BitwiseWidth;
      const { result, text } = calculateBitwise({
        a: fields.a ?? '',
        b: fields.b ?? '',
        operation,
        width,
      });

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName: 'bitwise.txt',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'plaintext',
        summary: `Result ${result.hex}: ${result.unsigned} unsigned, ${result.signed} signed.`,
        text,
      };
    }),
  samples: [
    sample('12 AND 10', '12', 'and', '0b1010'),
    sample('Flags OR, 8-bit', '0b0001_0000', 'or', '0b0000_0101', '8'),
    sample('XOR swap check', '0xDEADBEEF', 'xor', '0xFFFFFFFF'),
    sample('NOT -1 at 8 bits', '-1', 'not', '', '8'),
    sample('Shift left by 4', '0x0F', 'shl', '4', '16'),
    sample('Arithmetic shift of a negative', '-128', 'sar', '3', '8'),
    sample('Rotate left, 32-bit', '0x80000001', 'rol', '1'),
    sample('Add with carry, 8-bit', '200', 'add', '100', '8'),
    sample('Exact 64-bit mask', '0xFFFFFFFFFFFFFFFF', 'xor', '1', '64'),
  ],
  supportsSelection: false,
};

export const programmerCalculatorTool: ToolDefinition = {
  ...bitwiseCalculatorTool,
  aliasOf: 'bitwise-calculator',
  fields: bitwiseCalculatorTool.fields?.map((field) =>
    field.id === 'operation' ? { ...field, defaultValue: 'add' } : field,
  ),
  id: 'programmer-calculator',
  name: 'Programmer Calculator',
};
