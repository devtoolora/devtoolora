import { checkLogInput, logError } from './shared';

export function filterLogLines(
  text: string,
  includePattern: string,
  excludePattern: string,
  flags = 'i',
): string {
  checkLogInput(text);
  if (!/^[dimsuv]*$/.test(flags) || new Set(flags).size !== flags.length)
    throw logError(
      'Use unique regex flags d, i, m, s, u or v; global/sticky flags are unsupported.',
    );

  const include = includePattern.trim()
    ? compileLogPattern(includePattern, flags, 'Include')
    : undefined;
  const exclude = excludePattern.trim()
    ? compileLogPattern(excludePattern, flags, 'Exclude')
    : undefined;

  if (!include && !exclude) throw logError('Provide an include or exclude pattern.');

  return text
    .split(/\r\n?|\n/)
    .filter((line) => (!include || include.test(line)) && (!exclude || !exclude.test(line)))
    .join('\n');
}

function compileLogPattern(pattern: string, flags: string, label: string): RegExp {
  if (pattern.length > 1000) throw logError(`${label} pattern exceeds 1,000 characters.`);

  try {
    return new RegExp(pattern, flags);
  } catch {
    throw logError(`${label} pattern is invalid.`);
  }
}
