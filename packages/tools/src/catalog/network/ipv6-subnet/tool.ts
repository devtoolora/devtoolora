import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { calculateIpv6Subnet, ipv6SubnetListLimit } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

export const ipv6SubnetTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Calculate an IPv6 prefix: network, mask, first and last address, size and optional split subnets.',
  samples: [
    { fields: { split: '' }, label: 'Site prefix /48', text: '2001:db8:abcd:12::/48' },
    { fields: { split: '64' }, label: 'Four /64 subnets', text: '2001:db8::/62' },
    { fields: { split: '/56' }, label: 'Provider /32 into /56', text: '2001:db8::/32' },
    { fields: { split: '' }, label: 'Unique local /48', text: 'fd00:1234:5678::/48' },
    { fields: { split: '' }, label: 'Single host /128', text: '2001:db8::1/128' },
    { fields: { split: '' }, label: 'Whole IPv6 space /0', text: '::/0' },
  ],
  fields: [
    {
      defaultValue: '',
      help: 'Optional prefix length from the input prefix to /128; accepts 64 or /64.',
      id: 'split',
      label: 'Split into prefix',
      placeholder: '/64',
      type: 'text',
    },
  ],
  id: 'ipv6-subnet',
  inputKind: 'text',
  keywords: ['ipv6 prefix', 'cidr', 'subnet', 'netmask', '/64', 'split'],
  name: 'IPv6 Subnet Calculator',
  outputKind: 'text',
  relatedToolIds: ['ipv6-converter', 'ipv4-subnet', 'ipv6-ula'],
  resultActions: actions,
  run: ({ fields, text }) =>
    withToolError(() => {
      const subnet = calculateIpv6Subnet(text, splitPrefix(fields.split));
      const hostBits = subnet.hostBitsSet ? ' · host bits ignored' : '';
      const truncated =
        subnet.subnetTotal > BigInt(ipv6SubnetListLimit)
          ? ` · first 1,024 of ${subnet.subnetTotal} subnets listed`
          : '';
      const noun = subnet.total === 1n ? 'address' : 'addresses';

      return result(
        subnet.text,
        'ipv6-subnet.txt',
        'plaintext',
        `${subnet.total} ${noun}${hostBits}${truncated}`,
      );
    }),
  supportsSelection: true,
};

function splitPrefix(value: string | undefined): number | undefined {
  const text = (value ?? '').trim().replace(/^\//, '');

  if (text === '') return undefined;
  if (!/^\d{1,3}$/.test(text))
    throw new ToolError('Split prefix must be a whole number such as 64 or /64.');

  return Number(text);
}
