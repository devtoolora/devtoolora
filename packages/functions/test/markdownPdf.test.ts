import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { describe, it } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { markdownToPdf } from '@devtoolora/functions/pdf';
import { FunctionError } from '@devtoolora/functions/errors';

describe('local Markdown PDF layout', () => {
  it('embeds Latin Extended fonts and preserves Czech metadata with A4 sizing', async () => {
    const bytes = await markdownToPdf(
      '# Český přehled\n\nPříliš žluťoučký kůň úpěl ďábelské ódy.',
      'Český přehled',
      { fontSize: 12, pageSize: 'a4' },
    );
    const pdf = await PDFDocument.load(bytes);

    assert.equal(pdf.getTitle(), 'Český přehled');
    assert.equal(pdf.getPageCount(), 1);
    assert.deepEqual(pdf.getPage(0).getSize(), { height: 841.89, width: 595.28 });
    assert.ok(bytes.length > 2000);
  });

  it('normalizes decomposed accents, supports block styles and continues onto pages', async () => {
    const input =
      '# Pr\u030ci\u0301lis\u030c\n\n## Heading\n- First\n1. Second\n> Quote\n```\n    code\n```\n\n' +
      'A paragraph with wide WWW and narrow iii letters. '.repeat(350);
    const pdf = await PDFDocument.load(await markdownToPdf(input));

    assert.ok(pdf.getPageCount() > 1);
    assert.deepEqual(pdf.getPage(0).getSize(), { height: 792, width: 612 });
    assert.ok((await markdownToPdf('W'.repeat(2000))).length > 2000);
  });

  it('indents a nested list item once, by its offset, not by its leading spaces', async () => {
    const pdf = await PDFDocument.load(
      await markdownToPdf('- Item\n    - Item\n1. One\n    2. One'),
    );
    const drawn = pdf.context
      .enumerateIndirectObjects()
      .flatMap(([, object]) =>
        object instanceof PDFRawStream && object.dict.has(PDFName.of('Filter'))
          ? [
              ...inflateSync(object.contents)
                .toString('latin1')
                .matchAll(/(\d+(?:\.\d+)?) [\d.]+ Tm\n<([0-9A-F]*)> Tj/g),
            ]
          : [],
      )
      .map(([, x, glyphs]) => [Number(x), glyphs!.length / 4]);

    // Each line draws "• Item" or "1. One": six glyphs, the nested ones 24 pt further right.
    assert.deepEqual(drawn.slice(0, 4), [
      [68, 6],
      [92, 6],
      [68, 6],
      [92, 6],
    ]);
  });

  it('rejects unsupported glyphs and validates explicit input and layout limits', async () => {
    for (const input of ['', ' ', '漢字', '🙂', 'A\u0000B', 'x'.repeat(50001)]) {
      await assert.rejects(() => markdownToPdf(input), FunctionError);
    }

    await assert.rejects(() => markdownToPdf('Text', 'x'.repeat(201)), FunctionError);
    await assert.rejects(() => markdownToPdf('Text', 'A\nB'), FunctionError);

    for (const fontSize of [8, 17, 10.5, NaN, Infinity]) {
      await assert.rejects(() => markdownToPdf('Text', 'Document', { fontSize }), FunctionError);
    }

    await assert.rejects(() => markdownToPdf('```\n' + '\n'.repeat(49000)), /100-page limit/);
  });
});
