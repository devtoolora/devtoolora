import MarkdownIt, { type MarkdownItOptions, type ParserInline, type Token } from 'markdown-it';
import { FunctionError } from '../errors';
import { textStatistics } from './statistics';

export type MarkdownOptions = {
  collapseWhitespace?: boolean;
  stripHtml?: boolean;
};

export type MarkdownResult = {
  codeBlocks: number;
  headings: number;
  images: number;
  links: number;
  removedHtml: number;
  text: string;
  words: number;
};

type SourceRange = { end: number; start: number };

// CommonMark raw HTML syntax; quoted attributes may themselves contain >.
const attributeName = '[A-Za-z_:][A-Za-z0-9:._-]*';
const attributeValue = '(?:[^"\'=<>`\\x00-\\x20]+|\'[^\']*\'|"[^"]*")';
const attribute = `(?:\\s+${attributeName}(?:\\s*=\\s*${attributeValue})?)`;
const htmlTag = new RegExp(
  `^(?:<[A-Za-z][A-Za-z0-9-]*${attribute}*\\s*/?>|</[A-Za-z][A-Za-z0-9-]*\\s*>|<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->|<\\?[\\s\\S]*?\\?>|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`,
);

function lineOffsets(source: string): number[] {
  const offsets = [0];

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') offsets.push(index + 1);
  }

  offsets.push(source.length);

  return offsets;
}

function inlineOffsets(source: string, token: Token, offsets: number[]): number[] {
  if (!token.map)
    throw new FunctionError('INVALID_MARKDOWN', 'Could not locate Markdown inline source.');

  const mapping: number[] = [];
  const parts = token.content.split('\n');

  for (let index = 0; index < parts.length; index += 1) {
    const start = offsets[token.map[0] + index];
    const end = offsets[token.map[0] + index + 1];

    if (start === undefined || end === undefined)
      throw new FunctionError('INVALID_MARKDOWN', 'Could not locate Markdown source line.');

    const line = source.slice(start, end);
    const part = parts[index]!;
    const exactOffset = line.indexOf(part);
    // A tab partially consumed by a list's indentation becomes virtual spaces
    // in the parser's inline source. Match the remaining literal line instead.
    const literal = exactOffset >= 0 ? part : part.replace(/^[ \t]+/, '');
    const padding = part.length - literal.length;
    const offset = exactOffset >= 0 ? exactOffset : line.indexOf(literal);

    if (offset < 0)
      throw new FunctionError(
        'INVALID_MARKDOWN',
        'Could not map Markdown source without changing it.',
      );

    for (let character = 0; character < padding; character += 1) mapping.push(start + offset);
    for (let character = 0; character < literal.length; character += 1)
      mapping.push(start + offset + character);
    if (index < parts.length - 1) mapping.push(end - 1);
  }

  return mapping;
}

function removeRanges(source: string, ranges: SourceRange[]): string {
  const sorted = ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  let cursor = 0;
  const pieces: string[] = [];

  for (const range of sorted) {
    if (range.start > cursor) pieces.push(source.slice(cursor, range.start));

    cursor = Math.max(cursor, range.end);
  }

  pieces.push(source.slice(cursor));

  return pieces.join('');
}

function sourceRange(offsets: number[], map: [number, number]): SourceRange {
  const start = offsets[map[0]];
  const end = offsets[map[1]];

  if (start === undefined || end === undefined)
    throw new FunctionError('INVALID_MARKDOWN', 'Could not locate Markdown source line.');

  return { end, start };
}

const literalBlocks = ['fence', 'code_block', 'html_block'];
const containerBlocks = ['blockquote_open', 'bullet_list_open', 'ordered_list_open'];

function protectedRanges(source: string, tokens: Token[], offsets: number[]): SourceRange[] {
  const ranges: SourceRange[] = [];

  for (const token of tokens) {
    if (!token.map) continue;

    if (literalBlocks.includes(token.type)) ranges.push(sourceRange(offsets, token.map));

    if (containerBlocks.includes(token.type)) {
      const { end, start } = sourceRange(offsets, token.map);

      // A container's map runs over the blank lines after it; keep only its last line break.
      ranges.push({ end: start + source.slice(start, end).trimEnd().length + 1, start });
    }
  }

  return ranges;
}

function collapseBlankLines(source: string): string {
  const parser = new MarkdownIt('commonmark', { html: true });
  const offsets = lineOffsets(source);
  const protectedSource = protectedRanges(source, parser.parse(source, {}), offsets);

  return source.replace(/\n(?:[ \t]*\n){2,}/g, (match: string, index: number) => {
    if (
      protectedSource.some((range) => index + 1 < range.end && index + match.length > range.start)
    )
      return match;

    return '\n\n';
  });
}

