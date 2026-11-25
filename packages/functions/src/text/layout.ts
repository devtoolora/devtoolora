import { FunctionError } from '../errors';

export type TextLayoutOptions = {
  joinWith?: 'space' | 'none';
  longWords?: 'keep' | 'break';
  mode?: 'wrap' | 'unwrap';
  newLine?: 'match' | 'lf' | 'crlf';
  paragraphs?: 'keep' | 'join';
  spacing?: 'preserve' | 'collapse';
  width?: number;
};
export type TextLayoutResult = {
  inputLines: number;
  insertedBreaks: number;
  joinedBreaks: number;
  longestLineGraphemes?: number;
  outputLines: number;
  overWidthLines: number;
  text: string;
};
type Line = { ending: string; text: string };
type Token = { gap: boolean; parts: string[] };

function splitLines(text: string): Line[] {
  const lines: Line[] = [];

  for (const match of text.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === text.length) break;

    lines.push({ ending: match[2]!, text: match[1]! });
  }

  return lines;
}

function graphemes(text: string, segmenter: Intl.Segmenter): string[] {
  return /^[\x00-\x7F]*$/.test(text)
    ? Array.from(text)
    : Array.from(segmenter.segment(text), (segment) => segment.segment);
}

type WrapLayout = {
  available: number;
  ending: string;
  indent: string;
  indentLength: number;
  longWords: 'keep' | 'break';
  width: number;
};
type WrapState = {
  current: string;
  currentWidth: number;
  gap: string;
  gapWidth: number;
  lines: string[];
  total: number;
};

function tokenizeWords(content: string, segmenter: Intl.Segmenter): Token[] {
  const tokens: Token[] = [];

  for (const part of graphemes(content, segmenter)) {
    const gap = /^[ \t]$/.test(part);
    const last = tokens.at(-1);

    if (last?.gap === gap) last.parts.push(part);
    else tokens.push({ gap, parts: [part] });
  }

  return tokens;
}

function flushWrappedLine(state: WrapState, layout: WrapLayout): void {
  state.total += state.current.length + layout.ending.length;
  if (state.total > 1_000_000)
    throw new FunctionError(
      'INVALID_TEXT',
      'Wrapped result exceeds 1,000,000 UTF-16 units. Increase width or reduce indentation/input.',
    );

  state.lines.push(state.current);
  state.current = layout.indent;
  state.currentWidth = layout.indentLength;
}

function placeToken(state: WrapState, token: Token, layout: WrapLayout): void {
  const { available, indentLength, longWords, width } = layout;

  if (longWords === 'break' && token.parts.length > available) {
    if (state.currentWidth > indentLength) flushWrappedLine(state, layout);

    for (let offset = 0; offset < token.parts.length; offset += available) {
      const chunk = token.parts.slice(offset, offset + available);

      state.current += chunk.join('');
      state.currentWidth += chunk.length;
      if (offset + available < token.parts.length) flushWrappedLine(state, layout);
    }
  } else {
    if (
      state.currentWidth > indentLength &&
      state.currentWidth + state.gapWidth + token.parts.length > width
    )
      flushWrappedLine(state, layout);
    else if (state.currentWidth > indentLength) {
      state.current += state.gap;
      state.currentWidth += state.gapWidth;
    }

    state.current += token.parts.join('');
    state.currentWidth += token.parts.length;
  }

  state.gap = '';
  state.gapWidth = 0;
}

