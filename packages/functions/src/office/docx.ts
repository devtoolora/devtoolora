import type { XmlElement } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import { childElements, firstChild, localName } from '../format/xmlElements';
import { prefixLines } from '../format/htmlMarkdownText';
import {
  assertOfficeZip,
  corruptOffice,
  notOfficeFile,
  officeMaxBytes,
  officeXml,
  readOfficeZip,
  resolveOfficePart,
} from './container';
import { collectInline, renderPieces, type InlineContext, type Piece } from './docxInline';
import {
  attr,
  paragraphKind,
  readNumbering,
  readStyles,
  type Numbering,
  type StyleInfo,
} from './docxStyles';

export type DocxStats = {
  headings: number;
  images: number;
  lists: number;
  paragraphs: number;
  skipped: Record<string, number>;
  tables: number;
};

type Block = { list?: string; text: string };
type Context = InlineContext & {
  cell: number;
  counters: Map<string, number>;
  headings: number;
  markdown: boolean;
  numbering: Numbering;
  paragraphs: number;
  size: number;
  styles: Map<string, StyleInfo>;
  tables: number;
  widths: Map<string, number[]>;
};

const maxDepth = 100;
const maxSpan = 64;
const skippedInBlocks = new Set(['del', 'moveFrom', 'tblPr', 'tblGrid', 'trPr', 'tcPr', 'sdtPr']);

const maxOutput = 20_000_000;

function checkSize(context: Context, size: number): void {
  if (size > maxOutput)
    throw new FunctionError(
      'DOCX_LIMIT',
      `The ${context.markdown ? 'Markdown' : 'text'} output is limited to 20,000,000 characters.`,
    );
}

const corrupt = (message: string): FunctionError => corruptOffice('docx', message);

type Relationship = { id: string; mode: string; target: string; type: string };

function relationships(entries: Map<string, Uint8Array>, path: string): Relationship[] {
  const root = officeXml(entries, path, 'docx')?.root;

  return root
    ? childElements(root).map((rel) => ({
        id: rel.attributes.Id ?? '',
        mode: rel.attributes.TargetMode ?? '',
        target: rel.attributes.Target ?? '',
        type: rel.attributes.Type ?? '',
      }))
    : [];
}

const partOf = (
  rels: Relationship[],
  kind: string,
  directory: string,
  fallback: string,
): string => {
  const rel = rels.find((entry) => entry.type.endsWith(`/${kind}`) && entry.target);

  return rel ? resolveOfficePart(directory, rel.target) : fallback;
};

function nextMarker(context: Context, numId: string, ilvl: number): string {
  const level = context.numbering(numId, ilvl);
  const widths = context.widths.get(numId) ?? [];
  let marker = '- ';

  if (!level.bullet) {
    const count = (context.counters.get(`${numId}:${ilvl}`) ?? level.start - 1) + 1;

    context.counters.set(`${numId}:${ilvl}`, count);
    marker = `${count}. `;
  }

  for (const key of context.counters.keys()) {
    const [id, deeper] = key.split(':');

    if (id === numId && Number(deeper) > ilvl) context.counters.delete(key);
  }

  widths[ilvl] = marker.length;
  context.widths.set(numId, widths);

  return marker;
}

function indentOf(context: Context, numId: string, ilvl: number): number {
  const widths = context.widths.get(numId) ?? [];
  let indent = 0;

  for (let level = 0; level < ilvl; level += 1) indent += widths[level] ?? 2;

  return indent;
}

function paragraph(element: XmlElement, context: Context): Block[] {
  const pieces: Piece[] = [];

  collectInline(element, context, undefined, pieces);

  // A field that never reached its result must not hide the rest of the document.
  while (context.fields.at(-1) === 'instr') context.fields.pop();

  const inCell = context.cell > 0;
  const kind = inCell ? {} : paragraphKind(firstChild(element, 'pPr'), context.styles);
  const segments: Piece[][] = [[]];

  for (const piece of pieces) {
    if (piece.pageBreak) segments.push([]);
    else (segments.at(-1) as Piece[]).push(piece);
  }

  const lineBreaks = context.markdown
    ? { cell: '<br>', plain: '\\\n' }
    : { cell: ' ', plain: '\n' };
  const lineBreak = inCell ? lineBreaks.cell : lineBreaks.plain;
  const blocks: Block[] = [];

  for (const [index, segment] of segments.entries()) {
    const heading = index === 0 ? kind.heading : undefined;
    const text = renderPieces(
      heading ? segment.map((piece) => ({ ...piece, marks: '' })) : segment,
      context.markdown,
      heading ? ' ' : lineBreak,
    );

    if (!text) continue;

    context.size += text.length;
    checkSize(context, context.size);

    if (heading) {
      context.headings += 1;
      blocks.push({ text: context.markdown ? `${'#'.repeat(heading)} ${text}` : text });

      continue;
    }

    const list = index === 0 ? kind.list : undefined;

    if (!inCell) context.paragraphs += 1;

    if (list) {
      const indent = indentOf(context, list.numId, list.ilvl);
      const marker = nextMarker(context, list.numId, list.ilvl);

      blocks.push({
        list: list.numId,
        text: prefixLines(
          text,
          `${' '.repeat(indent)}${marker}`,
          ' '.repeat(indent + marker.length),
        ),
      });
    } else blocks.push({ text });
  }

  return blocks;
}

function cellText(cell: XmlElement, context: Context, depth: number): string {
  const blocks: Block[] = [];

  walk(cell, context, depth + 1, blocks);

  return blocks.map((block) => block.text).join(context.markdown ? '<br>' : ' ');
}

