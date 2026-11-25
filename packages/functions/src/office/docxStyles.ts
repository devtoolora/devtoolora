import type { XmlElement } from '@rgrove/parse-xml';
import { childElements, firstChild, localName } from '../format/xmlElements';

export type StyleInfo = {
  basedOn?: string;
  ilvl?: string;
  name: string;
  numId?: string;
  outline?: string;
};
type NumberingLevel = { bullet: boolean; start: number };
export type Numbering = (numId: string, ilvl: number) => NumberingLevel;
export type ParagraphKind = { heading?: number; list?: { ilvl: number; numId: string } };

const maxChain = 20;

/** An attribute by local name, so w:val and val are the same whatever prefix the writer used. */
export function attr(element: XmlElement | undefined, name: string): string | undefined {
  if (!element) return undefined;

  const key = Object.keys(element.attributes).find((candidate) => localName(candidate) === name);

  return key === undefined ? undefined : element.attributes[key];
}

export function readStyles(root: XmlElement | undefined): Map<string, StyleInfo> {
  const styles = new Map<string, StyleInfo>();

  for (const style of root ? childElements(root) : []) {
    const id = attr(style, 'styleId');

    if (localName(style.name) !== 'style' || id === undefined) continue;

    const pPr = firstChild(style, 'pPr');
    const numPr = pPr && firstChild(pPr, 'numPr');

    styles.set(id, {
      basedOn: attr(firstChild(style, 'basedOn'), 'val'),
      ilvl: attr(numPr && firstChild(numPr, 'ilvl'), 'val'),
      name: attr(firstChild(style, 'name'), 'val') ?? '',
      numId: attr(numPr && firstChild(numPr, 'numId'), 'val'),
      outline: attr(pPr && firstChild(pPr, 'outlineLvl'), 'val'),
    });
  }

  return styles;
}

function chainOf(id: string | undefined, styles: Map<string, StyleInfo>): StyleInfo[] {
  const chain: StyleInfo[] = [];
  const seen = new Set<string>();

  for (let next = id; next !== undefined && !seen.has(next) && chain.length < maxChain;) {
    const style = styles.get(next);

    seen.add(next);

    if (!style) break;

    chain.push(style);
    next = style.basedOn;
  }

  return chain;
}

const outlineLevel = (value: string | undefined): number | undefined => {
  const level = Number(value);

  return value !== undefined && Number.isInteger(level) && level >= 0 && level <= 5
    ? level + 1
    : undefined;
};

function headingOf(pPr: XmlElement | undefined, chain: StyleInfo[]): number | undefined {
  for (const style of chain) {
    const match = /^heading ([1-6])$/i.exec(style.name.trim());

    if (match) return Number(match[1]);
    if (style.name.trim().toLowerCase() === 'title') return 1;
  }

  return (
    outlineLevel(attr(pPr && firstChild(pPr, 'outlineLvl'), 'val')) ??
    outlineLevel(chain.find((style) => style.outline !== undefined)?.outline)
  );
}

export function paragraphKind(
  pPr: XmlElement | undefined,
  styles: Map<string, StyleInfo>,
): ParagraphKind {
  const chain = chainOf(attr(pPr && firstChild(pPr, 'pStyle'), 'val'), styles);
  const numPr = pPr && firstChild(pPr, 'numPr');
  const numId =
    attr(numPr && firstChild(numPr, 'numId'), 'val') ??
    chain.find((style) => style.numId !== undefined)?.numId;
  const ilvl = Number(
    attr(numPr && firstChild(numPr, 'ilvl'), 'val') ??
      chain.find((style) => style.ilvl !== undefined)?.ilvl ??
      0,
  );
  const heading = headingOf(pPr, chain);

  return {
    heading,
    list:
      numId !== undefined && numId !== '0'
        ? { ilvl: Number.isInteger(ilvl) && ilvl >= 0 && ilvl <= 8 ? ilvl : 0, numId }
        : undefined,
  };
}

type LevelDef = { fmt: string; start: number };

function levelsOf(abstract: XmlElement): Map<number, LevelDef> {
  const levels = new Map<number, LevelDef>();

  for (const level of childElements(abstract)) {
    if (localName(level.name) !== 'lvl') continue;

    const start = Number(attr(firstChild(level, 'start'), 'val') ?? 1);

    levels.set(Number(attr(level, 'ilvl') ?? 0), {
      fmt: attr(firstChild(level, 'numFmt'), 'val') ?? 'decimal',
      start: Number.isFinite(start) ? start : 1,
    });
  }

  return levels;
}

export function readNumbering(root: XmlElement | undefined): Numbering {
  const abstracts = new Map<string, Map<number, LevelDef>>();
  const nums = new Map<string, { abstractId: string; starts: Map<number, number> }>();

  for (const child of root ? childElements(root) : []) {
    const kind = localName(child.name);

    if (kind === 'abstractNum') abstracts.set(attr(child, 'abstractNumId') ?? '', levelsOf(child));

    if (kind === 'num') {
      const starts = new Map<number, number>();

      for (const override of childElements(child)) {
        const start = Number(attr(firstChild(override, 'startOverride'), 'val'));

        if (localName(override.name) === 'lvlOverride' && Number.isFinite(start))
          starts.set(Number(attr(override, 'ilvl') ?? 0), start);
      }

      nums.set(attr(child, 'numId') ?? '', {
        abstractId: attr(firstChild(child, 'abstractNumId'), 'val') ?? '',
        starts,
      });
    }
  }

  return (numId, ilvl) => {
    const num = nums.get(numId);
    const level = num && abstracts.get(num.abstractId)?.get(ilvl);

    if (!num || !level) return { bullet: true, start: 1 };

    return { bullet: level.fmt === 'bullet', start: num.starts.get(ilvl) ?? level.start };
  };
}