function wrapBody(
  text: string,
  width: number,
  spacing: 'preserve' | 'collapse',
  longWords: 'keep' | 'break',
  ending: string,
  segmenter: Intl.Segmenter,
): { breaks: number; text: string } {
  if (/^[ \t]*$/.test(text)) return { breaks: 0, text };

  const segments = graphemes(text, segmenter);
  let indentLength = 0;

  while (indentLength < segments.length && /^[ \t]$/.test(segments[indentLength]!))
    indentLength += 1;
  const indent = segments.slice(0, indentLength).join('');
  const core = segments.slice(indentLength).join('');
  const content =
    spacing === 'collapse' ? core.replace(/[ \t]+/g, ' ').replace(/(?<![ \t])[ \t]+$/, '') : core;
  const tokens = tokenizeWords(content, segmenter);
  const available = width - indentLength;

  if (longWords === 'break' && available < 1)
    throw new FunctionError(
      'INVALID_TEXT',
      'Indentation consumes the entire wrap width. Increase width or keep long tokens; no partial result is returned.',
    );

  const layout: WrapLayout = { available, ending, indent, indentLength, longWords, width };
  const state: WrapState = {
    current: indent,
    currentWidth: indentLength,
    gap: '',
    gapWidth: 0,
    lines: [],
    total: 0,
  };

  for (const token of tokens) {
    if (token.gap) {
      state.gap = token.parts.join('');
      state.gapWidth = token.parts.length;
    } else placeToken(state, token, layout);
  }

  state.current += state.gap;
  if (state.total + state.current.length > 1_000_000)
    throw new FunctionError('INVALID_TEXT', 'Wrapped result exceeds 1,000,000 UTF-16 units.');

  state.lines.push(state.current);

  return { breaks: state.lines.length - 1, text: state.lines.join(ending) };
}

function wrapLineEnding(newLine: 'match' | 'lf' | 'crlf', matchedEnding: string): string {
  if (newLine === 'lf') return '\n';
  if (newLine === 'crlf') return '\r\n';

  return matchedEnding;
}

function collapseSpacing(body: string, indent: string): string {
  return (
    indent +
    body
      .slice(indent.length)
      .replace(/[ \t]+/g, ' ')
      .replace(/(?<![ \t])[ \t]+$/, '')
  );
}

function joinParagraph(
  lines: Line[],
  index: number,
  settings: {
    joinWith: 'none' | 'space';
    paragraphs: 'join' | 'keep';
    spacing: 'collapse' | 'preserve';
  },
): { body: string; ending: string; joinedBreaks: number; lastIndex: number } {
  const { joinWith, paragraphs, spacing } = settings;
  const line = lines[index];

  if (line === undefined) throw new FunctionError('INVALID_TEXT', 'Line index out of range.');

  let { ending, text: body } = line;
  let joinedBreaks = 0;
  let lastIndex = index;
  const indent = body.match(/^[ \t]*/)?.[0] ?? '';

  if (spacing === 'collapse') body = collapseSpacing(body, indent);

  while (
    lastIndex + 1 < lines.length &&
    (paragraphs === 'join' || !/^[ \t]*$/.test(lines[lastIndex + 1]!.text))
  ) {
    const next = lines[++lastIndex]!;
    const continuation =
      spacing === 'collapse'
        ? next.text
            .replace(/^[ \t]+/, '')
            .replace(/(?<![ \t])[ \t]+$/, '')
            .replace(/[ \t]+/g, ' ')
        : next.text;

    // An empty row (Join all) adds no text, so it must not add a second separator either.
    body += (joinWith === 'space' && body && continuation ? ' ' : '') + continuation;
    ending = next.ending;
    joinedBreaks += 1;
  }

  if (spacing === 'collapse') body = collapseSpacing(body, indent);

  return { body, ending, joinedBreaks, lastIndex };
}

function measureLayout(
  resultText: string,
  width: number,
  segmenter: Intl.Segmenter | undefined,
): { longestLineGraphemes: number | undefined; outputLines: number; overWidthLines: number } {
  let outputLines = 0;
  let longestLineGraphemes = segmenter ? 0 : undefined;
  let overWidthLines = 0;

  for (const match of resultText.matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g)) {
    if (match.index === resultText.length) break;

    outputLines += 1;

    if (segmenter) {
      const length = graphemes(match[1]!, segmenter).length;

      longestLineGraphemes = Math.max(longestLineGraphemes ?? 0, length);
      if (length > width) overWidthLines += 1;
    }
  }

  return { longestLineGraphemes, outputLines, overWidthLines };
}

type LayoutSettings = {
  joinWith: 'space' | 'none';
  longWords: 'keep' | 'break';
  mode: 'wrap' | 'unwrap';
  newLine: 'match' | 'lf' | 'crlf';
  paragraphs: 'keep' | 'join';
  spacing: 'preserve' | 'collapse';
  width: number;
};

