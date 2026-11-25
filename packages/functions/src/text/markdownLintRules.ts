import type { Token } from 'markdown-it';
import { githubSlug, inlineText, uniqueSlug } from './markdownToc';

export type MarkdownLintRule =
  | 'MD001/heading-increment'
  | 'MD004/ul-style'
  | 'MD009/no-trailing-spaces'
  | 'MD010/no-hard-tabs'
  | 'MD012/no-multiple-blanks'
  | 'MD022/blanks-around-headings'
  | 'MD025/single-h1'
  | 'MD040/fenced-code-language'
  | 'MD047/single-trailing-newline'
  | 'MD051/link-fragments';

type RuleFinding = { column: number; detail: string; line: number };

type RuleContext = {
  lines: string[];
  skipped: boolean[];
  text: string;
  tokens: Token[];
};

type Check = (context: RuleContext) => RuleFinding[];

export const markdownLintRules: readonly MarkdownLintRule[] = [
  'MD001/heading-increment',
  'MD004/ul-style',
  'MD009/no-trailing-spaces',
  'MD010/no-hard-tabs',
  'MD012/no-multiple-blanks',
  'MD022/blanks-around-headings',
  'MD025/single-h1',
  'MD040/fenced-code-language',
  'MD047/single-trailing-newline',
  'MD051/link-fragments',
];

export const markdownLintDescriptions: Record<MarkdownLintRule, string> = {
  'MD001/heading-increment': 'Heading levels should only increment by one level at a time',
  'MD004/ul-style': 'Unordered list style',
  'MD009/no-trailing-spaces': 'Trailing spaces',
  'MD010/no-hard-tabs': 'Hard tabs',
  'MD012/no-multiple-blanks': 'Multiple consecutive blank lines',
  'MD022/blanks-around-headings': 'Headings should be surrounded by blank lines',
  'MD025/single-h1': 'Multiple top-level headings in the same document',
  'MD040/fenced-code-language': 'Fenced code blocks should have a language specified',
  'MD047/single-trailing-newline': 'Files should end with a single newline character',
  'MD051/link-fragments': 'Link fragments should be valid',
};

const isBlank = (line: string | undefined): boolean => (line ?? '').trim() === '';
const indentOf = (line: string | undefined): number =>
  (line ?? '').length - (line ?? '').trimStart().length;
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
const levelOf = (token: Token): number => Number(token.tag.slice(1));

function headings(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.type === 'heading_open' && token.map !== null);
}

function checkIncrement({ tokens }: RuleContext): RuleFinding[] {
  const findings: RuleFinding[] = [];
  let previous = 0;

  for (const heading of headings(tokens)) {
    const level = levelOf(heading);

    if (previous > 0 && level > previous + 1)
      findings.push({
        column: 1,
        detail: `[Expected: h${previous + 1}; Actual: h${level}]`,
        line: (heading.map?.[0] ?? 0) + 1,
      });

    previous = level;
  }

  return findings;
}

const markerNames: Record<string, string> = { '*': 'asterisk', '+': 'plus', '-': 'dash' };

function checkListStyle({ lines, tokens }: RuleContext): RuleFinding[] {
  const findings: RuleFinding[] = [];
  let expected = '';

  for (const token of tokens) {
    const name = token.type === 'list_item_open' ? markerNames[token.markup] : undefined;
    const row = token.map?.[0] ?? 0;

    if (name === undefined) continue;
    if (expected === '') expected = name;
    else if (name !== expected)
      findings.push({
        column: indentOf(lines[row]) + 1,
        detail: `[Expected: ${expected}; Actual: ${name}]`,
        line: row + 1,
      });
  }

  return findings;
}

function checkTrailingSpaces({ lines, skipped }: RuleContext): RuleFinding[] {
  const findings: RuleFinding[] = [];

  lines.forEach((line, row) => {
    let count = 0;

    while (count < line.length && line[line.length - 1 - count] === ' ') count += 1;
    if (skipped[row] === true || count === 0 || count === 2) return;

    findings.push({
      column: line.length - count + 1,
      detail: `[${plural(count, 'space')}]`,
      line: row + 1,
    });
  });

  return findings;
}

function codeSpans(line: string): Array<[number, number]> {
  const runs: Array<{ end: number; start: number }> = [];

  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== '`') continue;

    const start = index;

    while (line[index + 1] === '`') index += 1;
    runs.push({ end: index + 1, start });
  }

  const nextSame: number[] = [];
  const seen = new Map<number, number>();

  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const run = runs[index];

    if (run === undefined) continue;

    const length = run.end - run.start;

    nextSame[index] = seen.get(length) ?? -1;
    seen.set(length, index);
  }

  const spans: Array<[number, number]> = [];

  for (let index = 0; index < runs.length; index += 1) {
    const close = nextSame[index] ?? -1;

    if (close < 0) continue;

    const open = runs[index];
    const closing = runs[close];

    if (open === undefined || closing === undefined) continue;

    spans.push([open.start, closing.end]);
    index = close;
  }

  return spans;
}

function checkHardTabs({ lines, skipped }: RuleContext): RuleFinding[] {
  const findings: RuleFinding[] = [];

  lines.forEach((line, row) => {
    if (skipped[row] === true || !line.includes('\t')) return;

    const spans = codeSpans(line);
    const tabs: number[] = [];
    let spanIndex = 0;

    for (let index = 0; index < line.length; index += 1) {
      while (spanIndex < spans.length && (spans[spanIndex]?.[1] ?? 0) <= index) spanIndex += 1;

      const span = spans[spanIndex];

      if (line[index] === '\t' && !(span !== undefined && index >= span[0])) tabs.push(index);
    }

    if (tabs.length > 0)
      findings.push({
        column: (tabs[0] ?? 0) + 1,
        detail: `[${plural(tabs.length, 'tab')}]`,
        line: row + 1,
      });
  });

  return findings;
}

