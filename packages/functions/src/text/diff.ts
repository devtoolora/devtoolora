import { FunctionError } from '../errors';

export type TextDiffOptions = {
  ignoreCase?: boolean;
  ignoreLineEndings?: boolean;
  ignoreWhitespace?: boolean;
};
export type TextDiffLine = {
  ending: 'CR' | 'CRLF' | 'LF' | 'none';
  highlight?: { end: number; start: number };
  number: number;
  text: string;
};
export type TextDiffRow = {
  after?: TextDiffLine;
  before?: TextDiffLine;
  kind: 'added' | 'changed' | 'removed' | 'unchanged';
};
export type TextDiffResult = {
  added: number;
  afterLines: number;
  beforeLines: number;
  equivalent: number;
  options: Required<TextDiffOptions>;
  removed: number;
  rows: TextDiffRow[];
  unchanged: number;
};
type Operation = { after?: number; before?: number; kind: 'added' | 'removed' | 'same' };

const lineEndingNames = new Map<string, TextDiffLine['ending']>([
  ['\r\n', 'CRLF'],
  ['\r', 'CR'],
  ['\n', 'LF'],
]);

function splitLines(text: string): TextDiffLine[] {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Each text is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode text without NUL or unpaired surrogates.',
    );

  const lines: TextDiffLine[] = [];
  const pattern = /([^\r\n]*)(\r\n|\r|\n|$)/g;

  for (const match of text.matchAll(pattern)) {
    if (match.index === text.length) break;

    const ending = lineEndingNames.get(match[2]!) ?? 'none';

    lines.push({ ending, number: lines.length + 1, text: match[1]! });
    if (lines.length > 10_000)
      throw new FunctionError('INVALID_TEXT', 'Each text is limited to 10,000 physical lines.');
  }

  return lines;
}

// Unvisited Myers cells hold -1, so that is also the out-of-range value.
function cell(vector: Int32Array, index: number): number {
  return vector[index] ?? -1;
}

function backtrack(
  trace: Int32Array[],
  offset: number,
  beforeLength: number,
  afterLength: number,
): Operation[] {
  const operations: Operation[] = [];
  let x = beforeLength;
  let y = afterLength;

  for (let distance = trace.length - 1; distance >= 0; distance -= 1) {
    const vector = trace[distance]!;
    const diagonal = x - y;
    const previousDiagonal =
      diagonal === -distance ||
      (diagonal !== distance &&
        cell(vector, offset + diagonal - 1) < cell(vector, offset + diagonal + 1))
        ? diagonal + 1
        : diagonal - 1;
    const previousX = cell(vector, offset + previousDiagonal);
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      operations.push({ after: y, before: x, kind: 'same' });
    }

    if (distance === 0) break;

    if (x === previousX) {
      y -= 1;
      operations.push({ after: y, kind: 'added' });
    } else {
      x -= 1;
      operations.push({ before: x, kind: 'removed' });
    }
  }

  return operations.reverse();
}

function shortestEdits(before: number[], after: number[]): Operation[] {
  const beforeKeys = new Set(before);

  if (!before.length || !after.length || !after.some((key) => beforeKeys.has(key))) {
    return [
      ...before.map((_, index): Operation => ({ before: index, kind: 'removed' })),
      ...after.map((_, index): Operation => ({ after: index, kind: 'added' })),
    ];
  }

  const maximumDistance = Math.min(before.length + after.length, 1024);
  const offset = maximumDistance + 1;
  const vector = new Int32Array(maximumDistance * 2 + 3).fill(-1);

  vector[offset + 1] = 0;
  const trace: Int32Array[] = [];
  let work = 0;

  for (let distance = 0; distance <= maximumDistance; distance += 1) {
    trace.push(vector.slice());

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let x =
        diagonal === -distance ||
        (diagonal !== distance &&
          cell(vector, offset + diagonal - 1) < cell(vector, offset + diagonal + 1))
          ? cell(vector, offset + diagonal + 1)
          : cell(vector, offset + diagonal - 1) + 1;
      let y = x - diagonal;

      work += 1;

      while (x < before.length && y < after.length && before[x] === after[y]) {
        x += 1;
        y += 1;
        work += 1;
      }

      if (work > 2_000_000)
        throw new FunctionError(
          'INVALID_TEXT',
          'Diff exceeds the 2,000,000-step comparison budget. Compare smaller sections.',
        );

      vector[offset + diagonal] = x;
      if (x >= before.length && y >= after.length)
        return backtrack(trace, offset, before.length, after.length);
    }
  }

  throw new FunctionError(
    'INVALID_TEXT',
    'Ambiguous diff exceeds 1,024 insertions/deletions. Compare smaller sections; no partial diff was returned.',
  );
}

function highlightedPair(
  before: TextDiffLine,
  after: TextDiffLine,
): { after: TextDiffLine; before: TextDiffLine } {
  const left = Array.from(before.text);
  const right = Array.from(after.text);
  let prefix = 0;
  let suffix = 0;

  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix])
    prefix += 1;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - suffix - 1] === right[right.length - suffix - 1]
  )
    suffix += 1;
  const start = left.slice(0, prefix).join('').length;

  return {
    after: {
      ...after,
      highlight: {
        end: after.text.length - right.slice(right.length - suffix).join('').length,
        start,
      },
    },
    before: {
      ...before,
      highlight: {
        end: before.text.length - left.slice(left.length - suffix).join('').length,
        start,
      },
    },
  };
}