function statistics(tokens: Token[]): Omit<MarkdownResult, 'removedHtml' | 'text'> {
  let codeBlocks = 0;
  let headings = 0;
  let images = 0;
  let links = 0;
  const prose: string[] = [];

  for (const token of tokens) {
    if (token.type === 'heading_open') headings += 1;
    if (token.type === 'fence' || token.type === 'code_block') codeBlocks += 1;

    for (const child of token.children ?? []) {
      if (child.type === 'link_open') links += 1;
      if (child.type === 'image') images += 1;
      if (child.type === 'text') prose.push(child.content);
      if (child.type === 'softbreak' || child.type === 'hardbreak') prose.push('\n');
    }

    if (token.type === 'inline') prose.push('\n');
  }

  return {
    codeBlocks,
    headings,
    images,
    links,
    words: textStatistics(prose.join('').trimEnd()).words,
  };
}

export function assertMarkdownInput(text: string, toolName: string): void {
  if (text.length > 100_000)
    throw new FunctionError(
      'INVALID_MARKDOWN',
      `${toolName} supports at most 100,000 UTF-16 input units.`,
    );
  if (/[\uD800-\uDFFF]/u.test(text) || text.includes('\0'))
    throw new FunctionError(
      'INVALID_MARKDOWN',
      'Provide valid Unicode Markdown without NUL characters.',
    );
}

export function assertTokenBudget(tokens: Token[], toolName: string): void {
  if (
    tokens.length + tokens.reduce((count, token) => count + (token.children?.length ?? 0), 0) >
    10_000
  )
    throw new FunctionError(
      'INVALID_MARKDOWN',
      `${toolName} supports at most 10,000 parsed tokens.`,
    );
}

// Track only HTML recognized by the inline parser: code spans, autolinks,
// escapes and link destinations are handled by their existing rules first.
function createHtmlInlineRule(
  stripHtml: boolean,
  ranges: SourceRange[],
  currentMapping: () => number[],
  altOffset: () => number,
): Parameters<ParserInline['ruler']['before']>[2] {
  return (state, silent) => {
    if (state.src[state.pos] !== '<') return false;

    const match = state.src.slice(state.pos).match(htmlTag);

    if (!match) return false;

    if (!silent) {
      const token = state.push('html_inline', '', 0);

      token.content = match[0];

      if ('linkLevel' in state && typeof state.linkLevel === 'number') {
        if (/^<a[>\s]/i.test(token.content)) state.linkLevel += 1;
        if (/^<\/a\s*>/i.test(token.content)) state.linkLevel -= 1;
      }

      if (stripHtml) {
        const mapping = currentMapping();
        const position = altOffset() + state.pos;
        const start = mapping[position];
        const end = mapping[position + match[0].length - 1];

        if (start === undefined || end === undefined)
          throw new FunctionError(
            'INVALID_MARKDOWN',
            'Could not locate HTML without changing unrelated Markdown.',
          );

        ranges.push({ end: end + 1, start });
      }
    }

    state.pos += match[0].length;

    return true;
  };
}

// markdown-it parses image alt text as a new inline source, so rule positions restart at the alt.
// Returns where the source being parsed starts inside the inline token's content.
function trackAltOffset(inline: ParserInline): () => number {
  const parseInline = inline.parse.bind(inline);
  let nextOffset = 0;
  let offset = 0;

  inline.ruler.before('image', 'alt_offset', (state, silent) => {
    if (!silent) nextOffset = offset + state.pos + 2;

    return false;
  });

  inline.parse = (...args) => {
    const outer = offset;

    offset = nextOffset;
    parseInline(...args);
    offset = outer;
    nextOffset = 0;
  };

  return () => offset;
}

function parseWithHtmlRanges(
  source: string,
  stripHtml: boolean,
  parserOptions: MarkdownItOptions,
): { ranges: SourceRange[]; tokens: Token[] } {
  const offsets = lineOffsets(source);
  const ranges: SourceRange[] = [];
  const parser = new MarkdownIt('commonmark', parserOptions);
  const altOffset = trackAltOffset(parser.inline);
  let currentMapping: number[] = [];

  parser.inline.ruler.at(
    'html_inline',
    createHtmlInlineRule(stripHtml, ranges, () => currentMapping, altOffset),
  );

  parser.core.ruler.at('inline', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'inline') continue;

      currentMapping =
        !stripHtml || !token.content.includes('<') ? [] : inlineOffsets(source, token, offsets);

      token.children = [];
      state.md.inline.parse(token.content, state.md, state.env, token.children);
    }
  });

  const tokens = parser.parse(source, {});

  assertTokenBudget(tokens, 'Markdown Helper');

  if (stripHtml) {
    for (const token of tokens) {
      if (token.type === 'html_block' && token.map) ranges.push(sourceRange(offsets, token.map));
    }
  }

  return { ranges, tokens };
}

export function processMarkdown(text: string, options: MarkdownOptions = {}): MarkdownResult {
  assertMarkdownInput(text, 'Markdown Helper');

  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const parserOptions = { html: true, maxNesting: 64 };
  const { ranges } = parseWithHtmlRanges(source, options.stripHtml !== false, parserOptions);
  const removedHtml = ranges.length;
  const stripped = removeRanges(source, ranges);
  const output = options.collapseWhitespace === false ? stripped : collapseBlankLines(stripped);
  const resultTokens = new MarkdownIt('commonmark', parserOptions).parse(output, {});

  return { ...statistics(resultTokens), removedHtml, text: output };
}
