import { strToU8, zipSync } from 'fflate';

const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkg = 'http://schemas.openxmlformats.org/package/2006/relationships';

export const run = (text: string, props: string = ''): string =>
  `<w:r>${props && `<w:rPr>${props}</w:rPr>`}<w:t xml:space="preserve">${text}</w:t></w:r>`;
export const para = (inner: string, props: string = ''): string =>
  `<w:p>${props && `<w:pPr>${props}</w:pPr>`}${inner}</w:p>`;
export const item = (text: string, numId: number, ilvl: number): string =>
  para(run(text), `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`);

const styles = `<w:styles xmlns:w="${w}"><w:style w:styleId="Nadpis1" w:type="paragraph"><w:name w:val="heading 1"/></w:style><w:style w:styleId="Title" w:type="paragraph"><w:name w:val="Title"/></w:style><w:style w:styleId="Sub" w:type="paragraph"><w:name w:val="Sub"/><w:basedOn w:val="Nadpis1"/></w:style></w:styles>`;
const numbering = `<w:numbering xmlns:w="${w}"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl><w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"/></w:lvlOverride></w:num></w:numbering>`;
const documentRels = `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${r}/hyperlink" Target="https://example.com/a b" TargetMode="External"/><Relationship Id="rId2" Type="${r}/hyperlink" Target="javascript:x" TargetMode="External"/></Relationships>`;
const rootRels = `<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${r}/officeDocument" Target="word/document.xml"/></Relationships>`;

export type DocxParts = {
  body: string;
  documentRels?: string;
  path?: string;
  plain?: boolean;
  rootRels?: string;
};

export function docx({
  body,
  documentRels: linkRels = documentRels,
  path = 'word/document.xml',
  plain = false,
  rootRels: rels,
}: DocxParts) {
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  const parts: Record<string, string> = {
    '_rels/.rels': rels ?? rootRels.replace('word/document.xml', path),
    [path]: `<w:document xmlns:w="${w}" xmlns:r="${r}" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>${body}</w:body></w:document>`,
  };

  if (!plain) {
    parts[`${dir}styles.xml`] = styles;
    parts[`${dir}numbering.xml`] = numbering;
    parts[`${dir}_rels/${path.slice(dir.length)}.rels`] = linkRels;
  }

  return zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])));
}