function checkBlankRuns({ lines, skipped }: RuleContext): RuleFinding[] {
  const findings: RuleFinding[] = [];
  let start = -1;

  for (let row = 0; row <= lines.length; row += 1) {
    if (row < lines.length && skipped[row] !== true && isBlank(lines[row])) {
      if (start < 0) start = row;

      continue;
    }
    if (start >= 0 && row - start >= 2)
      findings.push({ column: 1, detail: `[${row - start} blank lines]`, line: start + 2 });

    start = -1;
  }

  return findings;
}

function isQuoteBlank(line: string | undefined): boolean {
  let rest = line ?? '';

  while (/^ {0,3}> ?/.test(rest)) rest = rest.replace(/^ {0,3}> ?/, '');

  return isBlank(rest);
}

function checkHeadingBlanks({ lines, tokens }: RuleContext): RuleFinding[] {
  const findings: RuleFinding[] = [];

  for (const heading of headings(tokens)) {
    const [first, end] = heading.map ?? [0, 0];
    const above = first > 0 && !isQuoteBlank(lines[first - 1]);
    const below = end < lines.length && !isQuoteBlank(lines[end]);

    if (!above && !below) continue;

    const sides = [above ? 'Above' : '', below ? 'Below' : ''].filter(Boolean);
    const detail = sides.join(' and ').replace('and Below', 'and below');

    findings.push({ column: 1, detail: `[${detail}]`, line: first + 1 });
  }

  return findings;
}

function checkSingleH1({ tokens }: RuleContext): RuleFinding[] {
  const findings: RuleFinding[] = [];
  let firstLine = 0;

  for (const heading of headings(tokens).filter((token) => token.tag === 'h1')) {
    const line = (heading.map?.[0] ?? 0) + 1;

    if (firstLine === 0) firstLine = line;
    else findings.push({ column: 1, detail: `[First h1 on line ${firstLine}]`, line });
  }

  return findings;
}

function checkFenceLanguage({ lines, tokens }: RuleContext): RuleFinding[] {
  return tokens
    .filter((token) => token.type === 'fence' && token.info.trim() === '' && token.map !== null)
    .map((token) => ({
      column: indentOf(lines[token.map?.[0] ?? 0]) + 1,
      detail: '[No language]',
      line: (token.map?.[0] ?? 0) + 1,
    }));
}

function checkFinalNewline({ lines, text }: RuleContext): RuleFinding[] {
  if (text === '') return [];

  const parts = text.split('\n');
  const last = (parts[parts.length - 1] ?? '').replace(/\r$/, '');
  const before = (parts[parts.length - 2] ?? 'x').replace(/\r$/, '');
  let detail = '';

  if (last !== '') detail = '[No final newline]';
  else if (before === '' && parts.length > 2) detail = '[Extra blank lines at the end]';
  if (detail === '') return [];

  let row = lines.length - 1;

  while (row > 0 && isBlank(lines[row])) row -= 1;

  return [{ column: (lines[row] ?? '').length + 1, detail, line: row + 1 }];
}

function htmlAnchors(tokens: Token[], anchors: Set<string>): void {
  const scan = (html: string): void => {
    for (const match of html.matchAll(/\b(?:id|name)="([^"]*)"/g))
      anchors.add((match[1] ?? '').toLowerCase());
  };

  for (const token of tokens) {
    if (token.type === 'html_block') scan(token.content);

    for (const child of token.children ?? []) if (child.type === 'html_inline') scan(child.content);
  }
}

// markdownlint always allows #top and GitHub line links such as #L20 and #L19C5-L21C11.
const reservedFragment = /^(?:top|L\d+(?:C\d+)?(?:-L\d+(?:C\d+)?)?)$/;
const customAnchor = /\{#([a-z\d]+(?:[-_][a-z\d]+)*)\}/g;

function headingAnchors(tokens: Token[]): Set<string> {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();

  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;

    const text = inlineText(tokens[index + 1]);

    anchors.add(uniqueSlug(githubSlug(text), counts));

    for (const match of text.matchAll(customAnchor)) anchors.add(match[1] ?? '');
  });

  htmlAnchors(tokens, anchors);

  return anchors;
}

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function checkLinkFragments({ tokens }: RuleContext): RuleFinding[] {
  const anchors = headingAnchors(tokens);
  const findings: RuleFinding[] = [];

  for (const token of tokens) {
    if (token.type !== 'inline') continue;

    let line = (token.map?.[0] ?? 0) + 1;

    for (const child of token.children ?? []) {
      if (child.type === 'softbreak' || child.type === 'hardbreak') line += 1;

      const href = child.type === 'link_open' ? String(child.attrGet('href') ?? '') : '';

      if (
        href.length > 1 &&
        href.startsWith('#') &&
        !reservedFragment.test(href.slice(1)) &&
        !anchors.has(decodeFragment(href.slice(1)).toLowerCase())
      )
        findings.push({ column: 1, detail: `[${href}]`, line });
    }
  }

  return findings;
}

export const markdownLintChecks: Record<MarkdownLintRule, Check> = {
  'MD001/heading-increment': checkIncrement,
  'MD004/ul-style': checkListStyle,
  'MD009/no-trailing-spaces': checkTrailingSpaces,
  'MD010/no-hard-tabs': checkHardTabs,
  'MD012/no-multiple-blanks': checkBlankRuns,
  'MD022/blanks-around-headings': checkHeadingBlanks,
  'MD025/single-h1': checkSingleH1,
  'MD040/fenced-code-language': checkFenceLanguage,
  'MD047/single-trailing-newline': checkFinalNewline,
  'MD051/link-fragments': checkLinkFragments,
};
