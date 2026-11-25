import { FunctionError } from '../errors';
import { asciiWhitespace, blockElements, buildHtmlTree, type HtmlNode } from './htmlTree';

export { tokenizeHtml } from './htmlTokenizer';
export type { HtmlToken } from './htmlTokenizer';

export interface HtmlFormatOptions {
  indent: 2 | 4 | 'tab';
  mode: 'format' | 'minify';
}

export interface HtmlFormatResult {
  autoClosed: number;
  text: string;
}

const inlineElements: ReadonlySet<string> = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'br',
  'button',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'textarea',
  'time',
  'u',
  'var',
  'wbr',
]);

export function formatHtml(input: string, options: HtmlFormatOptions): HtmlFormatResult {
  if (options.indent !== 2 && options.indent !== 4 && options.indent !== 'tab')
    throw new FunctionError('INVALID_HTML_OPTIONS', 'Choose 2 spaces, 4 spaces or tabs.');
  if (options.mode !== 'format' && options.mode !== 'minify')
    throw new FunctionError('INVALID_HTML_OPTIONS', 'Choose Format or Minify.');

  const { autoClosed, root } = buildHtmlTree(input, 'HTML formatting');

  if (options.mode === 'minify') return { autoClosed, text: minifyChildren(root.children) };

  const pad = options.indent === 'tab' ? '\t' : ' '.repeat(options.indent);

  return { autoClosed, text: `${formatChildren(root.children, pad, 0).join('\n')}\n` };
}

function isConditionalComment(node: HtmlNode): boolean {
  return node.token.text.startsWith('<!--[if');
}

function isAsciiSpace(character: string | undefined): boolean {
  return (
    character === ' ' ||
    character === '\t' ||
    character === '\n' ||
    character === '\f' ||
    character === '\r'
  );
}

// HTML collapses only ASCII whitespace: JavaScript's trim and \s would also eat a no-break space.
function trimAsciiWhitespace(text: string): string {
  let start = 0;
  let end = text.length;

  while (start < end && isAsciiSpace(text[start])) start++;
  while (end > start && isAsciiSpace(text[end - 1])) end--;

  return text.slice(start, end);
}

function isBlank(node: HtmlNode): boolean {
  return node.token.kind === 'text' && !trimAsciiWhitespace(node.token.text);
}

function isInline(node: HtmlNode): boolean {
  const { kind, name = '' } = node.token;

  if (kind === 'text' || kind === 'raw') return true;
  if (kind !== 'start' || blockElements.has(name)) return false;

  return inlineElements.has(name) || node.children.every(isInlineChild);
}

// A line break next to a comment that touches text or an inline element would add a rendered space.
function isInlineChild(node: HtmlNode, index: number, siblings: HtmlNode[]): boolean {
  if (node.token.kind !== 'comment') return isInline(node);

  const before = siblings[index - 1];
  const after = siblings[index + 1];

  return Boolean(
    (before && touchesComment(before, before.token.text.at(-1))) ||
    (after && touchesComment(after, after.token.text[0])),
  );
}

function touchesComment(sibling: HtmlNode, nearestCharacter: string | undefined): boolean {
  if (sibling.token.kind === 'text') return !isAsciiSpace(nearestCharacter);

  return sibling.token.kind === 'comment' || isInline(sibling);
}

function inlineText(nodes: HtmlNode[]): string {
  return nodes
    .map((node) =>
      node.token.kind === 'text'
        ? node.token.text.replace(asciiWhitespace, ' ')
        : `${node.token.text}${inlineText(node.children)}${node.close}`,
    )
    .join('');
}

function formatChildren(nodes: HtmlNode[], pad: string, depth: number): string[] {
  const lines: string[] = [];
  let run: HtmlNode[] = [];

  const flush = () => {
    const text = trimAsciiWhitespace(inlineText(run));

    if (text) lines.push(pad.repeat(depth) + text);

    run = [];
  };

  for (const [index, node] of nodes.entries()) {
    if (node.token.kind !== 'end' && isInlineChild(node, index, nodes) && !isRawBlock(node))
      run.push(node);
    else {
      flush();
      lines.push(...formatNode(node, pad, depth));
    }
  }

  flush();

  return lines;
}

function isRawBlock(node: HtmlNode): boolean {
  return node.token.kind === 'start' && node.children[0]?.token.kind === 'raw';
}

function formatNode(node: HtmlNode, pad: string, depth: number): string[] {
  const indent = pad.repeat(depth);
  const { children, close, token } = node;

  if (token.kind !== 'start' || isRawBlock(node))
    return [`${indent}${token.text}${children.map((child) => child.token.text).join('')}${close}`];
  if (children.every(isInlineChild))
    return [`${indent}${token.text}${trimAsciiWhitespace(inlineText(children))}${close}`];

  return [
    `${indent}${token.text}`,
    ...formatChildren(children, pad, depth + 1),
    ...(close ? [`${indent}${close}`] : []),
  ];
}

function minifyChildren(nodes: HtmlNode[]): string {
  const kept = nodes.filter((node) => node.token.kind !== 'comment' || isConditionalComment(node));

  return kept
    .map((node, index) => {
      if (node.token.kind !== 'text')
        return `${node.token.text}${minifyChildren(node.children)}${node.close}`;
      if (!isBlank(node)) return node.token.text.replace(asciiWhitespace, ' ');

      const isBetweenInline = [kept[index - 1], kept[index + 1]].every(
        (sibling) => sibling && sibling.token.kind !== 'comment' && isInline(sibling),
      );

      return isBetweenInline ? ' ' : '';
    })
    .join('');
}