function resolveLayoutSettings(text: string, options: TextLayoutOptions): LayoutSettings {
  if (text.length > 100_000)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 100,000 UTF-16 units.');
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT',
      'Provide valid Unicode without NUL or unpaired surrogates.',
    );

  const mode = options.mode ?? 'wrap';
  const spacing = options.spacing ?? 'preserve';

  if (mode !== 'wrap' && mode !== 'unwrap')
    throw new FunctionError('INVALID_TEXT', 'Choose Wrap or Unwrap.');
  if (spacing !== 'preserve' && spacing !== 'collapse')
    throw new FunctionError('INVALID_TEXT', 'Choose Preserve spacing or Collapse ASCII spacing.');

  const width = mode === 'wrap' ? (options.width ?? 80) : 80;
  const longWords = mode === 'wrap' ? (options.longWords ?? 'keep') : 'keep';
  const newLine = mode === 'wrap' ? (options.newLine ?? 'match') : 'match';
  const paragraphs = mode === 'unwrap' ? (options.paragraphs ?? 'keep') : 'keep';
  const joinWith = mode === 'unwrap' ? (options.joinWith ?? 'space') : 'space';

  if (!Number.isInteger(width) || width < 1 || width > 1_000)
    throw new FunctionError(
      'INVALID_TEXT',
      'Wrap width must be an integer from 1 through 1,000 graphemes.',
    );
  if (longWords !== 'keep' && longWords !== 'break')
    throw new FunctionError('INVALID_TEXT', 'Choose Keep or Break long tokens.');
  if (newLine !== 'match' && newLine !== 'lf' && newLine !== 'crlf')
    throw new FunctionError('INVALID_TEXT', 'Choose Match source, LF or CRLF inserted endings.');
  if (paragraphs !== 'keep' && paragraphs !== 'join')
    throw new FunctionError('INVALID_TEXT', 'Choose Keep paragraphs or Join all lines.');
  if (joinWith !== 'space' && joinWith !== 'none')
    throw new FunctionError('INVALID_TEXT', 'Choose Space or No separator when joining.');
  if (mode === 'wrap' && typeof Intl.Segmenter !== 'function')
    throw new FunctionError(
      'INVALID_TEXT',
      'Grapheme segmentation is unavailable. Use a current browser or application runtime.',
    );

  return { joinWith, longWords, mode, newLine, paragraphs, spacing, width };
}

export function layoutText(text: string, options: TextLayoutOptions = {}): TextLayoutResult {
  const { joinWith, longWords, mode, newLine, paragraphs, spacing, width } = resolveLayoutSettings(
    text,
    options,
  );
  const segmenter =
    mode === 'wrap' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : undefined;
  const lines = splitLines(text);

  if (lines.length > 10_000)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 10,000 physical lines.');

  const fallbackEnding = lines.find((line) => line.ending.length > 0)?.ending ?? '\n';
  const chunks: string[] = [];
  let insertedBreaks = 0;
  let joinedBreaks = 0;
  let size = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    let body = line.text;
    let ending = line.ending;

    if (mode === 'wrap' && segmenter) {
      const insertedEnding = wrapLineEnding(newLine, ending || fallbackEnding);
      const wrapped = wrapBody(body, width, spacing, longWords, insertedEnding, segmenter);

      body = wrapped.text;
      insertedBreaks += wrapped.breaks;
    } else if (!(paragraphs === 'keep' && /^[ \t]*$/.test(body))) {
      const joined = joinParagraph(lines, index, { joinWith, paragraphs, spacing });

      body = joined.body;
      ending = joined.ending;
      index = joined.lastIndex;
      joinedBreaks += joined.joinedBreaks;
    }

    size += body.length + ending.length;
    if (size > 1_000_000)
      throw new FunctionError(
        'INVALID_TEXT',
        'Result exceeds 1,000,000 UTF-16 units. Increase width or reduce input.',
      );

    chunks.push(body + ending);
  }

  const resultText = chunks.join('');
  const { longestLineGraphemes, outputLines, overWidthLines } = measureLayout(
    resultText,
    width,
    segmenter,
  );

  return {
    inputLines: lines.length,
    insertedBreaks,
    joinedBreaks,
    longestLineGraphemes,
    outputLines,
    overWidthLines,
    text: resultText,
  };
}

export function wrapText(text: string, width = 80): string {
  return layoutText(text, { width }).text;
}

export function unwrapText(text: string): string {
  return layoutText(text, { mode: 'unwrap' }).text;
}
