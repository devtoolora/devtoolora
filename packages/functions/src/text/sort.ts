import { FunctionError } from '../errors';

export type SortLinesOptions = {
  accentSensitive?: boolean;
  blankLines?: 'keep' | 'sort' | 'first' | 'last' | 'remove';
  caseSensitive?: boolean;
  direction?: 'asc' | 'desc';
  locale?: string;
  numeric?: boolean;
  ordering?: 'locale' | 'code-points';
  trimComparison?: boolean;
};
export type SortLinesResult = {
  collation?: string;
  inputLines: number;
  lineStructureChanged: boolean;
  locale?: string;
  movedLines: number;
  outputLines: number;
  removedBlankLines: number;
  text: string;
};
type Line = {
  blank: boolean;
  ending: string;
  index: number;
  key: string;
  points: number[];
  text: string;
};

function collatorSensitivity(
  caseSensitive: boolean,
  accentSensitive: boolean,
): Intl.CollatorOptions['sensitivity'] {
  if (caseSensitive) return accentSensitive ? 'variant' : 'case';

  return accentSensitive ? 'accent' : 'base';
}

function placeBlankLines(
  blankLines: NonNullable<SortLinesOptions['blankLines']>,
  slots: Line[],
  sortable: Line[],
  blank: Line[],
): Line[] {
  if (blankLines === 'keep') {
    let nextLine = 0;

    return slots.map((slot) => {
      const line = slot.blank ? slot : sortable[nextLine++];

      if (line === undefined)
        throw new FunctionError('INVALID_TEXT', 'Sorted line count mismatch.');

      return line;
    });
  }

  if (blankLines === 'first') return [...blank, ...sortable];
  if (blankLines === 'last') return [...sortable, ...blank];

  return sortable;
}

function createCollator(options: SortLinesOptions): Intl.Collator {
  const locale = options.locale?.trim() ?? 'en';

  try {
    const canonical = Intl.getCanonicalLocales(locale);

    if (canonical.length !== 1 || Intl.Collator.supportedLocalesOf(canonical).length !== 1)
      throw new Error('unsupported');

    const sensitivity = collatorSensitivity(
      options.caseSensitive === true,
      options.accentSensitive !== false,
    );

    return new Intl.Collator(canonical[0], {
      ignorePunctuation: false,
      numeric: options.numeric !== false,
      sensitivity,
      usage: 'sort',
    });
  } catch {
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide a valid, supported collation locale such as en, cs or sv. Unsupported languages are not replaced with the runtime default.',
    );
  }
}

function comparePoints(left: number[], right: number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }

  return left.length - right.length;
}

type SortSettings = {
  blankLines: 'keep' | 'sort' | 'first' | 'last' | 'remove';
  direction: 'asc' | 'desc';
  ordering: 'locale' | 'code-points';
};

function resolveSortSettings(text: string, options: SortLinesOptions): SortSettings {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Sort input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode text without NUL or unpaired surrogates.',
    );

  const direction = options.direction ?? 'asc';
  const blankLines = options.blankLines ?? 'keep';
  const ordering = options.ordering ?? 'locale';

  if (direction !== 'asc' && direction !== 'desc')
    throw new FunctionError('INVALID_TEXT', 'Choose Ascending or Descending direction.');
  if (!['keep', 'sort', 'first', 'last', 'remove'].includes(blankLines))
    throw new FunctionError('INVALID_TEXT', 'Choose a valid blank-line policy.');
  if (ordering !== 'locale' && ordering !== 'code-points')
    throw new FunctionError(
      'INVALID_TEXT',
      'Choose Locale-aware or Unicode code points comparison.',
    );

  return { blankLines, direction, ordering };
}

function parseSortLines(text: string, options: SortLinesOptions, ordering: string): Line[] {
  const lines: Line[] = [];

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    const lineText = match[1]!;
    const key = options.trimComparison
      ? lineText.replace(/^[ \t]+/, '').replace(/(?<![ \t])[ \t]+$/, '')
      : lineText;

    lines.push({
      blank: /^[ \t]*$/.test(lineText),
      ending: match[2]!,
      index: lines.length,
      key,
      points:
        ordering === 'code-points'
          ? Array.from(key, (character) => character.codePointAt(0) ?? 0)
          : [],
      text: lineText,
    });

    if (lines.length > 10_000)
      throw new FunctionError('INVALID_TEXT', 'Sort input is limited to 10,000 physical lines.');
  }

  return lines;
}

export function sortLinesDetailed(text: string, options: SortLinesOptions = {}): SortLinesResult {
  const { blankLines, direction, ordering } = resolveSortSettings(text, options);
  const collator = ordering === 'locale' ? createCollator(options) : undefined;
  const lines = parseSortLines(text, options, ordering);
  const slots = blankLines === 'remove' ? lines.filter((line) => !line.blank) : lines;
  const blank = slots.filter((line) => line.blank);
  const sortable = (blankLines === 'sort' ? slots : slots.filter((line) => !line.blank)).slice();

  sortable.sort((left, right) => {
    const compared = collator
      ? collator.compare(left.key, right.key)
      : comparePoints(left.points, right.points);

    return (direction === 'desc' ? -compared : compared) || left.index - right.index;
  });

  const ordered = placeBlankLines(blankLines, slots, sortable, blank);
  const sortedText = ordered
    .map((line, index) => line.text + (slots[index]?.ending ?? ''))
    .join('');
  let outputLines = 0;

  for (const match of sortedText.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === sortedText.length) break;

    outputLines += 1;
  }

  return {
    collation: collator?.resolvedOptions().collation,
    inputLines: lines.length,
    lineStructureChanged: outputLines !== slots.length,
    locale: collator?.resolvedOptions().locale,
    movedLines: ordered.filter((line, index) => {
      const slot = slots[index];

      if (!slot) throw new Error('Sorted line slot is missing.');

      return line.index !== slot.index;
    }).length,
    outputLines,
    removedBlankLines: lines.length - slots.length,
    text: sortedText,
  };
}

export function sortLines(text: string, options: SortLinesOptions = {}): string {
  return sortLinesDetailed(text, options).text;
}
