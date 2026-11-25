import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { generateIpv6UlaPlan } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

export const ipv6UlaTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Generate a correctly grouped local fd00::/8 site prefix with a random 40-bit Global ID.',
  samples: [
    { fields: { report: 'prefix' }, label: 'Generate a unique local address' },
    { fields: { report: 'json' }, label: 'Site, subnet and host report' },
    { fields: { report: 'prefix' }, label: 'Home lab site prefix' },
    { fields: { report: 'prefix' }, label: 'Site-to-site VPN prefix' },
    { fields: { report: 'json' }, label: 'Container network plan' },
    { fields: { report: 'json' }, label: 'Router configuration report' },
  ],
  fields: [
    {
      defaultValue: 'prefix',
      id: 'report',
      label: 'Output',
      options: [
        { label: 'Site prefix', value: 'prefix' },
        { label: 'Planning report', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'ipv6-ula',
  inputKind: 'none',
  keywords: ['unique local address', 'fd00', 'private ipv6', 'prefix', 'rfc 4193'],
  name: 'IPv6 ULA Generator',
  outputKind: 'text',
  relatedToolIds: ['mac-generator', 'ipv4-subnet'],
  resultActions: actions,
  run: ({ fields }) =>
    withToolError(() => {
      const report = fields.report || 'prefix';

      if (report !== 'prefix' && report !== 'json')
        throw new ToolError('Choose site prefix or planning report.');

      const plan = generateIpv6UlaPlan();

      return result(
        report === 'json' ? JSON.stringify(plan, null, 2) : plan.prefix,
        report === 'json' ? 'ipv6-ula-plan.json' : 'ipv6-ula-prefix.txt',
        report === 'json' ? 'json' : 'plaintext',
        'New random /48 candidate · record and check before deployment.',
      );
    }),
  supportsSelection: false,
};
