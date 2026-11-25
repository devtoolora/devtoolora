import type { ToolDefinition } from '@devtoolora/core';
import { inspectFloat, type FloatFormat } from '@devtoolora/functions/math';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities, mathOutput } from '../shared';

const formats: readonly FloatFormat[] = ['binary16', 'binary32', 'binary64'];

export const ieee754InspectorTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Math',
  description:
    'Show how a decimal is stored as a half, single or double precision float: bits, exact stored value, rounding error and neighbors.',
  fields: [
    {
      defaultValue: 'binary32',
      id: 'format',
      label: 'Format',
      options: [
        { label: 'Half (16-bit)', value: 'binary16' },
        { label: 'Single (32-bit)', value: 'binary32' },
        { label: 'Double (64-bit)', value: 'binary64' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'ieee754-inspector',
  inputKind: 'text',
  keywords: ['float', 'double', 'half', 'binary32', 'binary64', 'floating point', 'nan', 'bits'],
  name: 'IEEE 754 Float Inspector',
  outputKind: 'text',
  relatedToolIds: ['base-converter', 'bitwise-calculator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const format = choiceField(
        fields.format,
        'binary32',
        formats,
        'Choose half, single or double precision.',
      );
      const inspection = inspectFloat(text, format);

      return mathOutput(
        inspection.text,
        'ieee754',
        `${inspection.className} · ${inspection.hex} · ${format}`,
        false,
      );
    }),
  samples: [
    { fields: { format: 'binary32' }, label: '0.1 in single precision', text: '0.1' },
    { fields: { format: 'binary64' }, label: '0.1 in double precision', text: '0.1' },
    { fields: { format: 'binary16' }, label: 'Largest half', text: '65504' },
    { fields: { format: 'binary32' }, label: 'Smallest subnormal', text: '0x00000001' },
    { fields: { format: 'binary32' }, label: 'Negative zero', text: '-0' },
    { fields: { format: 'binary16' }, label: 'Signaling NaN', text: '0x7d00' },
    { fields: { format: 'binary64' }, label: 'Overflow to infinity', text: '1e309' },
  ],
  supportsSelection: true,
};
