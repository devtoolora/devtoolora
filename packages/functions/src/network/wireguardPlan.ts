import { FunctionError } from '../errors';
import { assertSingleLine } from '../validation';
import { aggregateCidrs } from './cidr';
import { isDnsName } from './hostname';
import { calculateIpv4Subnet, intToIpv4, ipv4ToInt } from './ipv4';
import { formatIpv6, parseIpv6 } from './ipv6';

export interface ConfigOptions {
  clientAllowedIps: 'custom' | 'full' | 'vpn';
  clients: number;
  customAllowedIps: string;
  dns: string;
  endpoint: string;
  keepalive: number;
  listenPort: number;
  mode: 'config';
  natInterface: string;
  presharedKeys: boolean;
  subnet: string;
  subnet6: string;
}

interface Network {
  cidr: string;
  clientIps: string[];
  prefix: number;
  serverIp: string;
}

export interface Plan {
  allowedIps: string;
  dns: string;
  endpoint: string;
  nat: string;
  psk: boolean;
  v4: Network;
  v6: Network | null;
}

const ipv4Shape = /^[0-9]{1,3}(?:\.[0-9]{1,3}){3}$/;
const entryShape = /^[0-9A-Fa-f:.]+\/[0-9]{1,3}$/;
const interfaceShape = /^[A-Za-z0-9_.-]{1,15}$/;
const customLimit = 64;
const dnsLimit = 4;

export const fail = (code: string, message: string): FunctionError =>
  new FunctionError(code, message);

function wholeNumber(value: number, label: string, min: number, max: number): number {
  if (Number.isInteger(value) && value >= min && value <= max) return value;

  throw fail(
    'INVALID_NUMBER',
    `${label} must be a whole number from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}.`,
  );
}

export function singleLine(raw: string, label: string): string {
  assertSingleLine(raw, label);

  return raw.trim();
}

function ipv6Value(text: string): bigint | null {
  if (/[[\]%/]/.test(text)) return null;

  try {
    return parseIpv6(text).value;
  } catch {
    return null;
  }
}

function ipv4Valid(text: string): boolean {
  if (!ipv4Shape.test(text)) return false;

  try {
    ipv4ToInt(text);

    return true;
  } catch {
    return false;
  }
}

function endpointHost(raw: string): string {
  const value = singleLine(raw, 'Endpoint');

  if (value === '') throw fail('REQUIRED_STRING', 'Endpoint is required.');

  const address = ipv6Value(value);

  if (address === 0n)
    throw fail('INVALID_ENDPOINT', 'Endpoint must not be the unspecified address ::.');
  if (address !== null) return `[${formatIpv6(address, 'compressed')}]`;
  if (value === '0.0.0.0')
    throw fail('INVALID_ENDPOINT', 'Endpoint must not be the unspecified address 0.0.0.0.');
  if (ipv4Valid(value) || isDnsName(value)) return value;
  if (value.includes(':') && !value.includes('%') && !value.endsWith(']'))
    throw fail('ENDPOINT_PORT', 'Endpoint must not include a port; set Listen port instead.');

  throw fail(
    'INVALID_ENDPOINT',
    'Endpoint must be a DNS name, an IPv4 address or an IPv6 address.',
  );
}

function planIpv4(raw: string, clients: number): Network {
  const value = singleLine(raw, 'IPv4 subnet');
  const parts = value.split('/');
  const shapeError = fail('INVALID_SUBNET', 'IPv4 subnet must be a CIDR such as 10.8.0.0/24.');

  if (parts.length !== 2 || !ipv4Shape.test(parts[0] ?? '') || !/^[0-9]{1,2}$/.test(parts[1] ?? ''))
    throw shapeError;

  const prefix = Number(parts[1]);

  if (prefix < 8 || prefix > 30)
    throw fail('INVALID_PREFIX', 'IPv4 subnet prefix must be from /8 to /30.');

  let subnet;

  try {
    subnet = calculateIpv4Subnet(value);
  } catch {
    throw shapeError;
  }

  if (subnet.networkAddress !== parts[0])
    throw fail('HOST_BITS', `Use the network address ${subnet.cidr}.`);

  const room = 2 ** (32 - prefix) - 3;

  if (clients > room)
    throw fail(
      'SUBNET_TOO_SMALL',
      `${subnet.cidr} has room for ${room} ${room === 1 ? 'peer' : 'peers'}; ${clients} are needed.`,
    );

  const first = ipv4ToInt(subnet.networkAddress) + 1;

  return {
    cidr: subnet.cidr,
    clientIps: Array.from({ length: clients }, (_, index) => intToIpv4(first + 1 + index)),
    prefix,
    serverIp: intToIpv4(first),
  };
}

