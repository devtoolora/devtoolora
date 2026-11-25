import { FunctionError } from '../errors';

export type InvisibleGroup =
  'common' | 'layout' | 'joiners' | 'bidi' | 'math' | 'selectors' | 'tags';
export type InvisibleScope = 'common' | 'layout' | 'joiners' | 'bidi' | 'selectors' | 'all';
export type InvisibleOptions = { mode?: 'detect' | 'remove'; scope?: InvisibleScope };
export type InvisibleCharacterInfo = {
  group: InvisibleGroup;
  name: string;
  purpose: string;
  tag: string;
};
export type InvisibleMatch = {
  character: string;
  codePoint: string;
  column: number;
  context: string;
  end: number;
  group: InvisibleGroup;
  index: number;
  line: number;
  name: string;
  pointIndex: number;
  purpose: string;
  removed: boolean;
};
export type InvisibleResult = {
  annotatedText: string;
  count: number;
  groups: Record<InvisibleGroup, number>;
  inputLines: number;
  lineStructureChanged: boolean;
  matches: InvisibleMatch[];
  outputLines: number;
  removed: number;
  text: string;
};

const known: Partial<Record<number, InvisibleCharacterInfo>> = {
  0x00ad: {
    group: 'layout',
    name: 'SOFT HYPHEN',
    purpose: 'Optional hyphenation; can be visible at a line break.',
    tag: 'SHY',
  },
  0x034f: {
    group: 'joiners',
    name: 'COMBINING GRAPHEME JOINER',
    purpose: 'Can affect canonical mark ordering; not ordinary whitespace.',
    tag: 'CGJ',
  },
  0x061c: {
    group: 'bidi',
    name: 'ARABIC LETTER MARK',
    purpose: 'Affects bidirectional display ordering.',
    tag: 'ALM',
  },
  0x180b: {
    group: 'selectors',
    name: 'MONGOLIAN FREE VARIATION SELECTOR ONE',
    purpose: 'Selects a Mongolian glyph variant.',
    tag: 'FVS1',
  },
  0x180c: {
    group: 'selectors',
    name: 'MONGOLIAN FREE VARIATION SELECTOR TWO',
    purpose: 'Selects a Mongolian glyph variant.',
    tag: 'FVS2',
  },
  0x180d: {
    group: 'selectors',
    name: 'MONGOLIAN FREE VARIATION SELECTOR THREE',
    purpose: 'Selects a Mongolian glyph variant.',
    tag: 'FVS3',
  },
  0x180e: {
    group: 'joiners',
    name: 'MONGOLIAN VOWEL SEPARATOR',
    purpose: 'Can affect Mongolian shaping.',
    tag: 'MVS',
  },
  0x180f: {
    group: 'selectors',
    name: 'MONGOLIAN FREE VARIATION SELECTOR FOUR',
    purpose: 'Selects a Mongolian glyph variant.',
    tag: 'FVS4',
  },
  0x200b: {
    group: 'common',
    name: 'ZERO WIDTH SPACE',
    purpose: 'Provides a break opportunity; removal can join words.',
    tag: 'ZWSP',
  },
  0x200c: {
    group: 'joiners',
    name: 'ZERO WIDTH NON-JOINER',
    purpose: 'Can change joining and shaping in scripts.',
    tag: 'ZWNJ',
  },
  0x200d: {
    group: 'joiners',
    name: 'ZERO WIDTH JOINER',
    purpose: 'Can join emoji sequences or affect script shaping.',
    tag: 'ZWJ',
  },
  0x200e: {
    group: 'bidi',
    name: 'LEFT-TO-RIGHT MARK',
    purpose: 'Affects bidirectional display ordering.',
    tag: 'LRM',
  },
  0x200f: {
    group: 'bidi',
    name: 'RIGHT-TO-LEFT MARK',
    purpose: 'Affects bidirectional display ordering.',
    tag: 'RLM',
  },
  0x2060: {
    group: 'layout',
    name: 'WORD JOINER',
    purpose: 'Prevents certain line breaks.',
    tag: 'WJ',
  },
  0x2061: {
    group: 'math',
    name: 'FUNCTION APPLICATION',
    purpose: 'Invisible mathematical application operator.',
    tag: 'FUNCTION',
  },
  0x2062: {
    group: 'math',
    name: 'INVISIBLE TIMES',
    purpose: 'Invisible multiplication operator; removal can change meaning.',
    tag: 'TIMES',
  },
  0x2063: {
    group: 'math',
    name: 'INVISIBLE SEPARATOR',
    purpose: 'Invisible mathematical separator.',
    tag: 'SEPARATOR',
  },
  0x2064: {
    group: 'math',
    name: 'INVISIBLE PLUS',
    purpose: 'Invisible mathematical addition operator.',
    tag: 'PLUS',
  },
  0xfeff: {
    group: 'common',
    name: 'ZERO WIDTH NO-BREAK SPACE / BOM',
    purpose: 'BOM at source start; deprecated word-joining use elsewhere.',
    tag: 'BOM',
  },
  0xe0001: {
    group: 'tags',
    name: 'LANGUAGE TAG',
    purpose: 'Deprecated language-tag control.',
    tag: 'LANGTAG',
  },
};
const bidiEmbeddings: Array<{ name: string; tag: string }> = [
  { name: 'LEFT-TO-RIGHT EMBEDDING', tag: 'LRE' },
  { name: 'RIGHT-TO-LEFT EMBEDDING', tag: 'RLE' },
  { name: 'POP DIRECTIONAL FORMATTING', tag: 'PDF' },
  { name: 'LEFT-TO-RIGHT OVERRIDE', tag: 'LRO' },
  { name: 'RIGHT-TO-LEFT OVERRIDE', tag: 'RLO' },
];
const bidiIsolates: Array<{ name: string; tag: string }> = [
  { name: 'LEFT-TO-RIGHT ISOLATE', tag: 'LRI' },
  { name: 'RIGHT-TO-LEFT ISOLATE', tag: 'RLI' },
  { name: 'FIRST STRONG ISOLATE', tag: 'FSI' },
  { name: 'POP DIRECTIONAL ISOLATE', tag: 'PDI' },
];

