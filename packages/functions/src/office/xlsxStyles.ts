import type { XmlElement } from '@rgrove/parse-xml';
import { childElements, firstChild, localName, textContent } from '../format/xmlElements';
import { dateFormatKind, type DateKind } from './excelDates';

const builtInKinds = new Map<number, DateKind>([
  // 27-36 and 50-58 are the East Asian date formats.
  ...[
    14, 15, 16, 17, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58,
  ].map((id): [number, DateKind] => [id, 'date']),
  ...[18, 19, 20, 21, 45, 47].map((id): [number, DateKind] => [id, 'time']),
  [46, 'duration'],
  [22, 'datetime'],
]);

export function dateKindsByStyle(styleSheet: XmlElement | undefined): Array<DateKind | undefined> {
  if (!styleSheet) return [];

  const codes = new Map<number, string>();

  for (const format of childElements(firstChild(styleSheet, 'numFmts') ?? styleSheet))
    if (localName(format.name) === 'numFmt')
      codes.set(Number(format.attributes.numFmtId), format.attributes.formatCode ?? '');

  const xfs = firstChild(styleSheet, 'cellXfs');

  return childElements(xfs ?? styleSheet)
    .filter((xf) => xfs && localName(xf.name) === 'xf')
    .map((xf) => {
      const id = Number(xf.attributes.numFmtId);
      const code = codes.get(id);

      return code === undefined ? builtInKinds.get(id) : dateFormatKind(code);
    });
}

export function sharedStringTexts(sst: XmlElement | undefined): string[] {
  return sst
    ? childElements(sst)
        .filter((item) => localName(item.name) === 'si')
        .map((item) => unescapeOoxml(richText(item)))
    : [];
}

export function richText(element: XmlElement): string {
  let text = '';

  for (const child of childElements(element)) {
    const name = localName(child.name);

    if (name === 't') text += textContent(child);
    else if (name === 'r') text += richText(child);
  }

  return text;
}

/** `_xHHHH_` escapes; `_x005F_` is a literal underscore and its result is not scanned again. */
export function unescapeOoxml(text: string): string {
  return text.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}
