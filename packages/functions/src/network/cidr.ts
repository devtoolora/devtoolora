import { FunctionError } from '../errors/FunctionError';
import { intToIpv4, ipv4ToInt } from './ipv4';
import { formatIpv6, parseIpv6 } from './ipv6';
import { networkError } from './shared';

export interface CidrAggregation {
  inputCount: number;
  merged: string[];
  overlapCount: number;
  overlaps: string[];
  overlapsTruncated: boolean;
}

interface CidrRange {
  end: bigint;
  family: 4 | 6;
  line: number;
  start: bigint;
}

const cidrLineLimit = 10_000;
const cidrMergedLimit = 100_000;
const cidrOverlapLimit = 1000;

const familyBits: Record<CidrRange['family'], number> = { 4: 32, 6: 128 };

export function aggregateCidrs(text: string): CidrAggregation {
  const ranges = parseLines(text);
  const { overlaps, overlapsTruncated } = findOverlaps(ranges);
  const budget = { left: cidrMergedLimit };

  return {
    inputCount: ranges.length,
    merged: [...mergeFamily(ranges, 4, budget), ...mergeFamily(ranges, 6, budget)],
    overlapCount: overlaps.length,
    overlaps,
    overlapsTruncated,
  };
}

function parseLines(text: string): CidrRange[] {
  const lines = text.split(/\r?\n/);

  if (lines.at(-1) === '') lines.pop();
  if (lines.length > cidrLineLimit)
    throw networkError('INPUT_TOO_LARGE', 'The CIDR list exceeds 10,000 lines.');

  const ranges: CidrRange[] = [];

  lines.forEach((raw, index) => {
    const line = index + 1;

    if (raw.length > 128)
      throw networkError('INPUT_TOO_LARGE', `Line ${line} exceeds 128 characters.`);

    const entry = raw.trim();

    if (entry !== '' && !entry.startsWith('#')) ranges.push(parseEntry(entry, line));
  });

  if (ranges.length === 0)
    throw networkError('REQUIRED_INPUT', 'At least one address, CIDR or range is required.');

  return ranges;
}

function parseEntry(entry: string, line: number): CidrRange {
  try {
    return { ...parseRange(entry), line };
  } catch (error) {
    if (error instanceof FunctionError)
      throw networkError(error.code, `Line ${line}: ${error.message}`);

    throw error;
  }
}

function parseRange(entry: string): Omit<CidrRange, 'line'> {
  const bounds = entry.split('-');

  if (bounds.length > 2)
    throw networkError(
      'INVALID_CIDR',
      'A range must be one start address, a hyphen and one end address.',
    );
  if (bounds.length === 2) {
    const start = parseAddress(bounds[0] ?? '');
    const end = parseAddress(bounds[1] ?? '');

    if (start.family !== end.family)
      throw networkError('INVALID_CIDR', 'The range start and end must be the same family.');
    if (end.value < start.value)
      throw networkError('INVALID_CIDR', 'The range end must not be before its start.');

    return { end: end.value, family: start.family, start: start.value };
  }

  const [address = '', prefixText, ...rest] = entry.split('/');
  const { family, value } = parseAddress(address);
  const bits = familyBits[family];
  const prefix = prefixText === undefined ? bits : parsePrefix(prefixText, bits);

  if (rest.length > 0)
    throw networkError('INVALID_CIDR', 'A CIDR must contain one address and one /prefix.');

  const size = 1n << BigInt(bits - prefix);
  const start = value - (value % size);

  return { end: start + size - 1n, family, start };
}

function parseAddress(text: string): { family: CidrRange['family']; value: bigint } {
  if (!text.includes(':')) return { family: 4, value: BigInt(ipv4ToInt(text)) };

  const { value, zone } = parseIpv6(text);

  if (zone !== undefined)
    throw networkError('INVALID_CIDR', 'IPv6 zones such as %eth0 are not supported here.');

  return { family: 6, value };
}

function parsePrefix(text: string, bits: number): number {
  const prefix = /^\d{1,3}$/.test(text.trim()) ? Number(text) : -1;

  if (prefix < 0 || prefix > bits)
    throw networkError(
      'INVALID_PREFIX',
      `The prefix must be a whole number from 0 through ${bits}.`,
    );

  return prefix;
}

function mergeFamily(
  ranges: CidrRange[],
  family: CidrRange['family'],
  budget: { left: number },
): string[] {
  const sorted = ranges
    .filter((range) => range.family === family)
    .sort((left, right) => compareBigInt(left.start, right.start));
  const joined: { end: bigint; start: bigint }[] = [];

  for (const { end, start } of sorted) {
    const last = joined.at(-1);

    if (last !== undefined && start <= last.end + 1n) {
      if (end > last.end) last.end = end;
    } else joined.push({ end, start });
  }

  return joined.flatMap(({ end, start }) => splitIntoBlocks(start, end, family, budget));
}

function trailingZeroBits(value: bigint, width: number): number {
  if (value === 0n) return width;

  let zeros = 0;

  while ((value >> BigInt(zeros)) % 2n === 0n) zeros += 1;

  return zeros;
}

function splitIntoBlocks(
  first: bigint,
  last: bigint,
  family: CidrRange['family'],
  budget: { left: number },
): string[] {
  const bits = familyBits[family];
  const blocks: string[] = [];
  let start = first;

  while (start <= last) {
    budget.left -= 1;

    if (budget.left < 0)
      throw networkError('INPUT_TOO_LARGE', 'The merged list exceeds 100,000 CIDRs.');

    const span = (last - start + 1n).toString(2).length - 1;
    const hostBits = Math.min(trailingZeroBits(start, bits), span);

    blocks.push(`${formatAddress(start, family)}/${bits - hostBits}`);
    start += 1n << BigInt(hostBits);
  }

  return blocks;
}

function formatAddress(value: bigint, family: CidrRange['family']): string {
  return family === 4 ? intToIpv4(Number(value)) : formatIpv6(value, 'compressed');
}

function findOverlaps(ranges: CidrRange[]): { overlaps: string[]; overlapsTruncated: boolean } {
  const sorted = [...ranges].sort(
    (left, right) => left.family - right.family || compareBigInt(left.start, right.start),
  );
  const pairs: [CidrRange, CidrRange][] = [];
  let active: CidrRange[] = [];

  for (const current of sorted) {
    active = active.filter(
      (range) => range.family === current.family && range.end >= current.start,
    );

    for (const earlier of active) {
      if (pairs.length === cidrOverlapLimit) return describePairs(pairs, true);

      pairs.push(earlier.line < current.line ? [earlier, current] : [current, earlier]);
    }

    active.push(current);
  }

  return describePairs(pairs, false);
}

function describePairs(
  pairs: [CidrRange, CidrRange][],
  overlapsTruncated: boolean,
): { overlaps: string[]; overlapsTruncated: boolean } {
  const overlaps = pairs
    .sort(([a1, b1], [a2, b2]) => a1.line - a2.line || b1.line - b2.line)
    .map(([first, second]) => {
      if (covers(first, second)) return `line ${first.line} contains line ${second.line}`;
      if (covers(second, first)) return `line ${second.line} contains line ${first.line}`;

      return `line ${first.line} overlaps line ${second.line}`;
    });

  return { overlaps, overlapsTruncated };
}

function covers(outer: CidrRange, inner: CidrRange): boolean {
  return outer.start <= inner.start && outer.end >= inner.end;
}

function compareBigInt(left: bigint, right: bigint): number {
  return Number(left > right) - Number(left < right);
}
