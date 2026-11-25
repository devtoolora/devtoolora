import { FunctionError } from '../errors';

export type DeduplicateLinesOptions = {
  blankLines?: 'deduplicate' | 'keep' | 'remove';
  caseSensitive?: boolean;
  keep?: 'first' | 'last';
  normalizeComparison?: boolean;
  trimComparison?: boolean;
};
export type DeduplicateLinesResult = {
  inputLines: number;
  lineStructureChanged: boolean;
  outputLines: number;
  removedBlankLines: number;
  removedDuplicates: number;
  retainedLines: number;
  text: string;
};
type Line = { blank: boolean; ending: string; key: string; text: string };

function validateDeduplicateInput(text: string): void {
  if (text.length > 100_000)
    throw new FunctionError(
      'INVALID_TEXT',
      'Deduplication input is limited to 100,000 UTF-16 units.',
    );
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode text without NUL or unpaired surrogates.',
    );
}

function parseLines(text: string, options: DeduplicateLinesOptions): Line[] {
  const lines: Line[] = [];

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    const lineText = match[1]!;
    const ending = match[2]!;
    let key = options.trimComparison
      ? lineText.replace(/^[ \t]+/, '').replace(/(?<![ \t])[ \t]+$/, '')
      : lineText;

    if (!options.caseSensitive) key = key.toLowerCase();
    if (options.normalizeComparison) key = key.normalize('NFC');

    lines.push({ blank: /^[ \t]*$/.test(lineText), ending, key, text: lineText });
    if (lines.length > 10_000)
      throw new FunctionError(
        'INVALID_TEXT',
        'Deduplication input is limited to 10,000 physical lines.',
      );
  }

  return lines;
}

function selectLines(
  lines: Line[],
  keep: 'first' | 'last',
  blankLines: 'deduplicate' | 'keep' | 'remove',
): { removedBlankLines: number; removedDuplicates: number; selected: Set<number> } {
  const selected = new Set<number>();
  const seen = new Set<string>();
  let removedBlankLines = 0;
  let removedDuplicates = 0;

  for (let step = 0; step < lines.length; step += 1) {
    const index = keep === 'first' ? step : lines.length - step - 1;
    const line = lines[index];

    if (line === undefined) continue;

    if (line.blank && blankLines === 'remove') {
      removedBlankLines += 1;
    } else if (line.blank && blankLines === 'keep') {
      selected.add(index);
    } else if (seen.has(line.key)) {
      removedDuplicates += 1;
    } else {
      seen.add(line.key);
      selected.add(index);
    }
  }

  return { removedBlankLines, removedDuplicates, selected };
}

export function deduplicateLinesDetailed(
  text: string,
  options: DeduplicateLinesOptions = {},
): DeduplicateLinesResult {
  validateDeduplicateInput(text);

  const keep = options.keep ?? 'first';
  const blankLines = options.blankLines ?? 'deduplicate';

  if (keep !== 'first' && keep !== 'last')
    throw new FunctionError('INVALID_TEXT', 'Choose First occurrence or Last occurrence.');
  if (!['deduplicate', 'keep', 'remove'].includes(blankLines))
    throw new FunctionError('INVALID_TEXT', 'Choose a valid blank-line policy.');

  const lines = parseLines(text, options);
  const { removedBlankLines, removedDuplicates, selected } = selectLines(lines, keep, blankLines);
  const resultText = lines
    .filter((_, index) => selected.has(index))
    .map((line) => line.text + line.ending)
    .join('');
  let outputLines = 0;

  for (const match of resultText.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === resultText.length) break;

    outputLines += 1;
  }

  return {
    inputLines: lines.length,
    lineStructureChanged: outputLines !== selected.size,
    outputLines,
    removedBlankLines,
    removedDuplicates,
    retainedLines: selected.size,
    text: resultText,
  };
}

export function deduplicateLines(text: string, caseSensitive = false): string {
  return deduplicateLinesDetailed(text, { caseSensitive }).text;
}
