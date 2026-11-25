import { FunctionError } from '../errors';
import { intToIpv4, ipv4ToInt } from './ipv4';
import { networkError, required } from './shared';

export type Ipv6InputFormat = 'address' | 'hex' | 'integer';

export interface Ipv6Address {
  value: bigint;
  zone?: string;
}

export interface Ipv6Conversion {
  compressed: string;
  expanded: string;
  text: string;
  type: string;
  zone?: string;
}

export const ipv6Max: bigint = 2n ** 128n - 1n;

const multicastScopes: Record<number, string> = {
  1: 'interface-local',
  2: 'link-local',
  3: 'realm-local',
  4: 'admin-local',
  5: 'site-local',
  8: 'organization-local',
  14: 'global',
};

const typeTable: [bigint, bigint, string][] = (
  [
    ['::', 128n, 'Unspecified'],
    ['::1', 128n, 'Loopback'],
    ['::ffff:0:0', 96n, 'IPv4-mapped'],
    ['64:ff9b::', 96n, 'NAT64 well-known prefix'],
    ['64:ff9b:1::', 48n, 'Local-use NAT64'],
    ['100::', 64n, 'Discard-only'],
    ['100:0:0:1::', 64n, 'Dummy prefix'],
    ['2001:1::1', 128n, 'PCP anycast'],
    ['2001:1::2', 128n, 'TURN anycast'],
    ['2001:1::3', 128n, 'DNS-SD SRP anycast'],
    ['2001:2::', 48n, 'Benchmarking'],
    ['2001:3::', 32n, 'AMT'],
    ['2001:4:112::', 48n, 'AS112-v6'],
    ['2001:10::', 28n, 'Deprecated ORCHID'],
    ['2001:20::', 28n, 'ORCHIDv2'],
    ['2001:30::', 28n, 'Drone Remote ID'],
    ['2001:db8::', 32n, 'Documentation'],
    ['2001::', 32n, 'Teredo'],
    ['2001::', 23n, 'IETF protocol assignment'],
    ['3fff::', 20n, 'Documentation'],
    ['2002::', 16n, '6to4'],
    ['2620:4f:8000::', 48n, 'AS112-v6'],
    ['5f00::', 16n, 'SRv6 SIDs'],
    ['fc00::', 7n, 'Unique local'],
    ['fe80::', 10n, 'Link-local'],
  ] satisfies [string, bigint, string][]
).map(([prefix, length, label]): [bigint, bigint, string] => [parseGroups(prefix), length, label]);

export function parseIpv6(text: string): Ipv6Address {
  const input = required(text, 'IPv6');

  if (input.includes('/'))
    throw invalid(
      'Enter one IPv6 address without a /prefix; use IPv6 Subnet Calculator for CIDR blocks.',
    );

  const unbracketed = input.startsWith('[') && input.endsWith(']') ? input.slice(1, -1) : input;
  const [address = '', zone, ...rest] = unbracketed.split('%');

  if (zone === undefined) return { value: parseGroups(address) };
  if (rest.length > 0 || !/^[0-9A-Za-z._~-]{1,64}$/.test(zone))
    throw invalid(
      'An IPv6 zone must be 1 to 64 letters, digits, dots, underscores, tildes or hyphens after one %.',
    );

  return { value: parseGroups(address), zone };
}

export function formatIpv6(value: bigint, style: 'compressed' | 'expanded'): string {
  const groups = groupsOf(value);

  if (style === 'expanded')
    return groups.map((group: number) => group.toString(16).padStart(4, '0')).join(':');
  if (value >> 32n === 0xffffn) return `::ffff:${intToIpv4(Number(value & 0xffffffffn))}`;

  const hex = groups.map((group: number) => group.toString(16));
  const [start, length] = longestZeroRun(groups);

  if (length < 2) return hex.join(':');

  return `${hex.slice(0, start).join(':')}::${hex.slice(start + length).join(':')}`;
}

export function classifyIpv6(value: bigint): string {
  for (const [prefix, length, label] of typeTable)
    if (value >> (128n - length) === prefix >> (128n - length)) return label;
  if (value >> 120n === 0xffn)
    return `Multicast (${multicastScopes[Number((value >> 112n) & 0xfn)] ?? 'reserved'} scope)`;
  if (value >> 125n === 1n) return 'Global unicast';

  return 'Reserved';
}

