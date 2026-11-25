import { FunctionError } from '../errors';
import { replaceRegexMatches, testRegex, type RegexMatch } from './regex';

export type FindReplaceOptions = {
  caseSensitive?: boolean;
  flags?: string;
  occurrence?: 'all' | 'first';
  regex?: boolean;
  replacementMode?: 'literal' | 'tokens';
};
export type FindReplaceResult = { changed: boolean; count: number; flags: string; text: string };

function resolveReplaceFlags(
  text: string,
  find: string,
  replacement: string,
  options: FindReplaceOptions,
): { flags: string; replacementMode: 'literal' | 'tokens' } {
  if (text.length > 100_000 || find.length > 4_000 || replacement.length > 4_000)
    throw new FunctionError(
      'INVALID_TEXT',
      'Find & Replace supports 100,000 input units and 4,000 find/replacement units.',
    );
  if ([text, find, replacement].some((part) => /\u0000|[\uD800-\uDFFF]/u.test(part)))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode without NUL or unpaired surrogates.',
    );

  const occurrence = options.occurrence ?? 'all';

  if (occurrence !== 'all' && occurrence !== 'first')
    throw new FunctionError('INVALID_TEXT', 'Choose All matches or First match.');

  const replacementMode = options.regex ? (options.replacementMode ?? 'tokens') : 'literal';

  if (replacementMode !== 'literal' && replacementMode !== 'tokens')
    throw new FunctionError(
      'INVALID_TEXT',
      'Choose Literal text or JavaScript tokens for replacement.',
    );

  const extraFlags = options.regex ? (options.flags ?? 'u') : 'u';

  if (
    /[^msuv]/.test(extraFlags) ||
    new Set(extraFlags).size !== extraFlags.length ||
    (extraFlags.includes('u') && extraFlags.includes('v'))
  )
    throw new FunctionError(
      'INVALID_REGEX',
      'Extra flags must be unique m s u v flags; u and v cannot be combined. Case and occurrence controls own i and g.',
    );

  const flags = (occurrence === 'all' ? 'g' : '') + (options.caseSensitive ? '' : 'i') + extraFlags;

  return { flags, replacementMode };
}

function findLiteralMatches(text: string, find: string, flags: string): RegexMatch[] {
  if (find.length === 0)
    throw new FunctionError(
      'INVALID_TEXT',
      'Find text is required in literal mode. Use regex mode for an intentional empty pattern.',
    );

  const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  const matches: RegexMatch[] = [];
  const found = pattern.global ? text.matchAll(pattern) : [pattern.exec(text)];

  for (const match of found) {
    if (!match) continue;
    if (matches.length >= 10_000)
      throw new FunctionError(
        'INVALID_TEXT',
        'More than 10,000 literal matches. Reduce the input; no partial result is returned.',
      );

    matches.push({
      captures: [],
      end: match.index + match[0].length,
      groups: {},
      index: match.index,
      match: match[0],
    });
  }

  return matches;
}

export function findReplaceDetailed(
  text: string,
  find: string,
  replacement = '',
  options: FindReplaceOptions = {},
): FindReplaceResult {
  const { flags, replacementMode } = resolveReplaceFlags(text, find, replacement, options);
  const matches = options.regex
    ? testRegex(text, find, flags).matches
    : findLiteralMatches(text, find, flags);
  const resultText = replaceRegexMatches(text, matches, replacement, replacementMode === 'literal');

  if (/\u0000|[\uD800-\uDFFF]/u.test(resultText))
    throw new FunctionError(
      'INVALID_TEXT',
      'Replacement produced NUL or unpaired Unicode surrogates and cannot be exported exactly. Use u or v to match complete Unicode code points.',
    );

  return { changed: resultText !== text, count: matches.length, flags, text: resultText };
}

export function findReplace(
  text: string,
  find: string,
  replacement = '',
  options: FindReplaceOptions = {},
): string {
  return findReplaceDetailed(text, find, replacement, options).text;
}
