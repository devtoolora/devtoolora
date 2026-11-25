import { XmlElement } from '@rgrove/parse-xml';
import { describe, expect, it } from 'vitest';
import { parseXmlDocument } from '../src/format/xmlDocument';
import { firstChild, textContent } from '../src/format/xmlElements';

function root(source: string): XmlElement {
  const element = parseXmlDocument(source).root;

  if (!element) throw new Error('no root');

  return element;
}

describe('xml element helpers', () => {
  it('finds children by local name whatever the prefix', () => {
    expect(firstChild(root('<w:d xmlns:w="u"><w:body/></w:d>'), 'body')?.name).toBe('w:body');

    expect(firstChild(root('<x:s xmlns:x="u"><x:sheetData/></x:s>'), 'sheetData')?.name).toBe(
      'x:sheetData',
    );

    expect(firstChild(root('<a/>'), 'b')).toBeUndefined();
  });

  it('concatenates text and CDATA depth first', () => {
    expect(textContent(root('<a>x<b>y<![CDATA[<z>]]></b>w</a>'))).toBe('xy<z>w');
  });

  it('honours maxLength while the default still limits', () => {
    const source = '<a/>'.padEnd(6_000_000, ' ');

    expect(parseXmlDocument(source, { maxLength: 30_000_000 }).root?.name).toBe('a');
    expect(() => parseXmlDocument(source)).toThrow(expect.objectContaining({ code: 'XML_LIMIT' }));
  });
});
