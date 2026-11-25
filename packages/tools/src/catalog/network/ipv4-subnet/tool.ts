import { type ToolDefinition } from '@devtoolora/core';
import { calculateIpv4Subnet } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

export const ipv4SubnetTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Calculate aligned CIDR boundaries, masks and host counts, including /31 and /32 cases.',
  samples: [
    { label: 'Home network /24', text: '192.168.1.10/24' },
    { label: 'Private cloud VPC /16', text: '10.0.0.0/16' },
    { label: 'Point-to-point /30', text: '172.16.0.5/30' },
    { label: 'Point-to-point /31', text: '203.0.113.10/31' },
    { label: 'Host route /32', text: '203.0.113.10/32' },
    { label: 'Whole IPv4 space /0', text: '0.0.0.0/0' },
  ],
  id: 'ipv4-subnet',
  inputKind: 'text',
  keywords: [
    'cidr',
    'netmask',
    'subnet mask',
    'wildcard mask',
    'network address',
    'broadcast',
    'hosts',
  ],
  name: 'IPv4 Subnet Calculator',
  outputKind: 'json',
  relatedToolIds: ['ipv4-range', 'ipv4-converter'],
  resultActions: actions,
  run: ({ text }) =>
    withToolError(() => {
      const subnet = calculateIpv4Subnet(text);

      return result(
        JSON.stringify(subnet, null, 2),
        'ipv4-subnet.json',
        'json',
        subnet.cidr +
          ' · ' +
          subnet.totalAddresses +
          ' total · ' +
          subnet.hostCount +
          ' hosts under the stated model.',
      );
    }),
  supportsSelection: true,
};
