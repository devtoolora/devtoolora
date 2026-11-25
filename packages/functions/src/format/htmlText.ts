import { decodeHTML, decodeHTMLAttribute } from 'entities';
import { FunctionError } from '../errors';
import { type HtmlToken, tokenizeHtml } from './htmlTokenizer';
import { asciiWhitespace, blockElements, buildHtmlTree, type HtmlNode } from './htmlTree';

export interface HtmlTextOptions {
  links: 'inline' | 'text';
}

export interface HtmlTextResult {
  autoClosed: number;
  links: number;
  text: string;
}

type ListLevel = {
  next: number;
  ordered: boolean;
  step: 1 | -1;
};

type Writer = {
  breaks: number;
  cellDepth: number;
  hasPendingSpace: boolean;
  inlineLinks: boolean;
  links: number;
  lists: ListLevel[];
  marker: string;
  parts: string[];
  tail: string;
};

type ElementWriter = (writer: Writer, node: HtmlNode) => void;

const attributePattern = /[\s/]([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

// Metadata elements stay hidden without an explicit head, where a parser would move them to.
export const hiddenElements: ReadonlySet<string> = new Set([
  'base',
  'head',
  'link',
  'meta',
  'script',
  'style',
  'svg',
  'template',
  'title',
]);
const paragraphElements: ReadonlySet<string> = new Set([
  'blockquote',
  'dl',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'ol',
  'p',
  'pre',
  'table',
  'ul',
]);

export function htmlToText(input: string, options: HtmlTextOptions): HtmlTextResult {
  if (options.links !== 'inline' && options.links !== 'text')
    throw new FunctionError('INVALID_HTML_OPTIONS', 'Choose Text only or Text and URL.');

  const { autoClosed, root } = buildHtmlTree(input, 'HTML conversion');
  const writer: Writer = {
    breaks: 0,
    cellDepth: 0,
    hasPendingSpace: false,
    inlineLinks: options.links === 'inline',
    links: 0,
    lists: [],
    marker: '',
    parts: [],
    tail: '',
  };

  writeNodes(writer, root.children);

  return { autoClosed, links: writer.links, text: finishText(writer.parts) };
}

function finishText(parts: string[]): string {
  const lines = parts.join('').split('\n').map(trimTrailingSpaces);

  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

// A loop instead of / +$/, which backtracks quadratically on long space runs.
function trimTrailingSpaces(line: string): string {
  let end = line.length;

  while (end > 0 && line[end - 1] === ' ') end--;

  return line.slice(0, end);
}

function writeNodes(writer: Writer, nodes: HtmlNode[]) {
  for (const node of nodes) writeNode(writer, node);
}

function writeNode(writer: Writer, node: HtmlNode) {
  const { kind, name = '', text } = node.token;

  if (kind === 'text') return writeText(writer, decodeHTML(text));
  if (kind !== 'start' || hiddenElements.has(name)) return;

  const elementWriter = elementWriters.get(name);

  if (elementWriter) elementWriter(writer, node);
  else if (blockElements.has(name)) writeBlock(writer, node, paragraphElements.has(name) ? 2 : 1);
  else writeNodes(writer, node.children);
}

function writeBlock(writer: Writer, node: HtmlNode, lineBreaks: number) {
  requestBreaks(writer, lineBreaks);
  writeNodes(writer, node.children);
  requestBreaks(writer, lineBreaks);
}

function requestBreaks(writer: Writer, lineBreaks: number) {
  if (writer.cellDepth > 0) writer.hasPendingSpace = true;
  else if (writer.parts.length > 0) writer.breaks = Math.max(writer.breaks, lineBreaks);
}

function writeCell(writer: Writer, node: HtmlNode) {
  writer.cellDepth++;
  writeNodes(writer, node.children);
  writer.cellDepth--;
}

function writeText(writer: Writer, text: string) {
  const collapsed = text.replace(asciiWhitespace, ' ');
  const words = collapsed.replace(/^ | $/g, '');

  if (collapsed.startsWith(' ')) writer.hasPendingSpace = true;
  if (!words) return;

  emit(writer, words);
  writer.hasPendingSpace = collapsed.endsWith(' ');
}

function emit(writer: Writer, text: string) {
  const { tail } = writer;
  let prefix = '';

  if (writer.breaks > 0) {
    const written = tail === '\n\n' ? 2 : Number(tail.endsWith('\n'));

    prefix = '\n'.repeat(Math.max(0, writer.breaks - written));
  } else if (writer.hasPendingSpace && !writer.marker && tail && !/[\t\n]$/.test(tail))
    prefix = ' ';

  const chunk = `${prefix}${writer.marker}${text}`;

  writer.parts.push(chunk);
  writer.tail = chunk.length >= 2 ? chunk.slice(-2) : `${tail}${chunk}`.slice(-2);
  writer.breaks = 0;
  writer.hasPendingSpace = false;
  writer.marker = '';
}

export function attribute(token: HtmlToken, name: string): string | undefined {
  for (const match of token.text.matchAll(attributePattern))
    if (match[1]?.toLowerCase() === name)
      return decodeHTMLAttribute(match[2] ?? match[3] ?? match[4] ?? '');

  return undefined;
}

function writeLink(writer: Writer, node: HtmlNode) {
  const href = attribute(node.token, 'href');
  const start = writer.parts.length;

  if (href !== undefined) writer.links++;

  writeNodes(writer, node.children);

  if (!writer.inlineLinks || !href || href.startsWith('#')) return;
  if (writer.parts.slice(start).join('').trim() === href) return;

  writer.hasPendingSpace = true;
  emit(writer, `(${href})`);
}

function writeList(writer: Writer, node: HtmlNode) {
  const lineBreaks = writer.lists.length > 0 ? 1 : 2;
  const ordered = node.token.name === 'ol';
  const start = Number.parseInt(attribute(node.token, 'start') ?? '', 10);
  const reversed = ordered && attribute(node.token, 'reversed') !== undefined;
  const items = node.children.filter(
    (child) => child.token.kind === 'start' && child.token.name === 'li',
  ).length;
  const first = reversed ? items : 1;

  requestBreaks(writer, lineBreaks);

  writer.lists.push({
    next: ordered && Number.isSafeInteger(start) ? start : first,
    ordered,
    step: reversed ? -1 : 1,
  });

  writeNodes(writer, node.children);
  writer.lists.pop();
  requestBreaks(writer, lineBreaks);
}

function writeListItem(writer: Writer, node: HtmlNode) {
  const level = writer.lists[writer.lists.length - 1];
  const indent = '  '.repeat(Math.max(0, writer.lists.length - 1));
  const value = Number.parseInt(attribute(node.token, 'value') ?? '', 10);

  flushMarker(writer);
  requestBreaks(writer, 1);

  if (level?.ordered) {
    const number = Number.isSafeInteger(value) ? value : level.next;

    writer.marker = `${indent}${number}. `;
    level.next = number + level.step;
  } else writer.marker = `${indent}- `;

  writeNodes(writer, node.children);
  flushMarker(writer);
  requestBreaks(writer, 1);
}

function flushMarker(writer: Writer) {
  if (writer.marker) emit(writer, '');
}

function writeRow(writer: Writer, node: HtmlNode) {
  let cells = 0;

  requestBreaks(writer, 1);

  for (const child of node.children) {
    const name = child.token.kind === 'start' ? child.token.name : undefined;

    if ((name === 'td' || name === 'th') && cells++ > 0) {
      writer.hasPendingSpace = false;
      emit(writer, '\t');
    }

    writeNode(writer, child);
  }

  requestBreaks(writer, 1);
}

function writePre(writer: Writer, node: HtmlNode) {
  requestBreaks(writer, 2);
  writeRaw(writer, node);
  requestBreaks(writer, 2);
}

function writeRaw(writer: Writer, node: HtmlNode) {
  const text = rawText(node);

  if (text) emit(writer, text);
}

export function rawText(node: HtmlNode): string {
  const raw = node.children.map((child) => child.token.text).join('');

  return tokenizeHtml(raw)
    .filter((token) => token.kind === 'text')
    .map((token) => decodeHTML(token.text))
    .join('')
    .replace(/\r\n?/g, '\n')
    .replace(/^\n/, '');
}

const elementWriters: ReadonlyMap<string, ElementWriter> = new Map<string, ElementWriter>([
  ['a', writeLink],
  [
    'br',
    (writer) => {
      if (writer.cellDepth > 0) writer.hasPendingSpace = true;
      else if (writer.parts.length > 0) writer.breaks++;
    },
  ],
  [
    'hr',
    (writer) => {
      requestBreaks(writer, 2);
      emit(writer, '---');
      requestBreaks(writer, 2);
    },
  ],
  ['img', (writer, node) => writeText(writer, attribute(node.token, 'alt') ?? '')],
  ['li', writeListItem],
  ['ol', writeList],
  ['pre', writePre],
  ['td', writeCell],
  ['textarea', writeRaw],
  ['th', writeCell],
  ['tr', writeRow],
  ['ul', writeList],
]);
