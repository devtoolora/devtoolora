import { FunctionError } from '../errors';
import { compareVersionPrecedence, parseSemanticVersion, type SemanticVersion } from './semver';
import { devError } from './shared';

export type SemverRangeReport = {
  desugared: string;
  highest?: string;
  lowest?: string;
  rows: Array<{
    input: string;
    line: number;
    reason?: string;
    status: 'invalid' | 'match' | 'no match';
    version?: string;
  }>;
};

type Operator = '' | '<' | '<=' | '>' | '>=';
type Comparator = { operator: Operator; value: string; version?: SemanticVersion };
type Captured = string | undefined;

// Strict-mode patterns ported from node-semver 7; whitespace is collapsed to single spaces first.
const numeric = '0|[1-9][0-9]*';
const xIdentifier = `${numeric}|x|X|\\*`;
const prereleaseIdentifier = `(?:[0-9]*[a-zA-Z-][a-zA-Z0-9-]*|${numeric})`;
const prerelease = `(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))`;
const build = '(?:\\+([a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*))';
const xRangePlain = `[v= ]*(${xIdentifier})(?:\\.(${xIdentifier})(?:\\.(${xIdentifier})(?:${prerelease})?${build}?)?)?`;
const buildPattern = new RegExp(build, 'g');
const hyphenPattern = new RegExp(`^ ?(${xRangePlain}) - (${xRangePlain}) ?$`);
const comparatorTrimPattern = new RegExp(`( ?)((?:<|>)?=?) ?(${xRangePlain})`, 'g');
const tildePattern = new RegExp(`^~>?${xRangePlain}$`);
const caretPattern = new RegExp(`^\\^${xRangePlain}$`);
const xRangePattern = new RegExp(`^((?:<|>)?=?) ?${xRangePlain}$`);
const nullSet = '<0.0.0-0';

const isX = (id: Captured) => !id || id === 'x' || id === 'X' || id === '*';
const next = (id: Captured) => (BigInt(id ?? '0') + 1n).toString();

const compareResults: Record<Operator, (comparison: number) => boolean> = {
  '': (comparison) => comparison === 0,
  '<': (comparison) => comparison < 0,
  '<=': (comparison) => comparison <= 0,
  '>': (comparison) => comparison > 0,
  '>=': (comparison) => comparison >= 0,
};

function replaceHyphen(range: string, includePrerelease: boolean): string {
  const pre = includePrerelease ? '-0' : '';

  return range.replace(hyphenPattern, (...groups: Captured[]) => {
    const [, from, fM, fm, fp, fpr, , to, tM, tm, tp, tpr] = groups;
    let lower = `>=${from}${fpr ? '' : pre}`;
    let upper = `<=${to}`;

    if (isX(fM)) lower = '';
    else if (isX(fm)) lower = `>=${fM}.0.0${pre}`;
    else if (isX(fp)) lower = `>=${fM}.${fm}.0${pre}`;

    if (isX(tM)) upper = '';
    else if (isX(tm)) upper = `<${next(tM)}.0.0-0`;
    else if (isX(tp)) upper = `<${tM}.${next(tm)}.0-0`;
    else if (includePrerelease && !tpr) upper = `<${tM}.${tm}.${next(tp)}-0`;

    return `${lower} ${upper}`.trim();
  });
}

function replaceTilde(comparator: string, includePrerelease: boolean): string {
  const pre = includePrerelease ? '-0' : '';

  return comparator.replace(
    tildePattern,
    (_, M: Captured, m: Captured, p: Captured, pr: Captured) => {
      if (isX(M)) return '';
      if (isX(m)) return `>=${M}.0.0${pre} <${next(M)}.0.0-0`;
      if (isX(p)) return `>=${M}.${m}.0${pre} <${M}.${next(m)}.0-0`;

      return `>=${M}.${m}.${p}${pr ? `-${pr}` : ''} <${M}.${next(m)}.0-0`;
    },
  );
}

function replaceCaret(comparator: string, includePrerelease: boolean): string {
  const pre = includePrerelease ? '-0' : '';

  return comparator.replace(
    caretPattern,
    (_, M: Captured, m: Captured, p: Captured, pr: Captured) => {
      if (isX(M)) return '';
      if (isX(m)) return `>=${M}.0.0${pre} <${next(M)}.0.0-0`;
      if (isX(p))
        return `>=${M}.${m}.0${pre} <${M === '0' ? `${M}.${next(m)}` : `${next(M)}.0`}.0-0`;

      const lower = `>=${M}.${m}.${p}${pr ? `-${pr}` : ''}`;

      if (M !== '0') return `${lower} <${next(M)}.0.0-0`;

      return m === '0' ? `${lower} <0.0.${next(p)}-0` : `${lower} <0.${next(m)}.0-0`;
    },
  );
}

function replaceXRange(comparator: string, includePrerelease: boolean): string {
  return comparator.replace(
    xRangePattern,
    (match, operator: string, M: Captured, m: Captured, p: Captured) => {
      if ((isX(M) && !isX(m)) || (isX(m) && p && !isX(p))) return match;

      const xm = isX(M) || isX(m);
      const pre = includePrerelease ? '-0' : '';

      if (isX(M)) return operator === '>' || operator === '<' ? nullSet : '*';
      if (!xm && !isX(p)) return match;
      if (operator === '' || operator === '=')
        return xm
          ? `>=${M}.0.0${pre} <${next(M)}.0.0-0`
          : `>=${M}.${m}.0${pre} <${M}.${next(m)}.0-0`;
      if (operator === '>') return xm ? `>=${next(M)}.0.0${pre}` : `>=${M}.${next(m)}.0${pre}`;
      if (operator === '<=') return xm ? `<${next(M)}.0.0-0` : `<${M}.${next(m)}.0-0`;
      if (operator === '<') return `<${M}.${xm ? 0 : m}.0-0`;

      return `>=${M}.${xm ? 0 : m}.0${pre}`;
    },
  );
}

