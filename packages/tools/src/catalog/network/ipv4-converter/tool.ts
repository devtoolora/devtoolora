import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { convertIpv4, type Ipv4InputFormat } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

export const ipv4ConverterTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Read dotted decimal, integer, hex or binary IPv4 and compare all four representations.',
  samples: [
    { fields: { format: 'dotted' }, label: 'Local IP', text: '192.168.1.10' },
    { fields: { format: 'integer' }, label: 'Unsigned integer', text: '3232235786' },
    { fields: { format: 'hex' }, label: 'Hex input', text: '0xC0A8010A' },
    {
      fields: { format: 'binary' },
      label: 'Binary octets',
      text: '11000000.10101000.00000001.00001010',
    },
    { fields: { format: 'binary' }, label: 'Short binary', text: '0b10' },
    { fields: { format: 'dotted' }, label: 'Maximum IPv4 value', text: '255.255.255.255' },
  ],
  fields: [
    {
      defaultValue: 'dotted',
      help: 'Choose explicitly: unprefixed 10 means different values in decimal, hex and binary.',
      id: 'format',
      label: 'Input format',
      options: [
        { label: 'Dotted decimal', value: 'dotted' },
        { label: 'Integer', value: 'integer' },
        { label: 'Hex', value: 'hex' },
        { label: 'Binary', value: 'binary' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'ipv4-converter',
  inputKind: 'text',
  keywords: ['ip address', 'dotted decimal', 'integer', 'hex', 'binary', 'ip to number'],
  name: 'IPv4 Converter',
  outputKind: 'json',
  relatedToolIds: ['ipv4-subnet', 'ipv4-range', 'base-converter'],
  resultActions: actions,
  run: ({ fields, text }) =>
    withToolError(() => {
      const conversion = convertIpv4(text, inputFormat(fields.format));

      return result(
        JSON.stringify(conversion, null, 2),
        'ipv4-conversion.json',
        'json',
        'IPv4 converted · ' + conversion.dotted + '.',
      );
    }),
  supportsSelection: true,
};

function inputFormat(value: string | undefined): Ipv4InputFormat {
  if (value === undefined || value === '' || value === 'dotted') return 'dotted';
  if (value === 'integer' || value === 'hex' || value === 'binary') return value;

  throw new ToolError('Choose dotted decimal, integer, hex or binary input.');
}
