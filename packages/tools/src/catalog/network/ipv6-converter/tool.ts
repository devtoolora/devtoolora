import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { convertIpv6, type Ipv6InputFormat } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

export const ipv6ConverterTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Compress, expand and classify one IPv6 address, with its hex, integer, binary and PTR forms.',
  samples: [
    {
      fields: { format: 'address' },
      label: 'Documentation address',
      text: '2001:0db8:0000:0000:0000:ff00:0042:8329',
    },
    { fields: { format: 'address' }, label: 'Link-local with zone', text: '[fe80::1%eth0]' },
    { fields: { format: 'address' }, label: 'IPv4-mapped', text: '::ffff:192.0.2.1' },
    {
      fields: { format: 'address' },
      label: 'Teredo',
      text: '2001:0:4136:e378:8000:63bf:3fff:fdd2',
    },
    {
      fields: { format: 'hex' },
      label: '32 hex digits',
      text: '0x20010db8000000000000000000000001',
    },
    { fields: { format: 'integer' }, label: 'Integer', text: '281473902969345' },
  ],
  fields: [
    {
      defaultValue: 'address',
      help: 'Choose explicitly: 32 hex digits and a decimal integer are not guessed from the digits.',
      id: 'format',
      label: 'Input format',
      options: [
        { label: 'Address', value: 'address' },
        { label: '32 hex digits', value: 'hex' },
        { label: 'Integer', value: 'integer' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'ipv6-converter',
  inputKind: 'text',
  keywords: ['ipv6 address', 'compress', 'expand', 'ptr', 'reverse dns', 'ip6.arpa'],
  name: 'IPv6 Address Converter',
  outputKind: 'text',
  relatedToolIds: ['ipv6-ula', 'ipv4-converter'],
  resultActions: actions,
  run: ({ fields, text }) =>
    withToolError(() => {
      const conversion = convertIpv6(text, inputFormat(fields.format));
      const zone = conversion.zone === undefined ? '' : ` · zone ${conversion.zone}`;

      return result(
        conversion.text,
        'ipv6-conversion.txt',
        'plaintext',
        `${conversion.type} · compressed ${conversion.compressed}${zone}`,
      );
    }),
  supportsSelection: true,
};

function inputFormat(value: string | undefined): Ipv6InputFormat {
  if (value === undefined || value === '' || value === 'address') return 'address';
  if (value === 'hex' || value === 'integer') return value;

  throw new ToolError('Choose address, 32 hex digits or integer input.');
}
