import type { ToolDefinition, ToolField, ToolResult } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { generateWireguard } from '@devtoolora/functions/network';
import { withToolErrorAsync } from '../../../adapters/errors';
import { booleanField, choiceField, rangeField } from '../../../adapters/fields';

const modes = ['config', 'keys'] as const;
const allowedChoices = ['full', 'vpn', 'custom'] as const;
const configOnly = { field: 'mode', is: ['config'] };

const fields: ToolField[] = [
  {
    defaultValue: 'config',
    id: 'mode',
    label: 'Mode',
    options: [
      { label: 'Server and clients', value: 'config' },
      { label: 'Key pair', value: 'keys' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  {
    id: 'privateKey',
    label: 'Private key',
    placeholder: 'Leave empty to generate a new key pair',
    type: 'password',
    visibleWhen: { field: 'mode', is: ['keys'] },
  },
  {
    id: 'endpoint',
    label: 'Endpoint',
    placeholder: 'vpn.example.com',
    required: true,
    type: 'text',
    visibleWhen: configOnly,
  },
  {
    defaultValue: '51820',
    id: 'listenPort',
    label: 'Listen port',
    range: { max: 65_535, min: 1 },
    type: 'number',
    visibleWhen: configOnly,
  },
  {
    defaultValue: '10.8.0.0/24',
    id: 'subnet',
    label: 'IPv4 subnet',
    type: 'text',
    visibleWhen: configOnly,
  },
  {
    id: 'subnet6',
    label: 'IPv6 subnet',
    placeholder: 'fd00:8::/64',
    type: 'text',
    visibleWhen: configOnly,
  },
  rangeField({
    defaultValue: '3',
    id: 'clients',
    label: 'Clients',
    max: 50,
    min: 1,
    visibleWhen: configOnly,
  }),
  {
    defaultValue: 'full',
    id: 'clientAllowedIps',
    label: 'Client AllowedIPs',
    options: [
      { label: 'Full tunnel', value: 'full' },
      { label: 'VPN subnet only', value: 'vpn' },
      { label: 'Custom', value: 'custom' },
    ],
    type: 'select',
    visibleWhen: configOnly,
  },
  {
    id: 'customAllowedIps',
    label: 'Custom AllowedIPs',
    placeholder: '192.168.1.0/24',
    rows: 4,
    type: 'textarea',
    visibleWhen: [configOnly, { field: 'clientAllowedIps', is: ['custom'] }],
  },
  {
    id: 'dns',
    label: 'DNS',
    placeholder: '10.8.0.1, 1.1.1.1',
    type: 'text',
    visibleWhen: configOnly,
  },
  {
    defaultValue: '25',
    id: 'keepalive',
    label: 'PersistentKeepalive',
    range: { max: 65_535, min: 0, unit: 's' },
    type: 'number',
    visibleWhen: configOnly,
  },
  {
    defaultValue: 'true',
    id: 'presharedKeys',
    label: 'Preshared keys',
    type: 'checkbox',
    visibleWhen: configOnly,
  },
  {
    id: 'natInterface',
    label: 'NAT interface',
    placeholder: 'eth0',
    type: 'text',
    visibleWhen: configOnly,
  },
];

/** Digits only, so "1e3" or "0x10" fail in the function; a missing value takes the default. */
function whole(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;

  return /^[0-9]{1,9}$/.test(value.trim()) ? Number(value) : Number.NaN;
}

const sample = (label: string, values: Record<string, string>) => ({ fields: values, label });

const canonicalSamples = [
  sample('Three clients, full tunnel', { endpoint: 'vpn.example.com', mode: 'config' }),
  sample('VPN subnet only', {
    clientAllowedIps: 'vpn',
    clients: '2',
    endpoint: 'vpn.example.com',
    mode: 'config',
  }),
  sample('Dual stack with NAT', {
    clients: '2',
    endpoint: 'vpn.example.com',
    mode: 'config',
    natInterface: 'eth0',
    subnet6: 'fd00:8::/64',
  }),
  sample('Custom routes and DNS', {
    clientAllowedIps: 'custom',
    customAllowedIps: '192.168.1.0/24\n10.20.0.0/16',
    dns: '1.1.1.1, 9.9.9.9',
    endpoint: '203.0.113.10',
    mode: 'config',
  }),
  sample('One client without preshared keys', {
    clients: '1',
    endpoint: 'vpn.example.com',
    mode: 'config',
    presharedKeys: 'false',
  }),
  sample('Key pair only', { mode: 'keys' }),
];

export const wireguardConfigGeneratorTool: ToolDefinition = {
  autoRun: false,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Network',
  description:
    'Generate a WireGuard server wg0.conf and client files with X25519 keys, preshared keys, IPv4 and IPv6 addresses, DNS, keep-alive and NAT rules, or just a key pair.',
  fields,
  freshResults: true,
  id: 'wireguard-config-generator',
  inputKind: 'none',
  keywords: ['wireguard', 'wg0.conf', 'vpn config', 'wg genkey', 'x25519', 'peer config'],
  name: 'WireGuard Config Generator',
  outputKind: 'text',
  relatedToolIds: ['ipv4-subnet', 'cidr-aggregator', 'qr-code-generator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields: values }) =>
    withToolErrorAsync(async () => {
      const mode = choiceField(values.mode, 'config', modes, 'Choose a listed Mode value.');

      if (mode === 'keys')
        return toResult(await generateWireguard({ mode, privateKey: values.privateKey ?? '' }));

      const clientAllowedIps = choiceField(
        values.clientAllowedIps,
        'full',
        allowedChoices,
        'Choose a listed Client AllowedIPs value.',
      );

      return toResult(
        await generateWireguard({
          clientAllowedIps,
          clients: whole(values.clients, 3),
          customAllowedIps: clientAllowedIps === 'custom' ? (values.customAllowedIps ?? '') : '',
          dns: values.dns ?? '',
          endpoint: values.endpoint ?? '',
          keepalive: whole(values.keepalive, 25),
          listenPort: whole(values.listenPort, 51_820),
          mode,
          natInterface: values.natInterface ?? '',
          presharedKeys: booleanField(values.presharedKeys, true),
          subnet: values.subnet ?? '10.8.0.0/24',
          subnet6: values.subnet6 ?? '',
        }),
      );
    }),
  samples: canonicalSamples,
  supportsSelection: false,
};

function toResult({
  files,
  summary,
  text,
}: Awaited<ReturnType<typeof generateWireguard>>): ToolResult {
  const [first, ...rest] = files.map((file) => ({
    base64: encodeBase64Text(file.text),
    fileName: file.name,
    mimeType: 'text/plain;charset=utf-8',
  }));

  return {
    artifact: first,
    artifacts: rest.length > 0 ? rest : undefined,
    language: 'ini',
    noWrap: true,
    summary,
    text,
  };
}

export const wireguardKeyGeneratorTool: ToolDefinition = {
  ...wireguardConfigGeneratorTool,
  aliasOf: 'wireguard-config-generator',
  description:
    'Generate a WireGuard X25519 private and public key pair, or derive the public key from a private key, locally.',
  fields: fields.map((field) => (field.id === 'mode' ? { ...field, defaultValue: 'keys' } : field)),
  id: 'wireguard-key-generator',
  name: 'WireGuard Key Generator',
  samples: [
    sample('New key pair', { mode: 'keys' }),
    sample('Public key from the RFC 7748 private key', {
      mode: 'keys',
      privateKey: 'dwdtCnMYpX08FsFyUbJmRd9ML4frwJkqsXf7pR25LCo=',
    }),
    ...canonicalSamples.slice(0, 4),
  ],
};
