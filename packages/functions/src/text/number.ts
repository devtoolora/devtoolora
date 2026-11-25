import { FunctionError } from '../errors';

export type NumberLinesOptions = {
  blankLines?: 'number' | 'skip';
  placement?: 'line-start' | 'after-indent';
  separator?: string;
  start?: number;
  step?: number;
  width?: number;
};
export type NumberLinesResult = {
  firstNumber?: number;
  inputLines: number;
  lastNumber?: number;
  numberedLines: number;
  skippedBlankLines: number;
  text: string;
};

type NumberSettings = {
  blankLines: 'number' | 'skip';
  placement: 'line-start' | 'after-indent';
  separator: string;
  start: number;
  step: number;
  width: number;
};

function resolveNumberSettings(text: string, options: NumberLinesOptions): NumberSettings {
  const blankLines = options.blankLines ?? 'number';
  const placement = options.placement ?? 'line-start';
  const separator = options.separator ?? '. ';
  const start = options.start ?? 1;
  const step = options.step ?? 1;
  const width = options.width ?? 1;

  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Input must be valid Unicode without NUL or unpaired surrogates.',
    );
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(step))
    throw new FunctionError(
      'INVALID_TEXT',
      'Start and step must be safe integers between -9007199254740991 and 9007199254740991.',
    );
  if (!Number.isInteger(width) || width < 1 || width > 20)
    throw new FunctionError(
      'INVALID_TEXT',
      'Minimum digit width must be an integer from 1 through 20.',
    );
  if (blankLines !== 'number' && blankLines !== 'skip')
    throw new FunctionError('INVALID_TEXT', 'Choose Number or Skip blank lines.');
  if (placement !== 'line-start' && placement !== 'after-indent')
    throw new FunctionError('INVALID_TEXT', 'Choose Line start or After indentation.');
  if (separator.length > 1_000 || /[\r\n\u0000]|[\uD800-\uDFFF]/u.test(separator))
    throw new FunctionError(
      'INVALID_TEXT',
      'Separator must be single-line valid Unicode without NUL, at most 1,000 UTF-16 units.',
    );

  return { blankLines, placement, separator, start, step, width };
}

function formatLineNumber(number: bigint, width: number): string {
  const magnitude = (number < 0n ? -number : number).toString().padStart(width, '0');

  return (number < 0n ? '-' : '') + magnitude;
}

export function numberLinesDetailed(
  text: string,
  options: NumberLinesOptions = {},
): NumberLinesResult {
  const { blankLines, placement, separator, start, step, width } = resolveNumberSettings(
    text,
    options,
  );

  const startInteger = BigInt(start);
  const stepInteger = BigInt(step);
  const maximum = BigInt(Number.MAX_SAFE_INTEGER);
  const chunks: string[] = [];
  let firstNumber: number | undefined;
  let inputLines = 0;
  let lastNumber: number | undefined;
  let numberedLines = 0;
  let outputLength = 0;
  let skippedBlankLines = 0;

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    inputLines += 1;
    if (inputLines > 10_000)
      throw new FunctionError('INVALID_TEXT', 'Input is limited to 10,000 physical lines.');

    let body = match[1]!;

    if (blankLines === 'skip' && /^[ \t]*$/.test(body)) {
      skippedBlankLines += 1;
    } else {
      const number = startInteger + stepInteger * BigInt(numberedLines);

      if (number < -maximum || number > maximum)
        throw new FunctionError(
          'INVALID_TEXT',
          `Numbering exceeds the safe integer range at physical line ${inputLines}. Adjust start or step; no partial result is returned.`,
        );

      const label = formatLineNumber(number, width);
      const indent = placement === 'after-indent' ? (body.match(/^[ \t]*/)?.[0] ?? '') : '';

      body = indent + label + separator + body.slice(indent.length);
      firstNumber ??= Number(number);
      lastNumber = Number(number);
      numberedLines += 1;
    }

    outputLength += body.length + match[2]!.length;
    if (outputLength > 1_000_000)
      throw new FunctionError(
        'INVALID_TEXT',
        'Result exceeds 1,000,000 UTF-16 units. Use a shorter separator or fewer lines.',
      );

    chunks.push(body + match[2]!);
  }

  return {
    firstNumber,
    inputLines,
    lastNumber,
    numberedLines,
    skippedBlankLines,
    text: chunks.join(''),
  };
}

export function numberLines(text: string, start = 1, width = 1, separator = '. '): string {
  return numberLinesDetailed(text, { separator, start, width }).text;
}
