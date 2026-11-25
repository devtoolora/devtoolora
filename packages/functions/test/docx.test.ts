import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { docxToText } from '../src/office';
import { textutilDocx } from './fixtures/textutilDocx';
import { docx, item, para, run } from './fixtures/docx';

const bold = '<w:b/>';
const convert = (body: string, output: 'markdown' | 'text' = 'markdown', plain = false) =>
  docxToText(docx({ body, plain }), { output });

const table = `<w:tbl><w:tr><w:tc>${para(run('Name'))}</w:tc><w:tc>${para(run('a|b'))}${para(run('two'))}</w:tc></w:tr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>${para(run('wide'))}</w:tc></w:tr></w:tbl>`;
const body = [
  para(run('Release notes'), '<w:pStyle w:val="Nadpis1"/>'),
  para(
    `${run('Adds ')}${run('three', bold)}${run(' and ')}${run('fixes', '<w:i/>')}<w:hyperlink r:id="rId1">${run('the docs')}</w:hyperlink> ${'<w:hyperlink r:id="rId2">'}${run('bad')}</w:hyperlink>`,
  ),
  item('one', 1, 0),
  item('nested', 1, 1),
  item('third', 2, 0),
  item('sub', 2, 1),
  item('fourth', 2, 0),
  table,
  para(
    `${run('kept')}<w:ins>${run(' added')}</w:ins><w:del><w:r><w:delText>gone</w:delText></w:r></w:del>`,
  ),
  para(
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      `${run('7')}<w:r><w:fldChar w:fldCharType="end"/></w:r>`,
  ),
  para(`${run('line')}<w:r><w:br/></w:r>${run('break')}`),
  para('', ''),
  para(run('Deep'), '<w:outlineLvl w:val="1"/>'),
].join('');

