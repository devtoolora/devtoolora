import { FunctionError } from '../errors';

export type ExtractPattern = 'custom' | 'email' | 'hashtag' | 'ipv4' | 'ipv6' | 'number' | 'url';
export type ExtractOptions = {
  custom?: string;
  dedupe: boolean;
  ignoreCase: boolean;
  pattern: ExtractPattern;
  sort: boolean;
};
export type ExtractResult = { matches: string[]; total: number; unique: number };

const maxUnits = 200_000;
const maxMatches = 50_000;
const maxCustomUnits = 256;
const octet = '(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)';
const builtIn: Record<Exclude<ExtractPattern, 'custom'>, RegExp> = {
  email: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  hashtag: /#[\p{L}\p{N}_][\p{L}\p{M}\p{N}_]*/gu,
  ipv4: new RegExp(`\\b(?:${octet}\\.){3}${octet}\\b`, 'g'),
  ipv6: /(?<![\w:.])[0-9A-Fa-f:]+(?![\w:]|\.\w)/g,
  number:
    /(?:(?<![\p{L}\p{N}])-)?(?:\d{1,3}(?:,\d{3})+(?!\d)(?:\.\d+)?|\d{1,3}(?:\.\d{3})+,\d+|\d+(?:[.,]\d+)?|(?<![\d.,])\.\d+)/gu,
  url: /\bhttps?:\/\/(?:[^\s<>"'()[\]]|\([^\s<>"'()[\]]*\)|\[[^\s<>"'()[\]]*\])+/gi,
};
const urlTrailingPunctuation = '?!.,:;*_~';

function compileCustom(custom: string | undefined, ignoreCase: boolean): RegExp {
  const source = custom ?? '';

  if (source.length < 1 || source.length > maxCustomUnits)
    throw new FunctionError('INVALID_PATTERN', 'Custom pattern must be 1 to 256 characters.');

  try {
    return new RegExp(source, ignoreCase ? 'giu' : 'gu');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new FunctionError('INVALID_PATTERN', `Invalid pattern: ${message}.`);
  }
}

function isIpv6(candidate: string): boolean {
  const parts = candidate.split('::');

  if (parts.length > 2) return false;

  const groups = parts.flatMap((part) => (part === '' ? [] : part.split(':')));

  if (!groups.every((group) => /^[0-9A-Fa-f]{1,4}$/.test(group))) return false;

  return parts.length === 1 ? groups.length === 8 : groups.length <= 7;
}

// GFM autolink rule: trailing sentence punctuation is not part of the link.
function trimUrl(candidate: string): string {
  let end = candidate.length;

  while (end > 0 && urlTrailingPunctuation.includes(candidate.charAt(end - 1))) end -= 1;

  const trimmed = candidate.slice(0, end);

  return /^https?:\/\/$/i.test(trimmed) ? '' : trimmed;
}

function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, (char) => char.codePointAt(0) ?? 0);
  const b = Array.from(right, (char) => char.codePointAt(0) ?? 0);

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return (a[index] ?? 0) - (b[index] ?? 0);
  }

  return a.length - b.length;
}

export function extractPatterns(text: string, options: ExtractOptions): ExtractResult {
  const regex =
    options.pattern === 'custom'
      ? compileCustom(options.custom, options.ignoreCase)
      : builtIn[options.pattern];

  if (text.length > maxUnits)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 200,000 UTF-16 units.');

  const found: string[] = [];

  for (const match of text.matchAll(regex)) {
    const raw = match.length > 1 ? match[1] : match[0];
    const value = options.pattern === 'url' && raw !== undefined ? trimUrl(raw) : raw;

    if (value === undefined || value === '') continue;
    if (options.pattern === 'ipv6' && !isIpv6(value)) continue;

    found.push(value);

    if (found.length > maxMatches)
      throw new FunctionError('TOO_MANY_MATCHES', 'Stopped after 50,000 matches.');
  }

  const distinct = [...new Set(found)];
  const matches = options.dedupe ? distinct : found;

  return {
    matches: options.sort ? [...matches].sort(compareCodePoints) : matches,
    total: found.length,
    unique: distinct.length,
  };
}