export function convertIpv6(text: string, format: Ipv6InputFormat = 'address'): Ipv6Conversion {
  const { value, zone } = format === 'address' ? parseIpv6(text) : { value: numeric(text, format) };
  const suffix = zone === undefined ? '' : `%${zone}`;
  const compressed = formatIpv6(value, 'compressed') + suffix;
  const expanded = formatIpv6(value, 'expanded') + suffix;
  const type = classifyIpv6(value);
  const rows: [string, string][] = [
    ['Compressed', compressed],
    ['Expanded', expanded],
    ['Hex', `0x${value.toString(16).padStart(32, '0')}`],
    ['Integer', value.toString()],
    ['Binary', binaryOf(value)],
    ['PTR', ptrOf(value)],
    ['Type', type],
    ...embeddedIpv4(value, type),
  ];

  if (zone !== undefined) rows.push(['Zone', zone]);

  return {
    compressed,
    expanded,
    text: formatRows(rows),
    type,
    ...(zone === undefined ? {} : { zone }),
  };
}

function invalid(message: string): FunctionError {
  return networkError('INVALID_IPV6', message);
}

function numeric(text: string, format: 'hex' | 'integer'): bigint {
  const input = required(text, 'IPv6');

  if (format === 'hex') {
    if (!/^(?:0x)?[0-9a-f]{32}$/i.test(input))
      throw invalid('Hex input must be exactly 32 hexadecimal digits, with an optional 0x prefix.');

    return BigInt(`0x${input.replace(/^0x/i, '')}`);
  }

  const value = /^\d{1,39}$/.test(input) ? BigInt(input) : -1n;

  if (value < 0n || value > ipv6Max)
    throw invalid(`Integer input must be a decimal integer from 0 through ${ipv6Max}.`);

  return value;
}

function parseGroups(address: string): bigint {
  const halves = address.split('::');

  if (halves.length > 2) throw invalid('An IPv6 address may contain "::" only once.');

  const compressed = halves.length === 2;
  const head = hexGroups(halves[0] ?? '', !compressed);
  const tail = compressed ? hexGroups(halves[1] ?? '', true) : [];
  const count = head.length + tail.length;

  if (compressed ? count > 7 : count !== 8)
    throw invalid('An IPv6 address needs 8 groups of 16 bits, or at most 7 groups with "::".');

  const groups = [...head, ...Array<number>(8 - count).fill(0), ...tail];

  return groups.reduce((result: bigint, group: number) => (result << 16n) | BigInt(group), 0n);
}

function hexGroups(part: string, allowsIpv4Tail: boolean): number[] {
  if (part === '') return [];

  const pieces = part.split(':');
  const last = pieces.length - 1;

  return pieces.flatMap((piece: string, index: number) => {
    if (allowsIpv4Tail && index === last && piece.includes('.')) return ipv4Groups(piece);
    if (!/^[0-9a-f]{1,4}$/i.test(piece))
      throw invalid('Each IPv6 group must be 1 to 4 hexadecimal digits separated by colons.');

    return [parseInt(piece, 16)];
  });
}

function ipv4Groups(piece: string): number[] {
  let value: number;

  try {
    value = ipv4ToInt(piece);
  } catch {
    throw invalid('An embedded IPv4 tail needs four decimal octets from 0 through 255.');
  }

  return [value >>> 16, value & 0xffff];
}

function groupsOf(value: bigint): number[] {
  return [112n, 96n, 80n, 64n, 48n, 32n, 16n, 0n].map((shift: bigint) =>
    Number((value >> shift) & 0xffffn),
  );
}

function longestZeroRun(groups: number[]): [number, number] {
  let best: [number, number] = [0, 0];
  let start = 0;

  groups.forEach((group: number, index: number) => {
    if (group !== 0) start = index + 1;
    else if (index - start + 1 > best[1]) best = [start, index - start + 1];
  });

  return best;
}

function binaryOf(value: bigint): string {
  return groupsOf(value)
    .map((group: number) => group.toString(2).padStart(16, '0'))
    .join(' ');
}

function ptrOf(value: bigint): string {
  return `${[...value.toString(16).padStart(32, '0')].reverse().join('.')}.ip6.arpa`;
}

function embeddedIpv4(value: bigint, type: string): [string, string][] {
  const ipv4 = (bits: bigint): string => intToIpv4(Number(bits & 0xffffffffn));

  if (type === 'IPv4-mapped' || type === 'NAT64 well-known prefix') return [['IPv4', ipv4(value)]];
  if (type === '6to4') return [['IPv4', ipv4(value >> 80n)]];
  if (type !== 'Teredo') return [];

  return [
    ['Teredo server', ipv4(value >> 64n)],
    ['Teredo client', ipv4(value ^ 0xffffffffn)],
    ['Teredo port', String(Number((value >> 32n) & 0xffffn) ^ 0xffff)],
  ];
}

function formatRows(rows: [string, string][]): string {
  const width = Math.max(...rows.map(([label]) => label.length)) + 2;

  return `${rows.map(([label, value]) => label.padEnd(width) + value).join('\n')}\n`;
}
