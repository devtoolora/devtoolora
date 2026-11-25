import { decodeHTML } from 'entities';
import {
  checkSize,
  codeSpan,
  destination,
  escapeText,
  joinInline,
  longestRun,
  paragraphText,
  prefixLines,
  wrapEdges,
} from './htmlMarkdownText';
import { attribute, hiddenElements, rawText } from './htmlText';
import { tokenizeHtml } from './htmlTokenizer';
import { asciiWhitespace, blockElements, buildHtmlTree, type HtmlNode } from './htmlTree';

export interface HtmlMarkdownResult {
  markdown: string;
  unsupported: Array<{ count: number; name: string }>;
}

type Block = {
  interruptsParagraph: boolean;
  text: string;
};

type Counts = Map<string, number>;

type Flow = {
  blocks: Block[];
  inline: string;
};

type BlockWriter = (node: HtmlNode, counts: Counts) => Block[];
type InlineWriter = (node: HtmlNode, counts: Counts) => string;

const emphasisMarks: ReadonlyMap<string, string> = new Map([
  ['b', '**'],
  ['del', '~~'],
  ['em', '*'],
  ['i', '*'],
  ['s', '~~'],
  ['strike', '~~'],
  ['strong', '**'],
]);
const rawElements: ReadonlySet<string> = new Set(['pre', 'textarea']);
const rowGroups: ReadonlySet<string> = new Set(['tbody', 'tfoot', 'thead']);
const transparentBlocks: ReadonlySet<string> = new Set([
  'article',
  'aside',
  'body',
  'div',
  'figcaption',
  'figure',
  'footer',
  'header',
  'html',
  'main',
  'nav',
  'p',
  'section',
]);
const structuralElements: ReadonlySet<string> = new Set([
  'col',
  'colgroup',
  'li',
  'span',
  'td',
  'th',
  'tr',
  ...rowGroups,
]);

export function htmlToMarkdown(input: string): HtmlMarkdownResult {
  const { root } = buildHtmlTree(input, 'HTML conversion');
  const counts: Counts = new Map();
  const body = joinBlocks(renderBlocks(root.children, counts), false);
  const markdown = body ? `${body}\n` : '';

  checkSize(markdown.length);

  return {
    markdown,
    unsupported: [...counts]
      .map(([name, count]) => ({ count, name }))
      .sort((left, right) => (left.name < right.name ? -1 : 1)),
  };
}