function planIpv6(raw: string, clients: number): Network | null {
  const value = singleLine(raw, 'IPv6 subnet');

  if (value === '') return null;

  const parts = value.split('/');
  const base = ipv6Value(parts[0] ?? '');
  const shapeError = fail('INVALID_SUBNET', 'IPv6 subnet must be a prefix such as fd00:8::/64.');

  if (parts.length !== 2 || base === null || !/^[0-9]{1,3}$/.test(parts[1] ?? '')) throw shapeError;

  const prefix = Number(parts[1]);

  if (prefix < 48 || prefix > 120)
    throw fail('INVALID_PREFIX', 'IPv6 subnet prefix must be from /48 to /120.');

  const hostBits = BigInt(128 - prefix);
  const network = (base >> hostBits) << hostBits;

  if (network !== base)
    throw fail(
      'HOST_BITS',
      `Use the network address ${formatIpv6(network, 'compressed')}/${prefix}.`,
    );

  const at = (offset: number): string => formatIpv6(network + BigInt(offset), 'compressed');

  return {
    cidr: `${formatIpv6(network, 'compressed')}/${prefix}`,
    clientIps: Array.from({ length: clients }, (_, index) => at(index + 2)),
    prefix,
    serverIp: at(1),
  };
}

function customAllowed(raw: string): string {
  const lines = raw.split(/\r?\n/).map((line) => singleLine(line, 'Custom AllowedIPs'));
  const entries = lines.filter((line) => line !== '');

  if (entries.length === 0)
    throw fail('REQUIRED_STRING', 'Custom AllowedIPs needs at least one CIDR.');
  if (entries.length > customLimit)
    throw fail('TOO_MANY_ENTRIES', 'Custom AllowedIPs is limited to 64 entries.');

  lines.forEach((line, index) => {
    if (line !== '' && !entryShape.test(line))
      throw fail(
        'INVALID_CIDR',
        `Custom AllowedIPs line ${index + 1} must be a CIDR such as 192.168.1.0/24.`,
      );
  });

  try {
    aggregateCidrs(lines.join('\n'));
  } catch (error) {
    if (error instanceof FunctionError)
      throw fail(error.code, `Custom AllowedIPs: ${error.message}`);

    throw error;
  }

  return entries.join(', ');
}

function allowedIps(options: ConfigOptions, v4: Network, v6: Network | null): string {
  if (options.clientAllowedIps === 'custom') return customAllowed(options.customAllowedIps);

  const subnets = options.clientAllowedIps === 'full' ? ['0.0.0.0/0'] : [v4.cidr];

  if (v6) subnets.push(options.clientAllowedIps === 'full' ? '::/0' : v6.cidr);

  return subnets.join(', ');
}

function dnsList(raw: string): string {
  const value = singleLine(raw, 'DNS');

  if (value === '') return '';

  const servers = value.split(',').map((server) => server.trim());

  if (servers.length > dnsLimit) throw fail('TOO_MANY_ENTRIES', 'DNS is limited to 4 servers.');

  return servers
    .map((server) => {
      const address = ipv6Value(server);

      if (address !== null) return formatIpv6(address, 'compressed');
      if (ipv4Valid(server)) return server;

      throw fail('INVALID_DNS', `DNS server "${server}" must be an IPv4 or IPv6 address.`);
    })
    .join(', ');
}

function natInterface(raw: string): string {
  const value = singleLine(raw, 'NAT interface');

  if (value !== '' && !interfaceShape.test(value))
    throw fail('INVALID_INTERFACE', 'NAT interface must be 1-15 letters, digits, "_", "." or "-".');

  return value;
}

export function planConfig(options: ConfigOptions): Plan {
  const endpoint = endpointHost(options.endpoint);
  const port = wholeNumber(options.listenPort, 'Listen port', 1, 65_535);
  const clients = wholeNumber(options.clients, 'Clients', 1, 50);
  const v4 = planIpv4(options.subnet, clients);
  const v6 = planIpv6(options.subnet6, clients);
  const allowed = allowedIps(options, v4, v6);
  const dns = dnsList(options.dns);

  wholeNumber(options.keepalive, 'PersistentKeepalive', 0, 65_535);

  return {
    allowedIps: allowed,
    dns,
    endpoint: `${endpoint}:${port}`,
    nat: natInterface(options.natInterface),
    psk: options.presharedKeys,
    v4,
    v6,
  };
}