function bidiControl(point: number): { name: string; tag: string } | undefined {
  if (point >= 0x202a && point <= 0x202e) return bidiEmbeddings[point - 0x202a];
  if (point >= 0x2066 && point <= 0x2069) return bidiIsolates[point - 0x2066];

  return undefined;
}

// VS1-VS16 live in one block and VS17-VS256 in a supplementary one.
function variationSelectorNumber(point: number): number | undefined {
  if (point >= 0xfe00 && point <= 0xfe0f) return point - 0xfe00 + 1;
  if (point >= 0xe0100 && point <= 0xe01ef) return point - 0xe0100 + 17;

  return undefined;
}

export function describeInvisible(point: number): InvisibleCharacterInfo | undefined {
  if (point < 0x00ad || point > 0xe01ef) return undefined;
  if (known[point]) return known[point];

  const bidi = bidiControl(point);

  if (bidi)
    return {
      ...bidi,
      group: 'bidi',
      purpose:
        'Affects bidirectional display ordering; removal can change surrounding text rendering.',
    };

  const selector = variationSelectorNumber(point);

  if (selector !== undefined)
    return {
      group: 'selectors',
      name: `VARIATION SELECTOR-${selector}`,
      purpose: 'Selects glyph or emoji presentation; removal can change appearance.',
      tag: `VS${selector}`,
    };
  if (point >= 0xe0020 && point <= 0xe007f)
    return {
      group: 'tags',
      name:
        point === 0xe007f
          ? 'CANCEL TAG'
          : `TAG CHARACTER U+${(point - 0xe0000).toString(16).toUpperCase().padStart(4, '0')}`,
      purpose: 'Can participate in emoji tag sequences or tagging.',
      tag:
        point === 0xe007f
          ? 'ENDTAG'
          : `TAG-${(point - 0xe0000).toString(16).toUpperCase().padStart(4, '0')}`,
    };

  return undefined;
}

export function markInvisibleText(text: string): string {
  const pieces: string[] = [];

  for (const character of text) {
    const info = describeInvisible(character.codePointAt(0) ?? 0);

    pieces.push(info ? `[${info.tag}]` : character);
  }

  return pieces.join('');
}