function parseComparator(text: string): Comparator {
  if (text === '') return { operator: '', value: '' };

  const [, operator = '', rest = ''] = /^([<>]?=?)(.*)$/.exec(text) ?? [];

  try {
    const version = parseSemanticVersion(rest.replace(/^v/, ''), 'Comparator');
    const normalized = (operator === '=' ? '' : operator) as Operator;

    return {
      operator: normalized,
      value: `${normalized}${version.version}`,
      version,
    };
  } catch {
    throw devError(`Invalid range: ${text} is not a valid comparator.`);
  }
}

function desugarSet(range: string, includePrerelease: boolean): Comparator[] {
  const trimmed = replaceHyphen(range.replace(buildPattern, ''), includePrerelease)
    .replace(comparatorTrimPattern, '$1$2$3')
    .replace(/( ?)~>? /g, '$1~')
    .replace(/( ?)\^ /g, '$1^');
  const lowest = includePrerelease ? '>=0.0.0-0' : '>=0.0.0';
  const texts = trimmed
    .split(' ')
    .map((text) => {
      const caret = replaceCaret(text, includePrerelease);
      const tilde = caret
        .split(' ')
        .map((part) => replaceTilde(part, includePrerelease))
        .join(' ');
      const xRange = tilde.split(' ').map((part) => replaceXRange(part, includePrerelease));

      return xRange.join(' ').replace(/(<|>)?=? ?\*/, '');
    })
    .join(' ')
    .split(' ')
    .map((text) => (text === lowest ? '' : text));
  const unique = new Map<string, Comparator>();

  for (const comparator of texts.map(parseComparator)) {
    if (comparator.value === nullSet) return [comparator];

    unique.set(comparator.value, comparator);
  }

  if (unique.size > 1) unique.delete('');

  return [...unique.values()];
}

function desugarRange(range: string, includePrerelease: boolean): Comparator[][] {
  if (range.length > 1024) throw devError('Range is limited to 1,024 characters.');

  const sets = range
    .trim()
    .replace(/\s+/g, ' ')
    .split('||')
    .map((set) => desugarSet(set.trim(), includePrerelease));

  if (sets.length === 1) return sets;

  const useful = sets.filter((set) => set[0]?.value !== nullSet);

  if (useful.length === 0) return sets.slice(0, 1);

  const any = useful.find((set) => set.length === 1 && set[0]?.value === '');

  return any ? [any] : useful;
}

function testSet(set: Comparator[], version: SemanticVersion, includePrerelease: boolean): boolean {
  const inRange = set.every(
    ({ operator, version: bound }) =>
      !bound || compareResults[operator](compareVersionPrecedence(version, bound)),
  );

  if (!inRange || version.prerelease.length === 0 || includePrerelease) return inRange;

  // A prerelease only matches when a comparator names a prerelease of the same major.minor.patch.
  return set.some(
    ({ version: bound }) =>
      bound !== undefined &&
      bound.prerelease.length > 0 &&
      bound.core.join('.') === version.core.join('.'),
  );
}

function testLine(
  input: string,
  line: number,
  sets: Comparator[][],
  includePrerelease: boolean,
): { row: SemverRangeReport['rows'][number]; version?: SemanticVersion } {
  try {
    const version = parseSemanticVersion(input.replace(/^([ \t]*)v/, '$1'), `Version line ${line}`);
    const match = sets.some((set) => testSet(set, version, includePrerelease));

    return {
      row: { input, line, status: match ? 'match' : 'no match', version: version.version },
      version: match ? version : undefined,
    };
  } catch (error) {
    if (!(error instanceof FunctionError)) throw error;

    return { row: { input, line, reason: error.message, status: 'invalid' } };
  }
}

export function testSemverRange(
  range: string,
  versions: string,
  options: { includePrerelease: boolean },
): SemverRangeReport {
  const sets = desugarRange(range, options.includePrerelease);
  const lines = versions.split(/\r?\n/);

  if (lines.at(-1) === '') lines.pop();
  if (lines.length > 10_000) throw devError('Versions are limited to 10,000 lines.');

  const rows: SemverRangeReport['rows'] = [];
  let highest: SemanticVersion | undefined;
  let lowest: SemanticVersion | undefined;

  for (const [index, input] of lines.entries()) {
    if (/^[ \t]*$/.test(input)) continue;

    const { row, version } = testLine(input, index + 1, sets, options.includePrerelease);

    rows.push(row);

    if (!version) continue;
    if (!highest || compareVersionPrecedence(version, highest) > 0) highest = version;
    if (!lowest || compareVersionPrecedence(version, lowest) < 0) lowest = version;
  }

  return {
    desugared: sets.map((set) => set.map(({ value }) => value).join(' ') || '*').join(' || '),
    highest: highest?.version,
    lowest: lowest?.version,
    rows,
  };
}
