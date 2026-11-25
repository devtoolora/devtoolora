import { type ToolDefinition } from '@devtoolora/core';
import { expandIpv4Range } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

export const ipv4RangeTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Expand a single IPv4 address, inclusive range or CIDR into a complete list of up to 1024 addresses.',
  samples: [
    { label: 'Small CIDR', text: '192.168.1.0/30' },
    { label: 'Host inside a CIDR', text: '192.168.1.2/30' },
    { label: 'Shorthand endpoint', text: '192.168.1.10-12' },
    { label: 'Cross an octet boundary', text: '192.168.1.254 - 192.168.2.1' },
    { label: 'Point-to-point /31', text: '203.0.113.10/31' },
    { label: 'Single address /32', text: '203.0.113.10/32' },
  ],
  id: 'ipv4-range',
  inputKind: 'text',
  keywords: ['ip range', 'cidr', 'expand', 'ip list', 'address list'],
  name: 'IPv4 Range Expander',
  outputKind: 'text',
  relatedToolIds: ['ipv4-subnet', 'ipv4-converter'],
  resultActions: actions,
  run: ({ text }) =>
    withToolError(() => {
      const addresses = expandIpv4Range(text);

      return result(
        addresses.join('\n'),
        'ipv4-range.txt',
        'plaintext',
        addresses.length + ' addresses · inclusive range, no host filtering.',
      );
    }),
  supportsSelection: true,
};
