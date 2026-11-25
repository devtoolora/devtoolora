import { formatIpv6, ipv6Max, parseIpv6 } from './ipv6';
import { networkError, required } from './shared';

export interface Ipv6Subnet {
  hostBitsSet: boolean;
  network: string;
  subnets: string[];
  subnetTotal: bigint;
  text: string;
  total: bigint;
}

export const ipv6SubnetListLimit = 1024;

export function calculateIpv6Subnet(text: string, splitPrefix?: number): Ipv6Subnet {
  const input = required(text, 'IPv6 subnet');
  const slash = input.lastIndexOf('/');

  if (slash < 0)
    throw networkError(
      'INVALID_IPV6_SUBNET',
      'Enter an IPv6 address with a /prefix, such as 2001:db8::/32.',
    );

  const prefix = parsePrefix(input.slice(slash + 1));
  const { value } = parseIpv6(input.slice(0, slash));
  const hostBits = BigInt(128 - prefix);
  const mask = (ipv6Max >> hostBits) << hostBits;
  const first = value & mask;
  const last = first | (ipv6Max & ~mask);
  const total = 1n << hostBits;
  const network = `${formatIpv6(first, 'compressed')}/${prefix}`;
  const rows: [string, string][] = [
    ['Network', network],
    ['Prefix length', `/${prefix}`],
    ['Prefix mask', formatIpv6(mask, 'compressed')],
    ['First address', formatIpv6(first, 'compressed')],
    ['Last address', formatIpv6(last, 'compressed')],
    ['Addresses', `${total} (2^${hostBits})`],
  ];

  if (prefix <= 64) rows.push(['/64 networks', String(1n << BigInt(64 - prefix))]);

  const split = splitPrefix === undefined ? undefined : listSubnets(first, prefix, splitPrefix);
  const body = formatRows(rows) + (split === undefined ? '' : `\n${split.heading}\n${split.lines}`);

  return {
    hostBitsSet: value !== first,
    network,
    subnetTotal: split?.total ?? 0n,
    subnets: split?.subnets ?? [],
    text: body,
    total,
  };
}

function parsePrefix(text: string): number {
  const prefix = /^\d{1,3}$/.test(text.trim()) ? Number(text) : -1;

  if (prefix < 0 || prefix > 128)
    throw networkError('INVALID_IPV6_SUBNET', 'The IPv6 prefix must be a whole number from 0-128.');

  return prefix;
}

function listSubnets(first: bigint, prefix: number, split: number) {
  if (!Number.isInteger(split) || split < prefix || split > 128)
    throw networkError(
      'INVALID_IPV6_SUBNET',
      `The split prefix must be from /${prefix} through /128.`,
    );

  const total = 1n << BigInt(split - prefix);
  const count = total > BigInt(ipv6SubnetListLimit) ? ipv6SubnetListLimit : Number(total);
  const step = 1n << BigInt(128 - split);
  const subnets = Array.from(
    { length: count },
    (_, index) => `${formatIpv6(first + step * BigInt(index), 'compressed')}/${split}`,
  );
  const shown = count < total ? `first 1,024 of ${total}` : String(total);

  return {
    heading: `Subnets /${split} (${shown})`,
    lines: `${subnets.join('\n')}\n`,
    subnets,
    total,
  };
}

function formatRows(rows: [string, string][]): string {
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;

  return `${rows.map(([label, value]) => label.padEnd(width) + value).join('\n')}\n`;
}
