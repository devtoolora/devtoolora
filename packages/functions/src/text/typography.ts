import { FunctionError } from '../errors/FunctionError';

export type TypographyOptions = { direction: 'ascii' | 'smart'; skipCode: boolean };

const maxChars = 1_000_000;
const asciiMap: Record<string, string> = {
  '\u00A0': ' ',
  '\u2013': '-',
  '\u2014': '--',
  '\u2026': '...',
  '\u202F': ' ',
};
const smartMap: Record<string, string> = { '---': '\u2014', '--': '\u2013', '...': '\u2026' };
const opensAfter = /[\s([{\u2013\u2014]/;

function toAscii(chunk: string): { count: number; text: string } {
  let count = 0;
  const text = chunk.replace(
    /[\u201C-\u201F\u2033\u2018-\u201B\u2032\u2013\u2014\u2026\u00A0\u202F]/g,
    (char) => {
      count += 1;

      if (/[\u201C-\u201F\u2033]/.test(char)) return '"';
      if (/[\u2018-\u201B\u2032]/.test(char)) return "'";

      return asciiMap[char] ?? char;
    },
  );

  return { count, text };
}

function toSmart(chunk: string, before: string): { count: number; text: string } {
  let count = 0;
  const dashed = chunk.replace(/---|--|\.\.\./g, (match) => {
    count += 1;

    return smartMap[match] ?? match;
  });
  let out = '';
  let prev = before;

  for (let i = 0; i < dashed.length; i += 1) {
    const char = dashed.charAt(i);
    let next = char;

    if (char === '"' || char === "'") {
      count += 1;

      const open = prev === '' || opensAfter.test(prev);

      if (char === '"') next = open ? '\u201C' : '\u201D';
      else if (!open && /\p{L}/u.test(prev) && /\p{L}/u.test(dashed.charAt(i + 1))) next = '\u2019';
      else next = open ? '\u2018' : '\u2019';
    }

    out += next;
    prev = char;
  }

  return { count, text: out };
}

// shortcut: a lone backtick pairs with the next; upgrade with a Markdown parser.
function splitCode(text: string): Array<{ code: boolean; text: string }> {
  const parts: Array<{ code: boolean; text: string }> = [];
  let start = 0;
  let i = 0;
  let fenceOpen = true;
  let tickOpen = true;

  while (i < text.length) {
    let end = -1;

    if (text.charAt(i) !== '`') {
      i += 1;

      continue;
    }

    if (fenceOpen && text.startsWith('```', i)) {
      const close = text.indexOf('```', i + 3);

      if (close === -1) fenceOpen = false;
      else end = close + 3;
    } else if (tickOpen) {
      const close = text.indexOf('`', i + 1);

      if (close === -1) tickOpen = false;
      else end = close + 1;
    }

    if (end === -1) {
      i += 1;

      continue;
    }

    if (i > start) parts.push({ code: false, text: text.slice(start, i) });

    parts.push({ code: true, text: text.slice(i, end) });
    start = end;
    i = end;
  }

  if (start < text.length) parts.push({ code: false, text: text.slice(start) });

  return parts;
}

export function fixTypography(
  text: string,
  options: TypographyOptions,
): { replacements: number; text: string } {
  if (text.length > maxChars)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000,000 characters.');

  const parts = options.skipCode ? splitCode(text) : [{ code: false, text }];
  let replacements = 0;
  let out = '';
  let before = '';

  for (const part of parts) {
    if (part.code) {
      out += part.text;
    } else {
      const fixed = options.direction === 'ascii' ? toAscii(part.text) : toSmart(part.text, before);

      replacements += fixed.count;
      out += fixed.text;
    }

    before = part.text.charAt(part.text.length - 1);
  }

  return { replacements, text: out };
}
