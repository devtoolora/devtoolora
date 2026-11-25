import { FunctionError } from '../errors';
import { requiredText } from './shared';
import { type HtmlToken, tokenizeHtml } from './htmlTokenizer';

export type HtmlNode = {
  children: HtmlNode[];
  close: string;
  token: HtmlToken;
};

const maxDepth = 100;
const maxLength = 5_000_000;
const maxNodes = 100_000;

// Only ASCII whitespace collapses; JavaScript's \s would also eat the no-break space.
export const asciiWhitespace = /[ \t\n\r\f]+/g;

export const blockElements: ReadonlySet<string> = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'caption',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'li',
  'link',
  'main',
  'meta',
  'nav',
  'noscript',
  'ol',
  'optgroup',
  'option',
  'p',
  'pre',
  'script',
  'section',
  'select',
  'style',
  'summary',
  'table',
  'tbody',
  'td',
  'template',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'ul',
]);
const voidElements: ReadonlySet<string> = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

export function buildHtmlTree(
  input: string,
  label: string,
): { autoClosed: number; root: HtmlNode } {
  if (input.length > maxLength)
    throw new FunctionError('HTML_TOO_LARGE', 'HTML input is limited to 5,000,000 characters.');

  const tokens = tokenizeHtml(requiredText(input, 'HTML'));
  const root: HtmlNode = { children: [], close: '', token: { kind: 'text', text: '' } };
  const stack = [root];
  let autoClosed = 0;
  let nodes = 0;

  for (const token of tokens) {
    if (++nodes > maxNodes)
      throw new FunctionError('HTML_LIMIT', `${label} supports up to 100,000 nodes.`);

    const opener = token.kind === 'end' ? findOpen(stack, token.name) : -1;

    if (opener > 0) {
      const [closed, ...unclosed] = stack.splice(opener);

      if (closed) closed.close = token.text;

      autoClosed += closeAll(unclosed);

      continue;
    }

    const node: HtmlNode = { children: [], close: '', token };

    if (token.kind === 'start') popImplied(stack, token.name ?? '');

    (stack[stack.length - 1] ?? root).children.push(node);

    if (token.kind === 'start' && !token.selfClosing && !voidElements.has(token.name ?? '')) {
      stack.push(node);
      if (stack.length - 1 > maxDepth)
        throw new FunctionError('HTML_LIMIT', `${label} supports up to 100 nesting levels.`);
    }
  }

  autoClosed += closeAll(stack.slice(1));

  return { autoClosed, root };
}

const listItemEnds: ReadonlySet<string> = new Set(['li']);
const definitionEnds: ReadonlySet<string> = new Set(['dd', 'dt']);
const cellEnds: ReadonlySet<string> = new Set(['td', 'th', 'tr']);
const optionEnds: ReadonlySet<string> = new Set(['optgroup', 'option']);

// Open element name -> start tags that implicitly end it (HTML optional end tags).
// A Map, so tag names such as "constructor" never hit Object.prototype.
const impliedEndTags: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['dd', definitionEnds],
  ['dt', definitionEnds],
  ['li', listItemEnds],
  ['option', optionEnds],
  ['p', blockElements],
  ['td', cellEnds],
  ['th', cellEnds],
  ['tr', new Set(['tr'])],
]);

// Start tags allowed in head; any other start tag closes an open head (the "in head" rule).
const headContent: ReadonlySet<string> = new Set([
  'base',
  'link',
  'meta',
  'noscript',
  'script',
  'style',
  'template',
  'title',
]);

function popImplied(stack: HtmlNode[], name: string) {
  while (stack.length > 1 && isEndedBy(stack[stack.length - 1]?.token.name ?? '', name))
    stack.pop();
}

function isEndedBy(open: string, name: string): boolean {
  if (open === 'head') return !headContent.has(name);

  return impliedEndTags.get(open)?.has(name) ?? false;
}

function closeAll(nodes: HtmlNode[]): number {
  const explicit = nodes.filter((node) => !impliedEndTags.has(node.token.name ?? ''));

  explicit.forEach(closeNode);

  return explicit.length;
}

function findOpen(stack: HtmlNode[], name = ''): number {
  for (let index = stack.length - 1; index > 0; index--)
    if (stack[index]?.token.name === name) return index;

  return -1;
}

function closeNode(node: HtmlNode) {
  node.close = `</${/^<([^\s/>]+)/.exec(node.token.text)?.[1] ?? ''}>`;
}
