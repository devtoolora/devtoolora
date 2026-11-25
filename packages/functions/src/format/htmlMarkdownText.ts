import { FunctionError } from '../errors';

const maxOutput = 20_000_000;

export function checkSize(size: number) {
  if (size > maxOutput)
    throw new FunctionError(
      'HTML_LIMIT',
      'The Markdown output is limited to 20,000,000 characters.',
    );
}

export function paragraphText(inline: string, lineBreak: string): string {
  const lines = inline.split('\n').map(trimSpaces);
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start] === '') start++;
  while (end > start && lines[end - 1] === '') end--;

  return lines.slice(start, end).map(escapeLineStart).join(lineBreak);
}

// Loops instead of / +$/, which backtracks quadratically on long space runs.
function trimSpaces(line: string): string {
  let start = 0;
  let end = line.length;

  while (start < end && line[start] === ' ') start++;
  while (end > start && line[end - 1] === ' ') end--;

  return line.slice(start, end);
}

function escapeLineStart(line: string): string {
  return line.replace(/^[#+-]/, '\\$&').replace(/^(\d+)([.)])/, '$1\\$2');
}

export function escapeText(text: string): string {
  // An entity-like "&name;" would be decoded again by Markdown.
  return text.replace(/[\\`*_[\]<>~]|&(?=#?[a-z\d]+;)/gi, '\\$&');
}

export function joinInline(text: string, piece: string): string {
  if (piece.startsWith(' ') && (text.endsWith(' ') || text.endsWith('\n')))
    return `${text}${piece.slice(1)}`;

  return `${text}${piece}`;
}

/** Moves edge spaces and line breaks outside, since Markdown delimiters must touch their text. */
export function wrapEdges(text: string, wrap: (core: string) => string): string {
  let start = 0;
  let end = text.length;

  while (start < end && (text[start] === ' ' || text[start] === '\n')) start++;
  while (end > start && (text[end - 1] === ' ' || text[end - 1] === '\n')) end--;

  return `${text.slice(0, start)}${wrap(text.slice(start, end))}${text.slice(end)}`;
}

export function longestRun(text: string, char: string): number {
  let longest = 0;
  let run = 0;

  for (const current of text) {
    run = current === char ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  return longest;
}

export function codeSpan(code: string): string {
  if (!code) return '';

  const fence = '`'.repeat(longestRun(code, '`') + 1);
  const pad = code.startsWith('`') || code.endsWith('`') ? ' ' : '';

  return `${fence}${pad}${code}${pad}${fence}`;
}

export function destination(url: string): string {
  const safe = url.replace(/\\/g, '\\\\').replace(/[\n\r<>]/g, (char) => encodeURIComponent(char));

  return /[ ()]/.test(safe) ? `<${safe}>` : safe;
}

export function prefixLines(text: string, first: string, rest: string): string {
  const lines = text.split('\n');

  checkSize(text.length + lines.length * first.length);

  return lines
    .map((line, index) => {
      const prefix = index === 0 ? first : rest;

      return line ? `${prefix}${line}` : trimSpaces(prefix);
    })
    .join('\n');
}
