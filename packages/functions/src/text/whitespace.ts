import { FunctionError } from '../errors';

export type WhitespaceOptions = {
  collapseBlankLines?: boolean;
  collapseSpaces?: boolean;
  lineEndings?: 'preserve' | 'lf' | 'crlf';
  normalizeUnicodeSpaces?: boolean;
  trimLines?: boolean;
  trimText?: boolean;
  trimTrailing?: boolean;
};
export type WhitespaceStatistics = {
  blankLines: number;
  codePoints: number;
  lineEndings: { cr: number; crlf: number; lf: number };
  lines: number;
  spaces: number;
  tabs: number;
};
export type WhitespaceResult = {
  after: WhitespaceStatistics;
  before: WhitespaceStatistics;
  changed: boolean;
  text: string;
};
type Line = { ending: string; text: string };

function splitLines(text: string): Line[] {
  const lines: Line[] = [];

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    lines.push({ ending: match[2]!, text: match[1]! });
  }

  return lines;
}

function statistics(text: string): WhitespaceStatistics {
  const lines = splitLines(text);

  return {
    blankLines: lines.filter((line) => /^[ \t]*$/.test(line.text)).length,
    codePoints: Array.from(text).length,
    lineEndings: {
      cr: lines.filter((line) => line.ending === '\r').length,
      crlf: lines.filter((line) => line.ending === '\r\n').length,
      lf: lines.filter((line) => line.ending === '\n').length,
    },
    lines: lines.length,
    spaces: text.match(/ /g)?.length ?? 0,
    tabs: text.match(/\t/g)?.length ?? 0,
  };
}

function convertedEnding(ending: string, endings: 'preserve' | 'lf' | 'crlf'): string {
  if (!ending || endings === 'preserve') return ending;

  return endings === 'lf' ? '\n' : '\r\n';
}

export function cleanWhitespaceDetailed(
  text: string,
  options: WhitespaceOptions = {},
): WhitespaceResult {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Whitespace input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode text without NUL or unpaired surrogates.',
    );

  const endings = options.lineEndings ?? 'preserve';

  if (endings !== 'preserve' && endings !== 'lf' && endings !== 'crlf')
    throw new FunctionError('INVALID_TEXT', 'Choose Preserve, LF or CRLF line endings.');

  const lines = splitLines(text);

  if (lines.length > 10_000)
    throw new FunctionError(
      'INVALID_TEXT',
      'Whitespace input is limited to 10,000 physical lines.',
    );

  const output: string[] = [];
  let consecutiveBlankLines = 0;

  for (const line of lines) {
    let body = options.normalizeUnicodeSpaces
      ? line.text.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      : line.text;

    if (options.trimLines !== false)
      body = body.replace(/^[ \t]+/, '').replace(/(?<![ \t])[ \t]+$/, '');
    else if (options.trimTrailing === true) body = body.replace(/(?<![ \t])[ \t]+$/, '');

    if (options.collapseSpaces !== false) {
      const indentation = body.match(/^[ \t]*/)?.[0] ?? '';

      body = indentation + body.slice(indentation.length).replace(/[ \t]+/g, ' ');
    }

    consecutiveBlankLines = /^[ \t]*$/.test(body) ? consecutiveBlankLines + 1 : 0;
    if (options.collapseBlankLines !== false && consecutiveBlankLines > 1) continue;

    output.push(body + convertedEnding(line.ending, endings));
  }

  const cleaned = output.join('');
  const result = options.trimText === false ? cleaned : cleaned.trim();

  return {
    after: statistics(result),
    before: statistics(text),
    changed: result !== text,
    text: result,
  };
}

export function cleanWhitespace(text: string, options: WhitespaceOptions = {}): string {
  return cleanWhitespaceDetailed(text, options).text;
}
