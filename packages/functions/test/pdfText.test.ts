import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { FunctionError } from '../src/errors';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  cropPdf,
  extractPdfText,
  fillPdfForm,
  inspectPdfSignatures,
  listPdfFormFields,
  resizePdf,
} from '../src/pdf';
import { pageText, pdfjsError, selectTextPages } from '../src/pdf/text';

async function samplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const first = doc.addPage([300, 200]);
  const second = doc.addPage([300, 200]);

  first.drawText('Hello world', { font, size: 14, x: 20, y: 150 });
  first.drawText('Second line', { font, size: 14, x: 20, y: 120 });
  second.drawText('Page two', { font, size: 14, x: 20, y: 150 });
  doc.addPage([300, 200]);

  return doc.save();
}

describe('extractPdfText', () => {
  it('writes page markers, skips empty pages without them and counts them', async () => {
    const file = { bytes: await samplePdf(), name: 'sample.pdf' };
    const marked = await extractPdfText(file, { pageMarkers: true, pages: '' });

    assert.equal(
      marked.text,
      '--- Page 1 ---\nHello world\nSecond line\n\n--- Page 2 ---\nPage two\n\n--- Page 3 ---\n',
    );

    assert.equal(marked.emptyPages, 1);
    assert.equal(marked.pageCount, 3);

    assert.deepEqual(marked.pages, [
      { page: 1, text: 'Hello world\nSecond line' },
      { page: 2, text: 'Page two' },
      { page: 3, text: '' },
    ]);

    const plain = await extractPdfText(file, { pageMarkers: false, pages: '' });

    assert.equal(plain.text, 'Hello world\nSecond line\n\nPage two\n');
  });

  it('extracts only the selected pages', async () => {
    const file = { bytes: await samplePdf(), name: 'sample.pdf' };
    const result = await extractPdfText(file, { pageMarkers: true, pages: '2' });

    assert.deepEqual(result.pages, [{ page: 2, text: 'Page two' }]);
    assert.equal(result.text, '--- Page 2 ---\nPage two\n');
    assert.equal(result.emptyPages, 0);
  });

  it('stops at the first page that crosses a custom text limit', async () => {
    const file = { bytes: await samplePdf(), name: 'sample.pdf' };
    const limited = (maxTextLength: number, pages: string): ReturnType<typeof extractPdfText> =>
      extractPdfText(file, { maxTextLength, pageMarkers: false, pages });

    assert.equal((await limited(43, '1')).text, 'Hello world\nSecond line\n');

    await assert.rejects(
      limited(42, '1'),
      (error: unknown) =>
        error instanceof FunctionError &&
        error.code === 'PDF_TEXT_LIMIT' &&
        error.message === 'The extracted text is longer than the 42 character limit.',
    );

    await assert.rejects(
      limited(43, ''),
      (error: unknown) => error instanceof FunctionError && error.code === 'PDF_TEXT_LIMIT',
    );
  });

  it('gives the same text when the same bytes run twice', async () => {
    const file = { bytes: await samplePdf(), name: 'sample.pdf' };
    const first = await extractPdfText(file, { pageMarkers: true, pages: '' });
    const second = await extractPdfText(file, { pageMarkers: true, pages: '' });

    assert.equal(second.text, first.text);
    assert.ok(file.bytes.byteLength > 0);
  });

  it('reports files that are not PDFs without the raw pdfjs message', async () => {
    const file = { bytes: new TextEncoder().encode('%PDF-1.7\nnot really'), name: 'x.pdf' };

    await assert.rejects(extractPdfText(file, { pageMarkers: true, pages: '' }), {
      message: 'This file could not be read as a PDF.',
    });
  });
});

describe('pdfjsError', () => {
  it('names password protection and hides other pdfjs messages', () => {
    assert.equal(
      pdfjsError({ message: 'No password given', name: 'PasswordException' }).message,
      'This PDF is password protected. Remove the password first.',
    );

    assert.equal(
      pdfjsError(new Error('Invalid PDF structure.')).message,
      'This file could not be read as a PDF.',
    );
  });
});

describe('selectTextPages', () => {
  it('limits the selection to 2,000 pages', () => {
    assert.equal(selectTextPages('', 2000).length, 2000);
    assert.deepEqual(selectTextPages('2-3', 2001), [2, 3]);
    assert.throws(() => selectTextPages('', 2001), /2,000 pages/);
  });
});

describe('pdf size limit', () => {
  it('rejects a file over 50 MiB in every PDF function', async () => {
    const file = { bytes: new Uint8Array(50 * 1024 * 1024 + 1), name: 'big.pdf' };
    const margins = { bottom: 0, left: 0, right: 0, top: 0 };
    const runs = [
      () => extractPdfText(file, { pageMarkers: true, pages: '' }),
      () => listPdfFormFields(file),
      () => fillPdfForm(file, {}, { flatten: false }),
      () => cropPdf(file, { margins, pages: '' }),
      () =>
        resizePdf(file, {
          height: 100,
          orientation: 'auto',
          pages: '',
          scaleContent: false,
          width: 100,
        }),
      () => inspectPdfSignatures(file),
    ];

    for (const run of runs) await assert.rejects(run(), /limited to 50 MiB/);
  });
});

describe('loadPdfjs', () => {
  it('retries after a failed load instead of keeping the failure', async () => {
    // A fresh module, since the loaded pdfjs is cached once any extraction has run.
    vi.resetModules();

    const { loadPdfjs } = await import('../src/pdf/text');
    const lib = {} as Awaited<ReturnType<typeof loadPdfjs>>;
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue(lib);

    await assert.rejects(loadPdfjs(load), /chunk failed/);

    assert.equal(await loadPdfjs(load), lib);
    assert.equal(await loadPdfjs(load), lib);
    assert.equal(load.mock.calls.length, 2);
  });
});

describe('page text trimming', () => {
  it('trims a line of 80,000 spaces in linear time', () => {
    const started = performance.now();
    const text = pageText([
      { str: `Hello${' '.repeat(80_000)}x`, hasEOL: true } as never,
      { str: 'next' } as never,
    ]);

    assert.equal(text, `Hello${' '.repeat(80_000)}x\nnext`);
    assert.ok(performance.now() - started < 1000);
  });
});
