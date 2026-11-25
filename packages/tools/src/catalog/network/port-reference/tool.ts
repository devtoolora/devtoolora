import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { lookupPorts, type PortProtocolFilter } from '@devtoolora/functions/network';
import { withToolError } from '../../../adapters/errors';
import { capabilities, actions, result } from '../shared';

const protocols: PortProtocolFilter[] = ['any', 'tcp', 'udp'];

export const portReferenceTool: ToolDefinition = {
  capabilities,
  category: 'Network',
  description:
    'Look up well-known TCP and UDP ports by number, range or service name in an offline subset of the IANA registry.',
  samples: [
    { fields: { protocol: 'any' }, label: 'SSH port', text: '22' },
    { fields: { protocol: 'any' }, label: 'Search by name', text: 'postgres' },
    { fields: { protocol: 'any' }, label: 'Port range', text: '20-23' },
    { fields: { protocol: 'any' }, label: 'Unofficial use', text: '9092' },
    { fields: { protocol: 'udp' }, label: 'UDP only', text: '53' },
    { fields: { protocol: 'tcp' }, label: 'Port not in the table', text: '12345' },
  ],
  fields: [
    {
      defaultValue: 'any',
      id: 'protocol',
      label: 'Protocol',
      options: [
        { label: 'Any', value: 'any' },
        { label: 'TCP', value: 'tcp' },
        { label: 'UDP', value: 'udp' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'port-reference',
  inputKind: 'text',
  keywords: ['tcp', 'udp', 'port number', 'iana', 'service name', 'well-known ports'],
  name: 'Port Reference',
  outputKind: 'text',
  relatedToolIds: ['random-port', 'ipv4-subnet'],
  resultActions: actions,
  run: ({ fields, text }) =>
    withToolError(() => {
      const protocol = fields.protocol || 'any';

      if (!isProtocolFilter(protocol)) throw new ToolError('Choose any, TCP or UDP.');

      const { entries, shown, text: output } = lookupPorts(text, protocol);
      const capped = entries > shown ? ' · first 500 shown' : '';
      const summary = `${entries} ${entries === 1 ? 'entry' : 'entries'}${capped} · offline subset of the IANA registry`;

      return result(output, 'port-reference.txt', 'plaintext', summary);
    }),
  supportsSelection: true,
};

function isProtocolFilter(value: string): value is PortProtocolFilter {
  return protocols.some((protocol) => protocol === value);
}