function contextOf(text: string, index: number, end: number): string {
  let start = Math.max(0, index - 12);
  let finish = Math.min(text.length, end + 12);

  if (start > 0 && text.charCodeAt(start) >= 0xdc00 && text.charCodeAt(start) <= 0xdfff) start -= 1;
  if (
    finish < text.length &&
    text.charCodeAt(finish - 1) >= 0xd800 &&
    text.charCodeAt(finish - 1) <= 0xdbff
  )
    finish += 1;

  return (
    (start > 0 ? '…' : '') +
    markInvisibleText(text.slice(start, finish))
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t') +
    (finish < text.length ? '…' : '')
  );
}

function physicalLines(text: string): number {
  let count = 0;

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    count += 1;
  }

  return count;
}

function resolveRemovalScope(text: string, options: InvisibleOptions) {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode without NUL or unpaired surrogates.',
    );

  const mode = options.mode ?? 'detect';
  const scope = mode === 'remove' ? (options.scope ?? 'common') : 'common';

  if (mode !== 'detect' && mode !== 'remove')
    throw new FunctionError('INVALID_TEXT', 'Choose Detect or Remove.');
  if (!['common', 'layout', 'joiners', 'bidi', 'selectors', 'all'].includes(scope))
    throw new FunctionError('INVALID_TEXT', 'Choose a valid removal scope.');

  return { mode, scope };
}

function inRemovalScope(group: InvisibleGroup, scope: string): boolean {
  return (
    scope === 'all' ||
    scope === group ||
    (scope === 'layout' && group === 'common') ||
    (scope === 'selectors' && group === 'tags')
  );
}

type Cursor = {
  column: number;
  index: number;
  line: number;
  pointIndex: number;
  previousCR: boolean;
};

function advanceCursor(cursor: Cursor, character: string): void {
  if (character === '\r') {
    cursor.line += 1;
    cursor.column = 1;
  } else if (character === '\n') {
    if (!cursor.previousCR) cursor.line += 1;

    cursor.column = 1;
  } else cursor.column += character.length;

  cursor.previousCR = character === '\r';
  cursor.index += character.length;
  cursor.pointIndex += 1;
}

function createInvisibleMatch(
  text: string,
  character: string,
  info: NonNullable<ReturnType<typeof describeInvisible>>,
  cursor: Cursor,
  removed: boolean,
): InvisibleMatch {
  const { column, index, line, pointIndex } = cursor;

  return {
    character,
    codePoint: `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
    column,
    context: contextOf(text, index, index + character.length),
    end: index + character.length,
    group: info.group,
    index,
    line,
    name: info.name,
    pointIndex,
    purpose: info.purpose,
    removed,
  };
}

export function inspectInvisibleText(
  text: string,
  options: InvisibleOptions = {},
): InvisibleResult {
  const { mode, scope } = resolveRemovalScope(text, options);
  const groups: Record<InvisibleGroup, number> = {
    bidi: 0,
    common: 0,
    joiners: 0,
    layout: 0,
    math: 0,
    selectors: 0,
    tags: 0,
  };
  const matches: InvisibleMatch[] = [];
  const pieces: string[] = [];
  const cursor: Cursor = { column: 1, index: 0, line: 1, pointIndex: 0, previousCR: false };
  let removed = 0;

  for (const character of text) {
    const info = describeInvisible(character.codePointAt(0) ?? 0);
    let remove = false;

    if (info) {
      if (matches.length >= 10_000)
        throw new FunctionError(
          'INVALID_TEXT',
          'More than 10,000 detected characters. Reduce input; no partial report or cleanup is returned.',
        );

      remove = mode === 'remove' && inRemovalScope(info.group, scope);

      groups[info.group] += 1;
      if (remove) removed += 1;

      matches.push(createInvisibleMatch(text, character, info, cursor, remove));
    }

    if (!remove) pieces.push(character);

    advanceCursor(cursor, character);
  }

  const cleanedText = pieces.join('');
  const inputLines = physicalLines(text);
  const outputLines = physicalLines(cleanedText);

  return {
    annotatedText: markInvisibleText(text),
    count: matches.length,
    groups,
    inputLines,
    lineStructureChanged: inputLines !== outputLines,
    matches,
    outputLines,
    removed,
    text: cleanedText,
  };
}