function alignedRows(
  operations: Operation[],
  before: TextDiffLine[],
  after: TextDiffLine[],
): TextDiffRow[] {
  const rows: TextDiffRow[] = [];
  let index = 0;

  while (index < operations.length) {
    const operation = operations[index]!;

    if (operation.kind === 'same') {
      rows.push({
        after: after[operation.after ?? 0],
        before: before[operation.before ?? 0],
        kind: 'unchanged',
      });

      index += 1;

      continue;
    }

    const removed: TextDiffLine[] = [];
    const added: TextDiffLine[] = [];

    while (index < operations.length && operations[index]!.kind !== 'same') {
      const change = operations[index++]!;

      const removedLine = change.before === undefined ? undefined : before[change.before];
      const addedLine = change.after === undefined ? undefined : after[change.after];

      if (removedLine !== undefined) removed.push(removedLine);
      if (addedLine !== undefined) added.push(addedLine);
    }

    for (let row = 0; row < Math.max(removed.length, added.length); row += 1) {
      const removedLine = removed[row];
      const addedLine = added[row];

      if (removedLine && addedLine)
        rows.push({ ...highlightedPair(removedLine, addedLine), kind: 'changed' });
      else if (removedLine) rows.push({ before: removedLine, kind: 'removed' });
      else if (addedLine) rows.push({ after: addedLine, kind: 'added' });
    }
  }

  return rows;
}

function resolveDiffSettings(options: TextDiffOptions): Required<TextDiffOptions> {
  const settings = {
    ignoreCase: options.ignoreCase ?? false,
    ignoreLineEndings: options.ignoreLineEndings ?? false,
    ignoreWhitespace: options.ignoreWhitespace ?? false,
  };

  if (Object.values(settings).some((value) => typeof value !== 'boolean'))
    throw new FunctionError('INVALID_TEXT', 'Diff comparison options must be boolean.');

  return settings;
}

function createLineKey(settings: Required<TextDiffOptions>): (line: TextDiffLine) => number {
  const interned = new Map<string, number>();

  return (line) => {
    let text = settings.ignoreWhitespace
      ? line.text.replace(/[ \t]+/g, ' ').replace(/^ | $/g, '')
      : line.text;

    // Uppercasing the lowercase form also matches full case mappings such as ß/ẞ → SS and ς → Σ.
    if (settings.ignoreCase) text = text.toLowerCase().toUpperCase();

    const normalized = JSON.stringify([text, settings.ignoreLineEndings ? '' : line.ending]);
    const existing = interned.get(normalized);

    if (existing !== undefined) return existing;

    const id = interned.size;

    interned.set(normalized, id);

    return id;
  };
}

function diffOperations(left: number[], right: number[]): Operation[] {
  let prefix = 0;
  let suffix = 0;

  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix])
    prefix += 1;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - suffix - 1] === right[right.length - suffix - 1]
  )
    suffix += 1;
  const operations: Operation[] = Array.from({ length: prefix }, (_, index) => ({
    after: index,
    before: index,
    kind: 'same',
  }));

  operations.push(
    ...shortestEdits(
      left.slice(prefix, left.length - suffix),
      right.slice(prefix, right.length - suffix),
    ).map((operation) => ({
      ...operation,
      after: operation.after !== undefined ? operation.after + prefix : undefined,
      before: operation.before !== undefined ? operation.before + prefix : undefined,
    })),
  );

  for (let index = suffix; index > 0; index -= 1)
    operations.push({ after: right.length - index, before: left.length - index, kind: 'same' });

  return operations;
}

export function compareTextLines(
  beforeText: string,
  afterText: string,
  options: TextDiffOptions = {},
): TextDiffResult {
  const settings = resolveDiffSettings(options);
  const before = splitLines(beforeText);
  const after = splitLines(afterText);
  const key = createLineKey(settings);
  const operations = diffOperations(before.map(key), after.map(key));
  const rows = alignedRows(operations, before, after);

  return {
    added: operations.filter((operation) => operation.kind === 'added').length,
    afterLines: after.length,
    beforeLines: before.length,
    equivalent: rows.filter(
      (row) =>
        row.kind === 'unchanged' &&
        (row.before?.text !== row.after?.text || row.before?.ending !== row.after?.ending),
    ).length,
    options: settings,
    removed: operations.filter((operation) => operation.kind === 'removed').length,
    rows,
    unchanged: operations.filter((operation) => operation.kind === 'same').length,
  };
}

export function formatTextDiff(
  result: TextDiffResult,
  { endings = true, title = 'Text Diff report' }: { endings?: boolean; title?: string } = {},
): string {
  const suffix = (ending: string): string => (endings ? ` [${ending}]` : '');
  const lines = [
    `${title} (not an applyable patch)`,
    `Comparison options: ${JSON.stringify(result.options)}`,
    `Added: ${result.added}; removed: ${result.removed}; matched: ${result.unchanged}; equivalent but not identical: ${result.equivalent}`,
    '',
  ];

  for (const row of result.rows) {
    lines.push(`[${row.kind}]`);
    if (row.before)
      lines.push(
        `Before ${row.before.number}: ${JSON.stringify(row.before.text)}${suffix(row.before.ending)}`,
      );
    if (row.after)
      lines.push(
        `After ${row.after.number}: ${JSON.stringify(row.after.text)}${suffix(row.after.ending)}`,
      );
  }

  return lines.join('\n') + '\n';
}

export function diffLines(before: string, after: string): string {
  const result = compareTextLines(before, after);

  return result.rows
    .flatMap((row) => {
      if (row.kind === 'unchanged') return [`  ${row.before?.text ?? ''}`];

      return [
        ...(row.before ? [`- ${row.before.text}`] : []),
        ...(row.after ? [`+ ${row.after.text}`] : []),
      ];
    })
    .join('\n');
}
