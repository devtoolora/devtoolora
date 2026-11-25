import type { XmlElement } from '@rgrove/parse-xml';
import { childElements, firstChild, localName, textContent } from '../format/xmlElements';
import { destination, escapeText, paragraphText } from '../format/htmlMarkdownText';
import { attr } from './docxStyles';

export type Piece = { link?: string; marks: string; pageBreak?: boolean; text: string };
export type InlineContext = {
  fields: Array<'instr' | 'result'>;
  links: Map<string, string>;
  skipped: Record<string, number>;
};

const maxDepth = 100;
const dropped = new Set(['del', 'delText', 'instrText', 'moveFrom', 'pPr', 'rPr', 'sdtPr']);
const delimiters: Record<string, string> = { b: '**', i: '*', s: '~~' };
const embedded = new Set(['drawing', 'object', 'pict', 'AlternateContent']);
const equations = new Set(['oMath', 'oMathPara']);

function skip(context: InlineContext, what: string): void {
  context.skipped[what] = (context.skipped[what] ?? 0) + 1;
}

function hasDescendant(element: XmlElement, name: string, depth: number = 0): boolean {
  return (
    depth < maxDepth &&
    childElements(element).some(
      (child) => localName(child.name) === name || hasDescendant(child, name, depth + 1),
    )
  );
}

function runMarks(rPr: XmlElement | undefined): string {
  const on = (name: string) => {
    const element = rPr && firstChild(rPr, name);

    return Boolean(element) && !['0', 'false', 'off'].includes(attr(element, 'val') ?? '');
  };

  return `${on('b') ? 'b' : ''}${on('i') ? 'i' : ''}${on('strike') ? 's' : ''}`;
}

function field(child: XmlElement, context: InlineContext): void {
  const type = attr(child, 'fldCharType');

  if (type === 'begin') context.fields.push('instr');
  else if (type === 'separate' && context.fields.length) context.fields.splice(-1, 1, 'result');
  else if (type === 'end') context.fields.pop();
}

function run(run: XmlElement, context: InlineContext, link: string | undefined, out: Piece[]) {
  const marks = runMarks(firstChild(run, 'rPr'));

  const push = (text: string, pageBreak?: boolean) => {
    if (context.fields.at(-1) !== 'instr') out.push({ link, marks, pageBreak, text });
  };

  for (const child of childElements(run)) {
    const name = localName(child.name);

    if (name === 'fldChar') field(child, context);
    else if (name === 't') push(textContent(child));
    else if (name === 'tab') push('\t');
    else if (name === 'noBreakHyphen') push('-');
    else if (name === 'br' || name === 'cr')
      push(attr(child, 'type') === 'page' ? '' : '\n', attr(child, 'type') === 'page');
    else if (name === 'footnoteReference' || name === 'endnoteReference')
      skip(context, 'footnote references');
    else if (name === 'commentReference') skip(context, 'comments');
    else if (equations.has(name)) skip(context, 'equations');
    else if (embedded.has(name))
      skip(context, hasDescendant(child, 'txbxContent') ? 'text boxes' : 'images');
  }
}

/** Pieces of a paragraph; wrappers such as sdt, smartTag and ins are descended to keep text. */
export function collectInline(
  parent: XmlElement,
  context: InlineContext,
  link: string | undefined,
  out: Piece[],
  depth: number = 0,
): void {
  if (depth > maxDepth) return;

  for (const child of childElements(parent)) {
    const name = localName(child.name);

    if (dropped.has(name)) continue;

    if (name === 'r') run(child, context, link, out);
    else if (equations.has(name)) skip(context, 'equations');
    else if (name === 'AlternateContent') {
      const pick = firstChild(child, 'Choice') ?? firstChild(child, 'Fallback');

      if (pick) collectInline(pick, context, link, out, depth + 1);
    } else if (name === 'hyperlink') {
      const target = context.links.get(attr(child, 'id') ?? '');
      const anchor = attr(child, 'anchor');

      collectInline(
        child,
        context,
        target ? `${target}${anchor ? `#${anchor}` : ''}` : link,
        out,
        depth + 1,
      );
    } else collectInline(child, context, link, out, depth + 1);
  }
}

function group(items: Piece[], key: (piece: Piece) => string): Piece[][] {
  const groups: Piece[][] = [];

  for (const piece of items) {
    const last = groups.at(-1);

    if (last && key(last[0] as Piece) === key(piece)) last.push(piece);
    else groups.push([piece]);
  }

  return groups;
}

function wrapAroundEdges(text: string, delimiter: string): string {
  const edge = (char: string | undefined) => char === ' ' || char === '\n' || char === '\t';
  let start = 0;
  let end = text.length;

  while (start < end && edge(text[start])) start++;
  while (end > start && edge(text[end - 1])) end--;

  return start === end
    ? text
    : `${text.slice(0, start)}${delimiter}${text.slice(start, end)}${delimiter}${text.slice(end)}`;
}

function markedText(pieces: Piece[]): string {
  return group(pieces, (piece) => piece.marks)
    .map((same) => {
      let text = escapeText(same.map((piece) => piece.text).join(''));

      for (const mark of (same[0] as Piece).marks)
        text = wrapAroundEdges(text, delimiters[mark] as string);

      return text;
    })
    .join('');
}

function markdownInline(pieces: Piece[]): string {
  return group(pieces, (piece) => piece.link ?? '')
    .map((same) => {
      const inner = markedText(same);
      const link = (same[0] as Piece).link;

      return link && inner.trim() ? `[${inner}](${destination(link)})` : inner;
    })
    .join('');
}

export function renderPieces(pieces: Piece[], markdown: boolean, lineBreak: string): string {
  const inline = markdown ? markdownInline(pieces) : pieces.map((piece) => piece.text).join('');
  const lines = inline.split('\n').map((line) => line.trim());

  return markdown ? paragraphText(lines.join('\n'), lineBreak) : lines.join(lineBreak).trim();
}