function count(counts: Counts, name: string) {
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

function isSupported(name: string): boolean {
  return (
    blockWriters.has(name) ||
    inlineWriters.has(name) ||
    structuralElements.has(name) ||
    transparentBlocks.has(name)
  );
}

function joinBlocks(blocks: Block[], tightLists: boolean): string {
  return blocks
    .map(({ interruptsParagraph, text }, index) => {
      if (index === 0) return text;

      return `${tightLists && interruptsParagraph ? '\n' : '\n\n'}${text}`;
    })
    .join('');
}

function renderBlocks(nodes: HtmlNode[], counts: Counts): Block[] {
  const flow: Flow = { blocks: [], inline: '' };

  walkFlow(flow, nodes, counts);
  flushParagraph(flow);

  return flow.blocks;
}

function walkFlow(flow: Flow, nodes: HtmlNode[], counts: Counts) {
  for (const node of nodes) {
    const { kind, name = '' } = node.token;

    if (kind === 'start' && hiddenElements.has(name)) continue;

    const blockWriter = kind === 'start' ? blockWriters.get(name) : undefined;

    if (kind !== 'start' || inlineWriters.has(name) || name === 'textarea')
      flow.inline = joinInline(flow.inline, renderInline(node, counts));
    else if (blockWriter) {
      flushParagraph(flow);
      flow.blocks.push(...blockWriter(node, counts));
    } else {
      if (!isSupported(name)) count(counts, name);

      const isBlock = transparentBlocks.has(name) || blockElements.has(name);

      if (isBlock) flushParagraph(flow);

      walkFlow(flow, node.children, counts);

      if (isBlock) flushParagraph(flow);
    }
  }
}

function flushParagraph(flow: Flow) {
  const text = paragraphText(flow.inline, '\\\n');

  flow.inline = '';
  if (text) flow.blocks.push({ interruptsParagraph: false, text });
}

function renderInline(node: HtmlNode, counts: Counts): string {
  const { kind, name = '', text } = node.token;

  if (kind === 'text') return escapeText(decodeHTML(text).replace(asciiWhitespace, ' '));
  if (kind !== 'start' || hiddenElements.has(name)) return '';

  const inlineWriter = inlineWriters.get(name);

  if (inlineWriter) return inlineWriter(node, counts);
  if (!isSupported(name)) count(counts, name);

  const inner = rawElements.has(name)
    ? escapeText(rawText(node).replace(asciiWhitespace, ' '))
    : inlineChildren(node, counts);

  return blockElements.has(name) || blockWriters.has(name) ? `\n${inner}\n` : inner;
}

function inlineChildren(node: HtmlNode, counts: Counts): string {
  return node.children.reduce((text, child) => joinInline(text, renderInline(child, counts)), '');
}

function plainText(nodes: HtmlNode[]): string {
  return nodes
    .map(({ children, token }) => {
      if (token.kind === 'text' || token.kind === 'raw') return decodeHTML(token.text);
      if (token.kind !== 'start' || hiddenElements.has(token.name ?? '')) return '';

      return plainText(children);
    })
    .join('')
    .replace(asciiWhitespace, ' ');
}

function linkTitle(node: HtmlNode): string {
  const title = attribute(node.token, 'title')?.replace(asciiWhitespace, ' ');

  return title ? ` "${title.replace(/["\\]/g, '\\$&')}"` : '';
}

function writeLink(node: HtmlNode, counts: Counts): string {
  const href = attribute(node.token, 'href');
  const text = inlineChildren(node, counts);

  if (!href) return text;

  return wrapEdges(text, (label) => `[${label}](${destination(href)}${linkTitle(node)})`);
}

function writeImage(node: HtmlNode): string {
  const src = attribute(node.token, 'src');
  const alt = escapeText((attribute(node.token, 'alt') ?? '').replace(asciiWhitespace, ' '));

  return src ? `![${alt}](${destination(src)}${linkTitle(node)})` : alt;
}

function writeEmphasis(node: HtmlNode, counts: Counts): string {
  const mark = emphasisMarks.get(node.token.name ?? '') ?? '';

  return wrapEdges(inlineChildren(node, counts), (text) => (text ? `${mark}${text}${mark}` : ''));
}

const inlineWriters: ReadonlyMap<string, InlineWriter> = new Map<string, InlineWriter>([
  ['a', writeLink],
  ['br', () => '\n'],
  ['code', (node) => wrapEdges(plainText(node.children), codeSpan)],
  ['img', writeImage],
  ...[...emphasisMarks.keys()].map((name): [string, InlineWriter] => [name, writeEmphasis]),
]);

function writeHeading(node: HtmlNode, counts: Counts): Block[] {
  const level = Number(node.token.name?.slice(1));
  // A trailing " #" run would read as the optional closing sequence.
  const text = paragraphText(inlineChildren(node, counts), ' ').replace(/(^| )(#+)$/, '$1\\$2');

  return text ? [{ interruptsParagraph: false, text: `${'#'.repeat(level)} ${text}` }] : [];
}

function writeBlockquote(node: HtmlNode, counts: Counts): Block[] {
  const inner = joinBlocks(renderBlocks(node.children, counts), false);

  return inner ? [{ interruptsParagraph: false, text: prefixLines(inner, '> ', '> ') }] : [];
}

function listStart(node: HtmlNode): number {
  const start = Number.parseInt(attribute(node.token, 'start') ?? '', 10);

  // CommonMark list numbers have at most 9 digits and are never negative.
  return Number.isSafeInteger(start) && start >= 0 && start <= 999_999_999 ? start : 1;
}

function writeList(node: HtmlNode, counts: Counts): Block[] {
  const ordered = node.token.name === 'ol';
  const items: string[] = [];
  const start = ordered ? listStart(node) : 0;
  let next = start;

  for (const child of node.children) {
    if (child.token.kind === 'start' && child.token.name === 'li') {
      const marker = ordered ? `${next++}. ` : '- ';
      const content = joinBlocks(renderBlocks(child.children, counts), true);

      items.push(prefixLines(content, marker, ' '.repeat(marker.length)));
    } else items.push(...renderBlocks([child], counts).map(({ text }) => text));
  }

  const [first] = items;

  if (first === undefined) return [];

  // CommonMark lets a list interrupt a paragraph only from 1 and with text in its first item.
  const interruptsParagraph = (!ordered || start === 1) && !/^(?:-|\d+\.)(?:\n|$)/.test(first);

  return [{ interruptsParagraph, text: items.join('\n') }];
}

function preLanguage(node: HtmlNode): string {
  const raw = node.children.map((child) => child.token.text).join('');
  const code = tokenizeHtml(raw).find((token) => token.kind === 'start' && token.name === 'code');

  for (const classes of [attribute(node.token, 'class'), code && attribute(code, 'class')]) {
    const language = /(?:^|\s)language-([^\s`]+)/.exec(classes ?? '')?.[1];

    if (language) return language;
  }

  return '';
}

function writePre(node: HtmlNode): Block[] {
  const code = rawText(node).replace(/\n$/, '');
  const fence = '`'.repeat(Math.max(3, longestRun(code, '`') + 1));

  return [
    {
      interruptsParagraph: false,
      text: `${fence}${preLanguage(node)}\n${code ? `${code}\n` : ''}${fence}`,
    },
  ];
}

function cellText(cell: HtmlNode, counts: Counts): string {
  for (const span of ['colspan', 'rowspan']) {
    const value = attribute(cell.token, span);

    if (value !== undefined && value.trim() !== '1') count(counts, span);
  }

  return paragraphText(inlineChildren(cell, counts), '<br>').replaceAll('|', '\\|');
}

function collectRows(node: HtmlNode, rows: string[][], extra: Block[], counts: Counts) {
  for (const child of node.children) {
    const { kind, name = '' } = child.token;

    if (kind === 'start' && name === 'tr') {
      const cells = child.children.filter(
        ({ token }) => token.kind === 'start' && (token.name === 'td' || token.name === 'th'),
      );

      if (cells.length > 0) rows.push(cells.map((cell) => cellText(cell, counts)));
    } else if (kind === 'start' && rowGroups.has(name)) collectRows(child, rows, extra, counts);
    else extra.push(...renderBlocks([child], counts));
  }
}

function writeTable(node: HtmlNode, counts: Counts): Block[] {
  const rows: string[][] = [];
  const extra: Block[] = [];

  collectRows(node, rows, extra, counts);

  const columns = rows.reduce((most, row) => Math.max(most, row.length), 0);
  const [header, ...body] = rows;

  if (!header) return extra;

  checkSize(rows.length * (columns * 3 + 2));

  const line = (cells: string[]) =>
    `| ${Array.from({ length: columns }, (_, index) => cells[index] ?? '').join(' | ')} |`;
  const lines = [line(header), line(Array<string>(columns).fill('---')), ...body.map(line)];

  return [...extra, { interruptsParagraph: false, text: lines.join('\n') }];
}

const blockWriters: ReadonlyMap<string, BlockWriter> = new Map<string, BlockWriter>([
  ['blockquote', writeBlockquote],
  ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((name): [string, BlockWriter] => [
    name,
    writeHeading,
  ]),
  ['hr', () => [{ interruptsParagraph: false, text: '---' }]],
  ['ol', writeList],
  ['pre', writePre],
  ['table', writeTable],
  ['ul', writeList],
]);
