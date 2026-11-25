import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { comparePdfs, extractPdfText, type PdfFile } from '../src/pdf';

const options = { ignoreCase: false, ignoreWhitespace: false, pages: '' };

async function pdf(
  name: string,
  pages: string[][],
  size = 14,
  step = 30,
  width = 300,
): Promise<PdfFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const lines of pages) {
    const page = doc.addPage([width, 200 + lines.length * step]);

    lines.forEach((line, index) => {
      page.drawText(line, { font, size, x: 20, y: page.getHeight() - 40 - index * step });
    });
  }

  return { bytes: await doc.save(), name };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return 'resolved';
}

describe('comparePdfs', () => {
  it('diffs the fixture texts', async () => {
    const before = await pdf('before.pdf', [['Quarterly report', 'Revenue 100']]);
    const after = await pdf('after.pdf', [['Quarterly report', 'Revenue 120', 'Approved']]);
    const result = await comparePdfs(before, after, options);

    assert.deepEqual(
      result.rows.map(({ kind }) => kind),
      ['unchanged', 'changed', 'added'],
    );

    assert.equal(result.changed, 1);
    assert.deepEqual(result.rows[1]?.before?.highlight, { end: 10, start: 9 });
    assert.deepEqual(result.rows[1]?.after?.highlight, { end: 10, start: 9 });
    assert.deepEqual(result.before.pageStarts, [{ line: 1, page: 1 }]);
    assert.deepEqual(result.before.pages, [1]);
  });

  it('keeps an identical last line unchanged when page counts differ', async () => {
    const before = await pdf('before.pdf', [['A', 'B']]);
    const after = await pdf('after.pdf', [['A', 'B'], ['C']]);
    const result = await comparePdfs(before, after, options);

    assert.deepEqual(
      result.rows.map(({ kind }) => kind),
      ['unchanged', 'unchanged', 'added'],
    );

    assert.deepEqual(result.after.pageStarts, [
      { line: 1, page: 1 },
      { line: 3, page: 2 },
    ]);
  });

  it('applies the page selection to both documents and names the document', async () => {
    const before = await pdf('before.pdf', [['A']]);
    const after = await pdf('after.pdf', [['A'], ['B']]);

    assert.equal(
      await failure(comparePdfs(before, after, { ...options, pages: '2' })),
      'before.pdf: Page 2 does not exist; this PDF has 1 page.',
    );

    const result = await comparePdfs(after, after, { ...options, pages: '2' });

    assert.deepEqual(result.before.pages, [2]);
  });

  it('names text limits', async () => {
    const atLimit = await pdf('big.pdf', [['x'.repeat(99_980)]], 1, 30, 100_000);
    const overLimit = await pdf('big.pdf', [['x'.repeat(99_981)]], 1, 30, 100_000);
    const small = await pdf('small.pdf', [['x']]);

    assert.equal(
      (await extractPdfText(atLimit, { pageMarkers: false, pages: '' })).text.length,
      99_981,
    );

    assert.equal((await comparePdfs(atLimit, small, options)).beforeLines, 1);

    assert.equal(
      await failure(comparePdfs(overLimit, small, options)),
      'big.pdf has more than 100,000 characters of text; select fewer pages to compare.',
    );
  }, 20_000);

  it('names line limits', async () => {
    const lines = (count: number): string[][] => {
      const all = Array.from({ length: count }, () => 'x');
      const chunk = Math.ceil(count / 5);

      return Array.from({ length: 5 }, (_, index) => all.slice(index * chunk, (index + 1) * chunk));
    };

    const atLimit = await pdf('lines.pdf', lines(10_000), 1, 2);
    const overLimit = await pdf('lines.pdf', lines(10_001), 1, 2);
    const small = await pdf('small.pdf', [['x']]);
    const extracted = await extractPdfText(atLimit, { pageMarkers: false, pages: '' });

    assert.equal(
      extracted.pages.reduce((sum, { text }) => sum + text.split('\n').length, 0),
      10_000,
    );

    assert.equal((await comparePdfs(atLimit, small, options)).beforeLines, 10_000);

    assert.equal(
      await failure(comparePdfs(overLimit, small, options)),
      'lines.pdf has more than 10,000 lines of text; select fewer pages to compare.',
    );
  }, 30_000);

  it('prefixes reader errors with the document name', async () => {
    const good = await pdf('good.pdf', [['A']]);
    const blank = await pdf('blank.pdf', [[]]);

    assert.equal(
      await failure(
        comparePdfs(
          good,
          { bytes: new TextEncoder().encode('not a pdf'), name: 'notes.pdf' },
          options,
        ),
      ),
      'notes.pdf: This file could not be read as a PDF.',
    );

    assert.equal(
      await failure(comparePdfs({ ...blank, name: 'before.pdf' }, good, options)),
      'before.pdf has no text layer; scanned pages need OCR, which this tool does not do.',
    );
  });
});
