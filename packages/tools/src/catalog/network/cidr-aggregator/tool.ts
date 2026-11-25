import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { aggregateCidrs, type CidrAggregation } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

export const cidrAggregatorTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Merge IPv4 and IPv6 addresses, CIDRs and ranges into the minimal CIDR list, or list which input lines overlap.',
  samples: [
    {
      fields: { report: 'merged' },
      label: 'Merge adjacent blocks',
      text: '10.0.0.0/24\n10.0.1.0/24\n10.0.1.128/25',
    },
    { fields: { report: 'merged' }, label: 'Range to CIDRs', text: '10.0.0.1 - 10.0.0.6' },
    {
      fields: { report: 'merged' },
      label: 'Mixed families with comments',
      text: '# office\n2001:db8::/32\n10.0.0.5/24\n\n192.168.0.0/24',
    },
    { fields: { report: 'merged' }, label: 'IPv6 range', text: '2001:db8::-2001:db8::ff' },
    {
      fields: { report: 'overlaps' },
      label: 'Find overlapping lines',
      text: '10.0.0.0/24\n10.0.0.128/25\n10.0.0.100-10.0.1.5',
    },
    {
      fields: { report: 'overlaps' },
      label: 'Check a clean list',
      text: '10.0.0.0/24\n10.0.1.0/24\n2001:db8::/48',
    },
  ],
  fields: [
    {
      defaultValue: 'merged',
      id: 'report',
      label: 'Report',
      options: [
        { label: 'Merged CIDRs', value: 'merged' },
        { label: 'Overlaps', value: 'overlaps' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'cidr-aggregator',
  inputKind: 'text',
  keywords: ['cidr merge', 'summarize', 'supernet', 'ip ranges', 'overlap', 'deduplicate'],
  name: 'CIDR Aggregator & Overlap Checker',
  outputKind: 'text',
  relatedToolIds: ['ipv4-subnet', 'ipv6-subnet', 'ipv4-range'],
  resultActions: actions,
  run: ({ fields, text }) =>
    withToolError(() => {
      const report = fields.report || 'merged';

      if (report !== 'merged' && report !== 'overlaps')
        throw new ToolError('Choose merged CIDRs or overlaps.');

      const aggregation = aggregateCidrs(text);
      const overlaps = `${aggregation.overlaps.join('\n') || 'No overlapping lines.'}\n`;
      const output = report === 'merged' ? `${aggregation.merged.join('\n')}\n` : overlaps;

      return result(output, 'cidr-aggregator.txt', 'plaintext', summarize(aggregation));
    }),
  supportsSelection: true,
};

function summarize({
  inputCount,
  merged,
  overlapCount,
  overlapsTruncated,
}: CidrAggregation): string {
  const pairs = overlapsTruncated
    ? 'more than 1,000 overlapping pairs'
    : count(overlapCount, 'overlapping pair');

  return `${count(inputCount, 'input')} → ${count(merged.length, 'CIDR')} · ${pairs}`;
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}
