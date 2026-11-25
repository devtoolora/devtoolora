import { FunctionError } from '../errors';

export type AffixLinesOptions = {
  blankLines?: 'skip' | 'include';
  mode?: 'add' | 'remove';
  placement?: 'line-start' | 'after-indent';
  prefix?: string;
  repeat?: 'always' | 'if-missing';
  suffix?: string;
};
export type AffixLinesResult = {
  changedLines: number;
  inputLines: number;
  lineStructureChanged: boolean;
  outputLines: number;
  prefixChanges: number;
  skippedBlankLines: number;
  suffixChanges: number;
  text: string;
};

function validateText(text: string, label: string, limit: number, singleLine = false): void {
  if (text.length > limit)
    throw new FunctionError(
      'INVALID_TEXT',
      `${label} is limited to ${limit.toLocaleString('en-US')} UTF-16 units.`,
    );
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      `${label} must be valid Unicode without NUL or unpaired surrogates.`,
    );
  if (singleLine && /[\r\n]/.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      `${label} must be single-line literal text without CR or LF.`,
    );
}

type AffixSettings = {
  blankLines: 'skip' | 'include';
  mode: 'add' | 'remove';
  placement: 'line-start' | 'after-indent';
  prefix: string;
  repeat: 'always' | 'if-missing';
  suffix: string;
};
type AffixedBody = { body: string; prefixChanged: boolean; suffixChanged: boolean };

function resolveAffixSettings(text: string, options: AffixLinesOptions): AffixSettings {
  const blankLines = options.blankLines ?? 'skip';
  const mode = options.mode ?? 'add';
  const placement = options.placement ?? 'line-start';
  const prefix = options.prefix ?? '';
  const repeat = mode === 'remove' ? 'always' : (options.repeat ?? 'always');
  const suffix = options.suffix ?? '';

  validateText(text, 'Input', 100_000);
  validateText(prefix, 'Prefix', 1_000, true);
  validateText(suffix, 'Suffix', 1_000, true);
  if (blankLines !== 'skip' && blankLines !== 'include')
    throw new FunctionError('INVALID_TEXT', 'Choose Skip or Include blank lines.');
  if (mode !== 'add' && mode !== 'remove')
    throw new FunctionError('INVALID_TEXT', 'Choose Add or Remove mode.');
  if (placement !== 'line-start' && placement !== 'after-indent')
    throw new FunctionError('INVALID_TEXT', 'Choose Line start or After indentation.');
  if (repeat !== 'always' && repeat !== 'if-missing')
    throw new FunctionError('INVALID_TEXT', 'Choose Always add or Add only if missing.');

  return { blankLines, mode, placement, prefix, repeat, suffix };
}

function addAffixes(body: string, settings: AffixSettings): AffixedBody {
  const { prefix, repeat, suffix } = settings;
  const prefixChanged = prefix.length > 0 && (repeat === 'always' || !body.startsWith(prefix));
  const suffixChanged = suffix.length > 0 && (repeat === 'always' || !body.endsWith(suffix));

  return {
    body: (prefixChanged ? prefix : '') + body + (suffixChanged ? suffix : ''),
    prefixChanged,
    suffixChanged,
  };
}

function removeAffixes(body: string, settings: AffixSettings): AffixedBody {
  const { prefix, suffix } = settings;
  let result = body;
  let prefixChanged = false;
  let suffixChanged = false;

  if (prefix.length > 0 && result.startsWith(prefix)) {
    result = result.slice(prefix.length);
    prefixChanged = true;
  }

  if (suffix.length > 0 && result.endsWith(suffix)) {
    result = result.slice(0, -suffix.length);
    suffixChanged = true;
  }

  return { body: result, prefixChanged, suffixChanged };
}

function affixBody(body: string, settings: AffixSettings): AffixedBody {
  const indent = settings.placement === 'after-indent' ? (body.match(/^[ \t]*/)?.[0] ?? '') : '';
  const affixed = (settings.mode === 'add' ? addAffixes : removeAffixes)(
    body.slice(indent.length),
    settings,
  );

  return { ...affixed, body: indent + affixed.body };
}

function countPhysicalLines(text: string): number {
  let lines = 0;

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    lines += 1;
  }

  return lines;
}

export function affixLinesDetailed(
  text: string,
  options: AffixLinesOptions = {},
): AffixLinesResult {
  const settings = resolveAffixSettings(text, options);
  const chunks: string[] = [];
  let changedLines = 0;
  let inputLines = 0;
  let outputLength = 0;
  let prefixChanges = 0;
  let skippedBlankLines = 0;
  let suffixChanges = 0;

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    inputLines += 1;
    if (inputLines > 10_000)
      throw new FunctionError('INVALID_TEXT', 'Input is limited to 10,000 physical lines.');

    const original = match[1]!;
    let body = original;

    if (settings.blankLines === 'skip' && /^[ \t]*$/.test(body)) {
      skippedBlankLines += 1;
    } else {
      const affixed = affixBody(body, settings);

      body = affixed.body;
      if (affixed.prefixChanged) prefixChanges += 1;
      if (affixed.suffixChanged) suffixChanges += 1;
    }

    if (body !== original) changedLines += 1;

    outputLength += body.length + match[2]!.length;
    if (outputLength > 1_000_000)
      throw new FunctionError(
        'INVALID_TEXT',
        'Result exceeds 1,000,000 UTF-16 units. Use shorter affixes or fewer lines.',
      );

    chunks.push(body + match[2]!);
  }

  const resultText = chunks.join('');
  const outputLines = countPhysicalLines(resultText);

  return {
    changedLines,
    inputLines,
    lineStructureChanged: outputLines !== inputLines,
    outputLines,
    prefixChanges,
    skippedBlankLines,
    suffixChanges,
    text: resultText,
  };
}

export function affixLines(text: string, prefix = '', suffix = ''): string {
  return affixLinesDetailed(text, { blankLines: 'include', prefix, suffix }).text;
}