function rowCells(row: XmlElement, context: Context, depth: number): string[] {
  const cells: string[] = [];

  for (const cell of childElements(row)) {
    if (localName(cell.name) !== 'tc') continue;

    const properties = firstChild(cell, 'tcPr');
    const merge = properties && firstChild(properties, 'vMerge');
    const span = Math.min(
      maxSpan,
      Math.max(1, Number(attr(properties && firstChild(properties, 'gridSpan'), 'val')) || 1),
    );
    const continued = Boolean(merge) && (attr(merge, 'val') ?? 'continue') === 'continue';

    cells.push(continued ? '' : cellText(cell, context, depth));

    for (let extra = 1; extra < span; extra += 1) cells.push('');
  }

  return cells;
}

function table(element: XmlElement, context: Context, depth: number): Block | undefined {
  context.cell += 1;

  const rows = childElements(element)
    .filter((row) => localName(row.name) === 'tr')
    .map((row) => rowCells(row, context, depth));

  context.cell -= 1;

  if (!rows.length) return undefined;

  if (context.cell > 0) return { text: rows.flat().filter(Boolean).join(' ') };

  context.tables += 1;

  const width = Math.max(...rows.map((row) => row.length));

  context.size += rows.length * width * 3;
  checkSize(context, context.size);

  const padded = rows.map((row) => [...row, ...Array<string>(width - row.length).fill('')]);

  if (!context.markdown)
    return {
      text: padded.map((row) => row.map((cell) => cell.replace(/\t/g, ' ')).join('\t')).join('\n'),
    };

  const line = (row: string[]) =>
    `| ${row.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`;
  const [header = [], ...body] = padded;

  return {
    text: [line(header), line(header.map(() => '---')), ...body.map(line)].join('\n'),
  };
}

function walk(parent: XmlElement, context: Context, depth: number, out: Block[]): void {
  if (depth > maxDepth) return;

  for (const child of childElements(parent)) {
    const name = localName(child.name);

    if (skippedInBlocks.has(name)) continue;

    if (name === 'p') out.push(...paragraph(child, context));
    else if (name === 'tbl') {
      const block = table(child, context, depth);

      if (block) out.push(block);
    } else if (name === 'sectPr') {
    } else if (name === 'AlternateContent') {
      const pick = firstChild(child, 'Choice') ?? firstChild(child, 'Fallback');

      if (pick) walk(pick, context, depth + 1, out);
    } else walk(child, context, depth + 1, out);
  }
}

function loadContext(bytes: Uint8Array, markdown: boolean): { body: XmlElement; context: Context } {
  if (bytes.length > officeMaxBytes)
    throw new FunctionError('DOCX_LIMIT', 'A DOCX file is limited to 20 MiB.');

  assertOfficeZip(bytes, 'docx');

  const head = readOfficeZip(bytes, 'docx', (name) => name.endsWith('.rels'));

  if (!head.has('_rels/.rels')) throw notOfficeFile('docx');

  const main = partOf(
    relationships(head, '_rels/.rels'),
    'officeDocument',
    '',
    'word/document.xml',
  );
  const directory = main.slice(0, main.lastIndexOf('/') + 1);
  const relsPath = `${directory}_rels/${main.slice(directory.length)}.rels`;
  const rels = relationships(head, relsPath);
  const stylesPath = partOf(rels, 'styles', directory, `${directory}styles.xml`);
  const numberingPath = partOf(rels, 'numbering', directory, `${directory}numbering.xml`);
  const entries = readOfficeZip(
    bytes,
    'docx',
    (name) => name === main || name === stylesPath || name === numberingPath,
  );

  if (!entries.get(main)?.length) throw corrupt(`${main} is missing or empty.`);

  const root = officeXml(entries, main, 'docx')?.root;
  const body = root && localName(root.name) === 'document' ? firstChild(root, 'body') : undefined;

  if (!body) throw corrupt(`${main} has no document body.`);

  const context: Context = {
    cell: 0,
    counters: new Map(),
    fields: [],
    headings: 0,
    links: new Map(
      rels
        .filter(
          (rel) => rel.type.endsWith('/hyperlink') && /^(https?:|mailto:)/i.test(rel.target.trim()),
        )
        .map((rel) => [rel.id, rel.target.trim()] as const),
    ),
    markdown,
    numbering: readNumbering(officeXml(entries, numberingPath, 'docx')?.root ?? undefined),
    paragraphs: 0,
    size: 0,
    skipped: {},
    styles: readStyles(officeXml(entries, stylesPath, 'docx')?.root ?? undefined),
    tables: 0,
    widths: new Map(),
  };

  const headerParts = rels.filter(
    (rel) => rel.type.endsWith('/header') || rel.type.endsWith('/footer'),
  ).length;

  if (headerParts) context.skipped['headers and footers'] = headerParts;

  return { body, context };
}

export function docxToText(
  bytes: Uint8Array,
  options: { output: 'markdown' | 'text' },
): { stats: DocxStats; text: string } {
  const { body, context } = loadContext(bytes, options.output === 'markdown');
  const blocks: Block[] = [];

  walk(body, context, 0, blocks);

  let lists = 0;
  let text = '';

  for (const [index, block] of blocks.entries()) {
    const previous = blocks[index - 1];

    if (block.list && block.list !== previous?.list) lists += 1;

    const breaker =
      context.markdown && block.list !== previous?.list && block.list && previous?.list;
    let gap = block.list && previous?.list ? '\n' : '\n\n';

    // A comment ends the previous list so a restarted numbered list keeps its numbers.
    if (breaker) gap = '\n\n<!-- -->\n\n';

    text += `${index ? gap : ''}${block.text}`;
  }

  return {
    stats: {
      headings: context.headings,
      images: context.skipped.images ?? 0,
      lists,
      paragraphs: context.paragraphs,
      skipped: context.skipped,
      tables: context.tables,
    },
    text,
  };
}
