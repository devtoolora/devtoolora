import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { createMacAddress } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { numericField } from '../../../adapters/fields';
import { capabilities, actions, result } from '../shared';

export const macGeneratorTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description: 'Generate locally administered unicast MAC addresses using secure random bytes.',
  samples: [
    { fields: { count: '1', format: 'colon' }, label: 'Generate 1 MAC address' },
    { fields: { count: '5', format: 'colon' }, label: 'Generate 5 MAC addresses' },
    { fields: { count: '12', format: 'colon' }, label: 'Generate 12 MAC addresses' },
    { fields: { count: '3', format: 'dash' }, label: 'Hyphen-separated batch' },
    { fields: { count: '3', format: 'dotted' }, label: 'Dotted batch' },
    { fields: { count: '3', format: 'plain' }, label: 'Plain hexadecimal batch' },
  ],
  fields: [
    {
      defaultValue: '5',
      help: 'Generate 1–100 candidates; invalid counts are rejected, never rounded or reduced.',
      id: 'count',
      label: 'Count',
      type: 'number',
    },
    {
      defaultValue: 'colon',
      id: 'format',
      label: 'MAC format',
      options: [
        { label: 'Colon', value: 'colon' },
        { label: 'Hyphen', value: 'dash' },
        { label: 'Dotted', value: 'dotted' },
        { label: 'Plain', value: 'plain' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'mac-generator',
  inputKind: 'none',
  keywords: ['mac address', 'random mac', 'ethernet', 'hardware address', 'locally administered'],
  name: 'MAC Address Generator',
  outputKind: 'text',
  relatedToolIds: ['ipv6-ula', 'ipv4-subnet', 'uuid'],
  resultActions: actions,
  run: ({ fields }) =>
    withToolError(() => {
      const count = macCount(fields.count);
      const format = fields.format || 'colon';

      if (!['colon', 'dash', 'dotted', 'plain'].includes(format))
        throw new ToolError('Choose colon, hyphen, dotted or plain MAC format.');

      const addresses = Array.from({ length: count }, () => formatMac(createMacAddress(), format));

      return result(
        addresses.join('\n'),
        'mac-addresses.txt',
        'plaintext',
        count + ' locally administered unicast candidates · ' + format + '.',
      );
    }),
  supportsSelection: false,
};

function macCount(value: string | undefined): number {
  return numericField(value?.trim() || undefined, 'Count', 1, 100, 5);
}

function formatMac(address: string, format: string): string {
  if (format === 'colon') return address;
  if (format === 'dash') return address.replaceAll(':', '-');

  const plain = address.replaceAll(':', '');

  return format === 'dotted'
    ? plain.slice(0, 4) + '.' + plain.slice(4, 8) + '.' + plain.slice(8)
    : plain;
}
