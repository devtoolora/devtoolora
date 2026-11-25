import { networkError, required } from './shared';

export interface Ipv4Subnet {
  broadcastAddress: string | null;
  cidr: string;
  firstHost: string;
  hostCount: number;
  ip: string;
  lastAddress: string;
  lastHost: string;
  networkAddress: string;
  prefix: number;
  subnetMask: string;
  totalAddresses: number;
  wildcardMask: string;
}

export function calculateIpv4Subnet(cidr: string): Ipv4Subnet {
  const input = required(cidr, 'CIDR');
  const match = input.match(/^([^/]+)\/(0|[1-9]\d?)$/);

  if (!match || Number(match[2]) > 32)
    throw networkError(
      'INVALID_PREFIX',
      'CIDR must contain an IPv4 address and an integer prefix from 0 through 32, for example 192.168.1.10/24.',
    );

  const ip = match[1]!;
  const prefixText = match[2];

  if (ip !== ip.trim())
    throw networkError('INVALID_IPV4', 'Whitespace inside CIDR notation is not supported.');

  const prefix = Number(prefixText);
  const ipInt = ipv4ToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipInt & mask) >>> 0;
  const totalAddresses = 2 ** (32 - prefix);
  const last = network + totalAddresses - 1;

  return {
    broadcastAddress: prefix >= 31 ? null : intToIpv4(last),
    cidr: `${intToIpv4(network)}/${prefix}`,
    firstHost: intToIpv4(prefix >= 31 ? network : network + 1),
    hostCount: prefix >= 31 ? totalAddresses : totalAddresses - 2,
    ip: intToIpv4(ipInt),
    lastAddress: intToIpv4(last),
    lastHost: intToIpv4(prefix >= 31 ? last : last - 1),
    networkAddress: intToIpv4(network),
    prefix,
    subnetMask: intToIpv4(mask),
    totalAddresses,
    wildcardMask: intToIpv4(0xffffffff - mask),
  };
}

export type Ipv4InputFormat = 'dotted' | 'integer' | 'hex' | 'binary';

export interface Ipv4Conversion {
  binary: string;
  dotted: string;
  hex: string;
  integer: number;
}

export function convertIpv4(text: string, format: Ipv4InputFormat = 'dotted'): Ipv4Conversion {
  const input = required(text, 'IPv4');
  let integer: number;

  if (format === 'dotted') integer = ipv4ToInt(input);
  else if (format === 'integer' && /^\d{1,10}$/.test(input)) integer = Number(input);
  else if (format === 'hex' && /^(?:0x)?[0-9a-f]{1,8}$/i.test(input))
    integer = parseInt(input.replace(/^0x/i, ''), 16);
  else if (format === 'binary' && /^(?:0b)?[01]{1,32}$/i.test(input))
    integer = parseInt(input.replace(/^0b/i, ''), 2);
  else if (format === 'binary' && /^(?:[01]{8}\.){3}[01]{8}$/.test(input))
    integer = parseInt(input.replaceAll('.', ''), 2);
  else
    throw networkError(
      'INVALID_IPV4',
      'Input does not match the selected IPv4 format. Use dotted decimal, an unsigned integer, up to 8 hexadecimal digits, or up to 32 binary digits.',
    );

  checkedIpv4Integer(integer);

  return {
    binary:
      integer
        .toString(2)
        .padStart(32, '0')
        .match(/.{1,8}/g)
        ?.join('.') ?? '',
    dotted: intToIpv4(integer),
    hex: `0x${integer.toString(16).padStart(8, '0')}`,
    integer,
  };
}

export function expandIpv4Range(text: string): string[] {
  const input = required(text, 'IPv4 range');
  let start: number;
  let end: number;

  if (input.includes('/')) {
    const subnet = calculateIpv4Subnet(input);

    start = ipv4ToInt(subnet.networkAddress);
    end = ipv4ToInt(subnet.lastAddress);
  } else if (input.includes('-')) {
    const parts = input.split('-');

    if (parts.length !== 2)
      throw networkError('INVALID_IPV4_RANGE', 'Use one range separator: start-end.');

    const left = parts[0]!.trim();
    const right = parts[1]!.trim();

    start = ipv4ToInt(left);

    if (right.includes('.')) end = ipv4ToInt(right);
    else {
      if (!/^(0|[1-9]\d{0,2})$/.test(right) || Number(right) > 255)
        throw networkError(
          'INVALID_IPV4_RANGE',
          'A shorthand end must be one decimal octet from 0 through 255.',
        );

      end = start - (start % 256) + Number(right);
    }
  } else start = end = ipv4ToInt(input);
  if (end < start)
    throw networkError(
      'INVALID_IPV4_RANGE',
      'Range end must be greater than or equal to its start.',
    );

  const count = end - start + 1;

  if (count > 1024)
    throw networkError(
      'IPV4_RANGE_TOO_LARGE',
      'IPv4 range must contain 1024 addresses or fewer; no partial list is returned.',
    );

  return Array.from({ length: count }, (_, index: number) => intToIpv4(start + index));
}

export function ipv4ToInt(ip: string): number {
  const input = required(ip, 'IPv4');

  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(input)) {
    throw networkError(
      'INVALID_IPV4',
      'IPv4 requires four decimal octets from 0 through 255, without leading zeroes, internal spaces or other numeric notation.',
    );
  }

  const parts = input.split('.').map(Number);

  if (parts.some((part: number) => part > 255))
    throw networkError('INVALID_IPV4', 'Each IPv4 octet must be from 0 through 255.');

  return parts.reduce((result, part) => ((result << 8) + part) >>> 0, 0);
}

export function intToIpv4(value: number): string {
  checkedIpv4Integer(value);

  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function checkedIpv4Integer(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw networkError('INVALID_IPV4', 'IPv4 integer must be from 0 through 4294967295.');
}