describe('docxToText', () => {
  it('writes markdown with headings, marks, links, lists, tables and tracked changes', () => {
    const { stats, text } = convert(body);

    assert.equal(
      text,
      [
        '# Release notes',
        'Adds **three** and *fixes*[the docs](<https://example.com/a b>)bad',
        '- one\n  - nested\n\n<!-- -->\n\n3. third\n   1. sub\n4. fourth',
        '| Name | a\\|b<br>two |\n| --- | --- |\n| wide |  |',
        'kept added',
        '7',
        'line\\\nbreak',
        '## Deep',
      ].join('\n\n'),
    );

    assert.deepEqual([stats.headings, stats.lists, stats.tables], [2, 2, 1]);
  });

  it('writes text with markers, tab-separated rows and no marks', () => {
    const { text } = convert(body, 'text');

    assert.ok(text.includes('- one\n  - nested\n3. third\n   1. sub\n4. fourth'));
    assert.ok(text.includes('Name\ta|b two\nwide\t'));
    assert.ok(!text.includes('**') && !text.includes('#') && !text.includes('gone'));
  });

  it('keeps text inside wrappers and counts what it skips', () => {
    const { stats, text } = convert(
      `<w:sdt><w:sdtContent>${para(run('control'))}</w:sdtContent></w:sdt>` +
        para(
          `<w:smartTag>${run('smart ')}</w:smartTag><w:fldSimple w:instr="X">${run('simple ')}</w:fldSimple><mc:AlternateContent><mc:Choice>${run('alt')}</mc:Choice><mc:Fallback>${run('dup')}</mc:Fallback></mc:AlternateContent><w:r><w:drawing/></w:r><w:r><w:pict><w:txbxContent/></w:pict></w:r><m:oMath/>`,
        ) +
        para(`${run('a')}<w:r><w:br w:type="page"/></w:r>${run('b')}`),
      'text',
      true,
    );

    assert.equal(text, 'control\n\nsmart simple alt\n\na\n\nb');
    assert.deepEqual(stats.skipped, { equations: 1, images: 1, 'text boxes': 1 });
    assert.equal(stats.images, 1);
  });

  it('finds a renamed main part through the root relationships', () => {
    const bytes = docx({ body: para(run('moved')), path: 'docs/main.xml' });

    assert.equal(docxToText(bytes, { output: 'text' }).text, 'moved');
  });

  it('converts a file written by textutil', () => {
    const bytes = new Uint8Array(Buffer.from(textutilDocx, 'base64'));
    const { text } = docxToText(bytes, { output: 'markdown' });

    for (const word of ['Release notes', 'Faster import', 'Alpha']) assert.ok(text.includes(word));
  });

  it('names legacy files and corrupt documents', () => {
    assert.throws(
      () => docxToText(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0, 0]), { output: 'text' }),
      /legacy \.xls\/\.doc/,
    );

    assert.throws(
      () => docxToText(zipSync({ 'a.txt': strToU8('x') }), { output: 'text' }),
      /This is not a \.docx file/,
    );
  });

  it('words XML and ZIP failures for the document', () => {
    const rels =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://x/officeDocument" Target="word/document.xml"/></Relationships>';
    const zip = (document: string) =>
      zipSync({ '_rels/.rels': strToU8(rels), 'word/document.xml': strToU8(document) });

    assert.throws(
      () => docxToText(zip('<w:document><w:p></w:document>'), { output: 'text' }),
      /document looks corrupt: word\/document\.xml is not valid XML/,
    );

    assert.throws(
      () => docxToText(strToU8('%PDF-1.4 not a zip at all, just text'), { output: 'text' }),
      /This is not a \.docx file/,
    );
  });

  it('escapes body text and keeps tabs outside emphasis', () => {
    const { text } = convert(
      para(run('a*b_c &lt;x&gt;')) +
        para(run('# not heading')) +
        para(run('1. not list')) +
        para(`${run('lead\t', bold)}<w:r><w:t>x</w:t></w:r>`),
    );

    assert.equal(text, 'a\\*b\\_c \\<x\\>\n\n\\# not heading\n\n1\\. not list\n\n**lead**\tx');
  });

  it('keeps ) in a link, joins anchors and drops anchor-only links', () => {
    const rels =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x/hyperlink" Target="https://e.com/a(b)" TargetMode="External"/></Relationships>';
    const link = (anchor: string) =>
      docx({
        body: para(`<w:hyperlink r:id="rId1" w:anchor="${anchor}">${run('go')}</w:hyperlink>`),
        documentRels: rels,
      });

    assert.equal(
      docxToText(link('top'), { output: 'markdown' }).text,
      '[go](<https://e.com/a(b)#top>)',
    );

    assert.equal(convert(para(`<w:hyperlink w:anchor="x">${run('in')}</w:hyperlink>`)).text, 'in');
  });

  it('flattens nested tables, honors startOverride and separates lists', () => {
    const nested = `<w:tbl><w:tr><w:tc>${para(run('outer'))}<w:tbl><w:tr><w:tc>${para(run('in1'))}</w:tc><w:tc>${para(run('in2'))}</w:tc></w:tr></w:tbl></w:tc></w:tr></w:tbl>`;

    assert.equal(convert(nested).text, '| outer<br>in1 in2 |\n| --- |');
    assert.equal(convert(item('a', 1, 0) + item('b', 2, 0)).text, '- a\n\n<!-- -->\n\n3. b');
    assert.equal(convert(item('a', 1, 0) + item('b', 2, 0), 'text').text, '- a\n3. b');
  });

  it('shows moveTo, drops moveFrom, resolves Title and basedOn headings and tab and hyphen', () => {
    const { text } = convert(
      `<w:moveTo>${para(run('to'))}</w:moveTo><w:moveFrom>${para(run('from'))}</w:moveFrom>` +
        para(run('T'), '<w:pStyle w:val="Title"/>') +
        para(run('S'), '<w:pStyle w:val="Sub"/>') +
        para('<w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:noBreakHyphen/><w:t>c</w:t></w:r>'),
    );

    assert.equal(text, 'to\n\n# T\n\n# S\n\na\tb-c');
  });

  it('continues text after an unclosed field and counts header parts', () => {
    const open =
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>X</w:instrText></w:r>';

    assert.equal(convert(para(`${run('a')}${open}`) + para(run('after'))).text, 'a\n\nafter');
  });

  it('counts header and footer parts from the relationships', () => {
    const rels =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="h" Type="x/header" Target="header1.xml"/><Relationship Id="f" Type="x/footer" Target="footer1.xml"/></Relationships>';

    assert.deepEqual(
      docxToText(docx({ body: para(run('x')), documentRels: rels }), { output: 'text' }).stats
        .skipped,
      { 'headers and footers': 2 },
    );
  });

  it('fails with the named limit for huge table padding', () => {
    const wide = `<w:tr>${`<w:tc>${para('')}</w:tc>`.repeat(6000)}</w:tr>`;
    const rows = `<w:tr><w:tc>${para('')}</w:tc></w:tr>`.repeat(6000);

    assert.throws(() => convert(`<w:tbl>${wide}${rows}</w:tbl>`), /Markdown output is limited/);
    assert.throws(() => convert(`<w:tbl>${wide}${rows}</w:tbl>`, 'text'), /text output is limited/);
  });
});
