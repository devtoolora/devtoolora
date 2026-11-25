import MarkdownIt, { type MarkdownIt as MarkdownItParser, type Token } from 'markdown-it';
import { FunctionError } from '../errors';

export type MarkdownHtmlOptions = {
  breaks?: boolean;
  dialect?: 'commonmark' | 'extended';
};

export type MarkdownPreviewNode = {
  align?: 'center' | 'left' | 'right';
  children?: MarkdownPreviewNode[];
  start?: number;
  tag:
    | 'blockquote'
    | 'br'
    | 'code'
    | 'em'
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'hr'
    | 'image'
    | 'li'
    | 'link'
    | 'ol'
    | 'p'
    | 'pre'
    | 's'
    | 'strong'
    | 'table'
    | 'tbody'
    | 'td'
    | 'text'
    | 'th'
    | 'thead'
    | 'tr'
    | 'ul';
  target?: string;
  text?: string;
};

export type MarkdownHtmlResult = {
  codeBlocks: number;
  headings: number;
  html: string;
  images: number;
  links: number;
  nodes: MarkdownPreviewNode[];
};

const tags = new Set([
  'blockquote',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

function previewNodes(
  tokens: Token[],
  parser: MarkdownItParser,
  breaks: boolean,
): MarkdownPreviewNode[] {
  const roots: MarkdownPreviewNode[] = [];
  const stack = [roots];

  for (const token of tokens) {
    if (token.hidden) continue;

    const children = stack.at(-1);

    if (!children) throw new FunctionError('INVALID_MARKDOWN', 'Unbalanced Markdown tokens.');

    if (token.type === 'inline') {
      children.push(...previewNodes(token.children ?? [], parser, breaks));

      continue;
    }

    if (token.nesting === -1) {
      stack.pop();

      continue;
    }

    let node: MarkdownPreviewNode;

    if (token.type === 'text' || token.type === 'code_inline') {
      node = { tag: token.type === 'text' ? 'text' : 'code', text: token.content };
    } else if (token.type === 'softbreak' || token.type === 'hardbreak') {
      node = token.type === 'hardbreak' || breaks ? { tag: 'br' } : { tag: 'text', text: '\n' };
    } else if (token.type === 'fence' || token.type === 'code_block') {
      node = { children: [{ tag: 'code', text: token.content }], tag: 'pre' };
    } else if (token.type === 'image') {
      node = {
        tag: 'image',
        target: String(token.attrGet('src') ?? ''),
        text: parser.renderer.renderInlineAsText(token.children ?? [], parser.options, {}),
      };
    } else if (token.type === 'link_open') {
      node = { children: [], tag: 'link', target: String(token.attrGet('href') ?? '') };
    } else if (tags.has(token.tag)) {
      // The closed parser tag set is the trusted boundary, not arbitrary source HTML.
      node = {
        children: token.nesting === 1 ? [] : undefined,
        tag: token.tag as MarkdownPreviewNode['tag'],
      };

      if (token.tag === 'ol') node.start = Number(token.attrGet('start') ?? '1');

      const alignment = String(token.attrGet('style') ?? '').replace('text-align:', '');

      if (alignment === 'left' || alignment === 'center' || alignment === 'right')
        node.align = alignment;
    } else {
      throw new FunctionError('INVALID_MARKDOWN', `Unsupported Markdown token: ${token.type}.`);
    }

    children.push(node);
    if (token.nesting === 1 && node.children) stack.push(node.children);
  }

  return roots;
}

export function renderMarkdownHtml(
  text: string,
  options: MarkdownHtmlOptions = {},
): MarkdownHtmlResult {
  if (text.length > 100_000)
    throw new FunctionError(
      'INVALID_MARKDOWN',
      'Markdown input is limited to 100,000 UTF-16 units.',
    );
  if (/\u0000|[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_MARKDOWN',
      'Provide valid Unicode Markdown without NUL or unpaired surrogates.',
    );

  const dialect = options.dialect ?? 'extended';

  if (dialect !== 'commonmark' && dialect !== 'extended')
    throw new FunctionError('INVALID_MARKDOWN', 'Choose CommonMark or Extended Markdown.');

  const parserOptions = {
    breaks: options.breaks ?? false,
    html: false,
    linkify: false,
    maxNesting: 64,
    typographer: false,
    // Both presets write HTML5 void elements (<br>, <hr>, <img>); the CommonMark preset would
    // otherwise use XHTML <br />.
    xhtmlOut: false,
  };
  const parser = new MarkdownIt(dialect === 'commonmark' ? 'commonmark' : 'default', parserOptions);
  const tokens = parser.parse(text.replace(/^\uFEFF/, ''), {});
  const allTokens = tokens.flatMap((token) => [token, ...(token.children ?? [])]);

  if (allTokens.length > 10_000)
    throw new FunctionError(
      'INVALID_MARKDOWN',
      'Markdown is limited to 10,000 parsed tokens. Simplify the document.',
    );
  if (allTokens.some((token) => token.level >= 60))
    throw new FunctionError(
      'INVALID_MARKDOWN',
      'Markdown nesting is limited to 60 parsed levels. Simplify nested lists, quotes or emphasis.',
    );

  const html = parser.renderer.render(tokens, parser.options, {});

  if (html.length > 1_000_000)
    throw new FunctionError(
      'INVALID_MARKDOWN',
      'Rendered HTML is limited to 1,000,000 UTF-16 units.',
    );

  return {
    codeBlocks: allTokens.filter((token) => token.type === 'fence' || token.type === 'code_block')
      .length,
    headings: allTokens.filter((token) => token.type === 'heading_open').length,
    html,
    images: allTokens.filter((token) => token.type === 'image').length,
    links: allTokens.filter((token) => token.type === 'link_open').length,
    nodes: previewNodes(tokens, parser, options.breaks ?? false),
  };
}

export function markdownToHtml(text: string): string {
  return renderMarkdownHtml(text).html;
}
