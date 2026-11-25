import { FunctionError } from '../errors';

export function quoteTomlDates(source: string, prefix = ''): { dates: number; text: string } {
  const parts: string[] = [];
  let dates = 0;
  let offset = 0;
  let copied = 0;
  let nesting = 0;
  const datePattern =
    /(?:\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:\d{2})?)?|\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(?=$|[\s,\]}#])/y;

  while (offset < source.length) {
    const character = source.charAt(offset);

    if (
      character === '[' &&
      nesting === 0 &&
      /^\s*$/.test(source.slice(source.lastIndexOf('\n', offset - 1) + 1, offset))
    ) {
      while (offset < source.length && source[offset] !== '\n') offset++;

      continue;
    }

    if (character === '#') {
      while (offset < source.length && source[offset] !== '\n') offset++;

      continue;
    }

    if (character === '"' || character === "'") {
      offset = skipQuotedString(source, offset, character);

      continue;
    }

    if (/\d/.test(character) && (offset === 0 || /[=\s,[{]/.test(source.charAt(offset - 1)))) {
      datePattern.lastIndex = offset;
      const match = datePattern.exec(source);

      if (match && !/^\s*=/.test(source.slice(offset + match[0].length))) {
        validateDate(match[0], source, offset);
        parts.push(source.slice(copied, offset), JSON.stringify(prefix + match[0]));
        offset += match[0].length;
        copied = offset;
        dates++;

        continue;
      }
    }

    if (character === '[' || character === '{') nesting++;
    if (character === ']' || character === '}') nesting--;

    offset++;
  }

  parts.push(source.slice(copied));

  return { dates, text: parts.join('') };
}

function validateDate(token: string, source: string, offset: number): void {
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(token);
  let isInvalid = false;

  if (date) {
    const year = Number(date[1]);
    const month = Number(date[2]);
    const day = Number(date[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    isInvalid = month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0);
  }

  for (const time of token.matchAll(/(\d{2}):(\d{2})(?::(\d{2}))?/g))
    isInvalid ||= Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3] ?? 0) > 59;

  if (isInvalid) {
    const before = source.slice(0, offset).split('\n');

    throw new FunctionError(
      'INVALID_TOML_DATE',
      `TOML line ${before.length}, column ${(before.at(-1) ?? '').length + 1}: invalid calendar date or time ${token}.`,
    );
  }
}

function skipQuotedString(source: string, start: number, character: string): number {
  const delimiter = source.startsWith(character.repeat(3), start) ? character.repeat(3) : character;
  let offset = start + delimiter.length;

  while (offset < source.length) {
    if (character === '"' && source[offset] === '\\') {
      offset += 2;

      continue;
    }

    if (source.startsWith(delimiter, offset)) {
      offset += delimiter.length;
      if (delimiter.length === 3) while (source[offset] === character) offset++;

      break;
    }

    offset++;
  }

  return offset;
}
