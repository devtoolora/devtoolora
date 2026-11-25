import { FunctionError } from '../errors';

export type RegexMatch = {
  captures: Array<string | null>;
  end: number;
  groups: Record<string, string | null>;
  index: number;
  indices?: Array<[number, number] | null>;
  match: string;
};

export type RegexResult = {
  count: number;
  flags: string;
  matches: RegexMatch[];
  pattern: string;
  replacementPreview?: string;
};

const OUTPUT_LIMIT = 1_000_000;

function substitution(source: string, match: RegexMatch, replacement: string): string {
  const pieces: string[] = [];
  let size = 0;
  let cursor = 0;

  function append(piece: string): void {
    size += piece.length;
    if (size > OUTPUT_LIMIT)
      throw new FunctionError(
        'REGEX_LIMIT',
        'Replacement output exceeds 1,000,000 UTF-16 units. Reduce the input or replacement.',
      );

    pieces.push(piece);
  }

  for (const token of replacement.matchAll(/\$(\$|&|`|'|<([^>]+)>|\d{1,2})/g)) {
    append(replacement.slice(cursor, token.index));
    const code = token[1]!;
    let expanded = token[0];

    if (code === '$') expanded = '$';
    else if (code === '&') expanded = match.match;
    else if (code === '`') expanded = source.slice(0, match.index);
    else if (code === "'") expanded = source.slice(match.end);
    else if (code.startsWith('<') && Object.keys(match.groups).length > 0)
      expanded = Object.hasOwn(match.groups, token[2] ?? '')
        ? (match.groups[token[2] ?? ''] ?? '')
        : '';
    else if (/^\d/.test(code)) {
      const capture = Number(code);

      if (capture > 0 && capture <= match.captures.length)
        expanded = match.captures[capture - 1] ?? '';
      else if (code.length === 2 && Number(code[0]) > 0 && Number(code[0]) <= match.captures.length)
        expanded = (match.captures[Number(code[0]) - 1] ?? '') + code[1];
    }

    append(expanded);
    cursor = token.index + token[0].length;
  }

  append(replacement.slice(cursor));

  return pieces.join('');
}

export function replaceRegexMatches(
  source: string,
  matches: RegexMatch[],
  replacement: string,
  literal = false,
): string {
  const pieces: string[] = [];
  let cursor = 0;
  let size = 0;

  for (const match of matches) {
    const prefix = source.slice(cursor, match.index);
    const changed = literal ? replacement : substitution(source, match, replacement);

    size += prefix.length + changed.length;
    if (size > OUTPUT_LIMIT)
      throw new FunctionError('REGEX_LIMIT', 'Replacement output exceeds 1,000,000 UTF-16 units.');

    pieces.push(prefix, changed);
    cursor = match.end;
  }

  const suffix = source.slice(cursor);

  if (size + suffix.length > OUTPUT_LIMIT)
    throw new FunctionError('REGEX_LIMIT', 'Replacement output exceeds 1,000,000 UTF-16 units.');

  pieces.push(suffix);

  return pieces.join('');
}

function compileRegex(
  text: string,
  pattern: string,
  flags: string,
  replacement: string | undefined,
): RegExp {
  if (text.length > 100_000 || pattern.length > 4_000 || (replacement?.length ?? 0) > 4_000)
    throw new FunctionError(
      'REGEX_LIMIT',
      'Regex Tester supports 100,000 input units and 4,000 pattern/replacement units.',
    );
  if (/[\uD800-\uDFFF]/u.test(text + pattern + (replacement ?? '')))
    throw new FunctionError('INVALID_REGEX', 'Provide valid Unicode without unpaired surrogates.');
  if (
    /[^dgimsuvy]/.test(flags) ||
    new Set(flags).size !== flags.length ||
    (flags.includes('u') && flags.includes('v'))
  )
    throw new FunctionError(
      'INVALID_REGEX',
      'Flags must be unique JavaScript flags d g i m s u v y; u and v cannot be combined.',
    );

  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new FunctionError(
      'INVALID_REGEX',
      `Invalid or unsupported JavaScript regex: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function toRegexMatch(match: RegExpMatchArray & { index: number }): RegexMatch {
  return {
    captures: match.slice(1).map((capture) => capture ?? null),
    end: match.index + match[0].length,
    groups: Object.fromEntries(
      Object.entries(match.groups ?? {}).map(([name, captured]) => [name, captured ?? null]),
    ),
    index: match.index,
    ...(match.indices ? { indices: match.indices.map((range) => range ?? null) } : {}),
    match: match[0],
  };
}

export function testRegex(
  text: string,
  pattern: string,
  flags = 'g',
  replacement?: string,
): RegexResult {
  const regex = compileRegex(text, pattern, flags, replacement);
  const matches: RegexMatch[] = [];
  let reportSize = 0;
  const found = regex.global ? text.matchAll(regex) : [regex.exec(text)];

  for (const match of found) {
    if (!match) continue;
    if (matches.length >= 1_000)
      throw new FunctionError(
        'REGEX_LIMIT',
        'More than 1,000 matches. Narrow the pattern or reduce the input; no partial report is returned.',
      );

    const entry = toRegexMatch(match);

    reportSize += JSON.stringify(entry).length;
    if (reportSize > OUTPUT_LIMIT)
      throw new FunctionError(
        'REGEX_LIMIT',
        'Match report exceeds 1,000,000 UTF-16 units. Narrow the captures or reduce the input.',
      );

    matches.push(entry);
  }

  return {
    count: matches.length,
    flags: regex.flags,
    matches,
    pattern: regex.source,
    ...(replacement !== undefined
      ? { replacementPreview: replaceRegexMatches(text, matches, replacement) }
      : {}),
  };
}
