import { FunctionError } from '../errors';

export type IndentationOptions = {
  amount?: number;
  blankLines?: 'skip' | 'include';
  mode?: 'indent' | 'dedent' | 'common';
  partial?: 'exact' | 'up-to';
  unit?: 'spaces' | 'tabs';
};
export type IndentationResult = {
  changedLines: number;
  commonPrefix?: string;
  inputLines: number;
  lineStructureChanged: boolean;
  outputLines: number;
  skippedBlankLines: number;
  spacesAdded: number;
  spacesRemoved: number;
  tabsAdded: number;
  tabsRemoved: number;
  text: string;
};
type Line = { blank: boolean; ending: string; text: string };

function splitIndentLines(text: string): Line[] {
  const lines: Line[] = [];

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    const lineText = match[1]!;

    lines.push({ blank: /^[ \t]*$/.test(lineText), ending: match[2]!, text: lineText });
    if (lines.length > 10_000)
      throw new FunctionError('INVALID_TEXT', 'Input is limited to 10,000 physical lines.');
  }

  return lines;
}

function commonIndentPrefix(lines: Line[]): string {
  let commonPrefix: string | undefined;

  for (const line of lines) {
    if (line.blank) continue;

    const prefix = line.text.match(/^[ \t]*/)?.[0] ?? '';

    if (commonPrefix === undefined) commonPrefix = prefix;
    else {
      let length = 0;

      while (
        length < Math.min(commonPrefix.length, prefix.length) &&
        commonPrefix[length] === prefix[length]
      )
        length += 1;
      commonPrefix = commonPrefix.slice(0, length);
    }

    if (commonPrefix.length === 0) break;
  }

  return commonPrefix ?? '';
}

function countLines(text: string): number {
  let count = 0;

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    count += 1;
  }

  return count;
}

type IndentSettings = {
  amount: number;
  blankLines: 'skip' | 'include';
  character: '\t' | ' ';
  commonPrefix: string | undefined;
  fixedPrefix: string;
  mode: 'indent' | 'dedent' | 'common';
  partial: 'exact' | 'up-to';
};

function resolveIndentSettings(
  text: string,
  options: IndentationOptions,
): Omit<IndentSettings, 'commonPrefix'> {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode without NUL or unpaired surrogates.',
    );

  const mode = options.mode ?? 'indent';
  const blankLines = options.blankLines ?? 'skip';
  const amount = mode === 'common' ? 0 : (options.amount ?? 2);
  const unit = mode === 'common' ? 'spaces' : (options.unit ?? 'spaces');
  const partial = mode === 'dedent' ? (options.partial ?? 'up-to') : 'exact';

  if (mode !== 'indent' && mode !== 'dedent' && mode !== 'common')
    throw new FunctionError('INVALID_TEXT', 'Choose Indent, Dedent or Remove common prefix.');
  if (blankLines !== 'skip' && blankLines !== 'include')
    throw new FunctionError('INVALID_TEXT', 'Choose Skip or Include blank lines.');
  if (!Number.isInteger(amount) || amount < 0 || amount > 64)
    throw new FunctionError('INVALID_TEXT', 'Amount must be an integer from 0 through 64.');
  if (unit !== 'spaces' && unit !== 'tabs')
    throw new FunctionError('INVALID_TEXT', 'Choose Spaces or Tabs.');
  if (partial !== 'exact' && partial !== 'up-to')
    throw new FunctionError('INVALID_TEXT', 'Choose Exact amount or Up to amount.');

  const character = unit === 'tabs' ? '\t' : ' ';

  return {
    amount,
    blankLines,
    character,
    fixedPrefix: character.repeat(amount),
    mode,
    partial,
  };
}

function indentChange(body: string, settings: IndentSettings): { added: string; removed: string } {
  const { amount, character, commonPrefix, fixedPrefix, mode, partial } = settings;

  if (mode === 'indent') return { added: fixedPrefix, removed: '' };
  if (mode === 'common')
    return { added: '', removed: body.startsWith(commonPrefix ?? '') ? (commonPrefix ?? '') : '' };
  if (partial === 'exact')
    return { added: '', removed: body.startsWith(fixedPrefix) ? fixedPrefix : '' };

  let count = 0;

  while (count < amount && body[count] === character) count += 1;

  return { added: '', removed: body.slice(0, count) };
}

export function adjustIndentation(
  text: string,
  options: IndentationOptions = {},
): IndentationResult {
  const resolved = resolveIndentSettings(text, options);
  const lines = splitIndentLines(text);
  const commonPrefix = resolved.mode === 'common' ? commonIndentPrefix(lines) : undefined;
  const settings = { ...resolved, commonPrefix };
  const chunks: string[] = [];
  let changedLines = 0;
  let skippedBlankLines = 0;
  let spacesAdded = 0;
  let spacesRemoved = 0;
  let tabsAdded = 0;
  let tabsRemoved = 0;
  let size = 0;

  for (const line of lines) {
    let added = '';
    let removed = '';

    if (line.blank && settings.blankLines === 'skip') skippedBlankLines += 1;
    else ({ added, removed } = indentChange(line.text, settings));

    const body = added + line.text.slice(removed.length);

    if (body !== line.text) changedLines += 1;

    spacesAdded += added.split(' ').length - 1;
    spacesRemoved += removed.split(' ').length - 1;
    tabsAdded += added.split('\t').length - 1;
    tabsRemoved += removed.split('\t').length - 1;
    size += body.length + line.ending.length;
    if (size > 1_000_000)
      throw new FunctionError(
        'INVALID_TEXT',
        'Result exceeds 1,000,000 UTF-16 units; no partial output is returned.',
      );

    chunks.push(body + line.ending);
  }

  const resultText = chunks.join('');
  const outputLines = countLines(resultText);

  return {
    changedLines,
    commonPrefix,
    inputLines: lines.length,
    lineStructureChanged: outputLines !== lines.length,
    outputLines,
    skippedBlankLines,
    spacesAdded,
    spacesRemoved,
    tabsAdded,
    tabsRemoved,
    text: resultText,
  };
}
