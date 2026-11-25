import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import {
  degrees,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFArray,
  PDFRef,
  PDFString,
  type PDFDict,
  type PDFPage,
} from 'pdf-lib';
import {
  compactPdf,
  deletePdfPages,
  editPdfMetadata,
  extractPdfPages,
  formatPageOrder,
  formatPageSelection,
  imageToPdf,
  inspectPdf,
  mergePdfs,
  parsePageSelection,
  removePdfMetadata,
  reorderPdf,
  rotatePdfPages,
  splitPdf,
  splitPdfGroups,
  stampPdf,
} from '@devtoolora/functions/pdf';

async function fixture(
  options: {
    pages?: Array<{ rotate?: number; size?: [number, number] }>;
    title?: string;
    xmp?: boolean;
  } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  pdf.setTitle(options.title ?? 'Quarterly report');
  pdf.setAuthor('Ada Lovelace');
  pdf.setProducer('Example Writer 3');

  for (const page of options.pages ?? [{}, {}, {}]) {
    const added = pdf.addPage(page.size ?? [595.28, 841.89]);

    if (page.rotate) added.setRotation(degrees(page.rotate));
  }

  if (options.xmp)
    pdf.catalog.set(
      PDFName.of('Metadata'),
      pdf.context.register(pdf.context.stream('<x:xmpmeta/>')),
    );

  return pdf.save();
}

const file = (bytes: Uint8Array, name = 'report.pdf') => ({ bytes, name });

function contentText(page: PDFPage): string {
  const contents = page.node.Contents();

  if (!contents) return '';

  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];

  return refs
    .map((ref) => {
      const stream = page.doc.context.lookup(ref as PDFRef) as PDFRawStream;
      const filter = stream.dict.get(PDFName.of('Filter'));

      return Buffer.from(filter ? inflateSync(stream.contents) : stream.contents).toString(
        'latin1',
      );
    })
    .join('\n');
}

describe('PDF page selections', () => {
  it('reads numbers, open ranges, keywords and ordered lists', () => {
    assert.deepEqual(parsePageSelection('1-3, 5, 8-', 10), [1, 2, 3, 5, 8, 9, 10]);
    assert.deepEqual(parsePageSelection('odd', 5), [1, 3, 5]);
    assert.deepEqual(parsePageSelection('even; last', 5), [2, 4, 5]);
    assert.deepEqual(parsePageSelection('-2', 5), [1, 2]);
    assert.deepEqual(parsePageSelection('1 – 3 5', 6), [1, 2, 3, 5]);
    assert.deepEqual(parsePageSelection('3, 1-2', 3, { ordered: true }), [3, 1, 2]);
    assert.deepEqual(parsePageSelection('last-1', 3, { ordered: true }), [3, 2, 1]);
    assert.deepEqual(parsePageSelection('2, 2', 3, { ordered: true }), [2, 2]);
    assert.deepEqual(parsePageSelection('1,3-4,3', 4), [1, 3, 4]);
    assert.equal(formatPageSelection([9, 1, 2, 3, 5, 8]), '1-3, 5, 8-9');
    assert.equal(formatPageOrder([3, 1, 2, 4, 6, 5]), '3, 1-2, 4, 6, 5');
    assert.deepEqual(splitPdfGroups('every', '2', 5), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(splitPdfGroups('ranges', '1-2; 5, 3-', 5), [[1, 2], [5], [3, 4, 5]]);
    assert.throws(() => splitPdfGroups('ranges', ' , ', 5), /one range per output file/);
    assert.throws(() => parsePageSelection('0', 4), /numbered from 1/);
    assert.throws(() => parsePageSelection('9', 4), /Page 9 does not exist; this PDF has 4 pages/);
    assert.throws(() => parsePageSelection('5-3', 6), /runs backwards; write 3-5/);
    assert.throws(() => parsePageSelection('first', 4), /"first" is not a page selection/);
    assert.throws(() => parsePageSelection(' ', 4), /Enter the pages/);
  });
});

describe('PDF documents', () => {
  it('inspects pages, sizes, rotation, version and metadata without loading encryption', async () => {
    const info = await inspectPdf(
      file(await fixture({ pages: [{}, { rotate: 90, size: [612, 792] }], xmp: true })),
    );

    assert.equal(info.pageCount, 2);

    assert.deepEqual(info.pageSizes, [
      'A4 portrait (210 × 297 mm) × 1',
      'Letter landscape (279 × 216 mm) × 1',
    ]);

    assert.deepEqual(info.rotatedPages, [2]);
    assert.equal(info.version, '1.7');
    assert.equal(info.encrypted, false);
    assert.equal(info.xmpMetadata, true);
    assert.ok(info.metadata);
    assert.equal(info.metadata.title, 'Quarterly report');
    assert.equal(info.metadata.author, 'Ada Lovelace');

    await assert.rejects(
      inspectPdf(file(new TextEncoder().encode('hello'), 'notes.txt')),
      /notes\.txt is not a PDF/,
    );
  });

  it('leaves no XMP packet in the saved bytes after Remove all or Edit', async () => {
    const pdf = await PDFDocument.create();

    pdf.addPage();
    const packet = '<x:xmpmeta><dc:title>XmpTitleSecret</dc:title></x:xmpmeta>';
    const catalogXmp = pdf.context.stream(packet, { Subtype: 'XML', Type: 'Metadata' });
    const orphanXmp = pdf.context.stream(`<old>${packet}</old>`, { Type: 'Metadata' });

    pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(catalogXmp));
    pdf.context.register(orphanXmp);
    const source = file(await pdf.save({ useObjectStreams: false }));
    const has = (bytes: Uint8Array) => Buffer.from(bytes).includes('XmpTitleSecret');

    assert.ok(has(source.bytes));

    const removed = await removePdfMetadata(source);
    const edited = await editPdfMetadata(source, { title: 'New' });

    assert.equal(has(removed.bytes), false);
    assert.equal(has(edited.bytes), false);
    assert.ok(removed.notes.some((note) => note.includes('XMP')));
    assert.equal((await inspectPdf(file(removed.bytes))).xmpMetadata, false);
  });

  it('reports a PDF header followed by garbage as unreadable, not as a raw TypeError', async () => {
    const garbage = new Uint8Array(508);

    garbage.set(Buffer.from('%PDF-1.7\n'));
    for (let index = 9; index < garbage.length; index += 1)
      garbage[index] = (index * 197 + 13) % 251;

    await assert.rejects(inspectPdf(file(garbage)), /report\.pdf could not be read as a PDF/);
    await assert.rejects(removePdfMetadata(file(garbage)), /could not be read as a PDF/);
    await assert.rejects(deletePdfPages(file(garbage), '1'), /could not be read as a PDF/);
  });

  it('marks metadata unavailable for an encrypted file instead of showing ciphertext', async () => {
    const pdf = await PDFDocument.create();

    pdf.addPage();
    pdf.context.trailerInfo.Encrypt = pdf.context.obj({ Filter: 'Standard', V: 2 });
    pdf.setTitle('ciphertext-looking title');

    // pdf-lib throws on a date it cannot parse, which is what a date encrypted in place looks like.
    (pdf as unknown as { getInfoDict(): PDFDict })
      .getInfoDict()
      .set(PDFName.of('CreationDate'), PDFString.of('not a date'));

    const info = await inspectPdf(file(await pdf.save()));

    assert.equal(info.encrypted, true);
    assert.equal(info.pageCount, 1);
    assert.equal(info.metadata, null);
  });

  it('gives a repeated split range its own file name, so the ZIP keeps both', async () => {
    const parts = await splitPdf(file(await fixture()), 'ranges', '1,1,2-3');

    assert.deepEqual(
      parts.map((part) => part.name),
      ['report-p1.pdf', 'report-p1-copy2.pdf', 'report-p2-3.pdf'],
    );
  });

  it('refuses encrypted files for edits but still reports them', async () => {
    const pdf = await PDFDocument.load(await fixture());

    pdf.context.trailerInfo.Encrypt = pdf.context.obj({ Filter: 'Standard', V: 2 });
    const encrypted = file(await pdf.save());

    assert.equal((await inspectPdf(encrypted)).encrypted, true);
    await assert.rejects(deletePdfPages(encrypted, '1'), /encrypted or password protected/);
  });

  it('merges, deletes, extracts and reorders while keeping the source information', async () => {
    const merged = await PDFDocument.load(
      await mergePdfs([
        file(await fixture({ title: 'First' })),
        file(await fixture({ pages: [{}], title: 'Second' })),
      ]),
      { updateMetadata: false },
    );

    assert.equal(merged.getPageCount(), 4);
    assert.equal(merged.getTitle(), 'First');
    assert.equal(merged.getProducer(), 'Example Writer 3');
    const source = file(
      await fixture({ pages: [{ size: [100, 100] }, { size: [200, 200] }, { size: [300, 300] }] }),
    );
    const widths = async (bytes: Uint8Array) =>
      (await PDFDocument.load(bytes)).getPages().map((page) => page.getWidth());
    const deleted = await deletePdfPages(source, '2');

    assert.deepEqual(await widths(deleted.bytes), [100, 300]);
    assert.equal((await PDFDocument.load(deleted.bytes)).getAuthor(), 'Ada Lovelace');
    assert.deepEqual(await widths((await extractPdfPages(source, '3, 1')).bytes), [100, 300]);
    const reordered = await reorderPdf(source, '3, 1');

    assert.deepEqual(await widths(reordered.bytes), [300, 100]);
    assert.deepEqual(reordered.omitted, [2]);
    await assert.rejects(deletePdfPages(source, 'all'), /delete every page/);
    assert.ok((await compactPdf(source)).length > 0);
  });

  it('splits by page, by N pages or by ranges and rotates selected pages', async () => {
    const source = file(await fixture({ pages: [{}, {}, {}, {}, {}] }), 'big report.pdf');

    assert.deepEqual(
      (await splitPdf(source, 'each')).map((part) => part.name),
      [
        'big report-p1.pdf',
        'big report-p2.pdf',
        'big report-p3.pdf',
        'big report-p4.pdf',
        'big report-p5.pdf',
      ],
    );

    assert.deepEqual(
      (await splitPdf(source, 'every', '2')).map((part) => part.name),
      ['big report-p1-2.pdf', 'big report-p3-4.pdf', 'big report-p5.pdf'],
    );

    const ranges = await splitPdf(source, 'ranges', '1-3, 4-');

    assert.deepEqual(
      await Promise.all(
        ranges.map(async (part) => (await PDFDocument.load(part.bytes)).getPageCount()),
      ),
      [3, 2],
    );

    await assert.rejects(splitPdf(source, 'every', '0'), /at least 1/);
    const rotated = await rotatePdfPages(source, 'even', 90);

    assert.deepEqual(
      (await PDFDocument.load(rotated.bytes)).getPages().map((page) => page.getRotation().angle),
      [0, 90, 0, 90, 0],
    );
  });
});

describe('PDF stamps', () => {
  it('numbers selected pages, keeps text upright on rotated pages and centers the watermark', async () => {
    const source = file(await fixture({ pages: [{}, { rotate: 90 }, {}] }));
    const result = await stampPdf(source, {
      footer: 'Strana {n} z {total} · {file}',
      pages: '2-',
      watermark: 'Důvěrné',
      watermarkAngle: 45,
    });

    assert.deepEqual(result.pages, [2, 3]);
    const pdf = await PDFDocument.load(result.bytes);

    assert.equal(pdf.getPageCount(), 3);
    assert.doesNotMatch(contentText(pdf.getPage(0)), /Tm/);
    assert.match(contentText(pdf.getPage(1)), /\n0\.0+\d* 1 -1 0\.0+\d* [\d.]+ [\d.]+ Tm/);

    assert.match(
      contentText(pdf.getPage(1)),
      /-0\.7071\d* 0\.7071\d* -0\.7071\d* -0\.7071\d* [\d.]+ [\d.]+ Tm/,
    );

    assert.match(
      contentText(pdf.getPage(2)),
      /0\.7071\d* 0\.7071\d* -0\.7071\d* 0\.7071\d* [\d.]+ [\d.]+ Tm/,
    );

    assert.equal(pdf.getTitle(), 'Quarterly report');
  });

  it('draws an image watermark upright in the center and refuses other image formats', async () => {
    const logo = {
      bytes: new Uint8Array(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAKAAAABACAMAAACqVYydAAABy1BMVEX///8dTtggUNjs8Pv///8/ad1VeuGRqOzG0vXg5/nx9Pz7/P7v8/zY4Piuv/FykeYuW9v+/v4+aN1fguP4+v1ihOOSquxqi+X5+v6pvPAkVNmdsu6/zfO1xfLk6vooV9mwwfEyXtvy9fwnVtk9Z90sWdpXe+IjUtnI1PV6luiqvfCpu/Di6PqJoupTeeFEbd5bfuKNpuvT3PfY4figtO5jheRhg+PN2PbI0/X09v0mVdlLct+es+4hUdhMc+BWe+F7mOh1k+dBat5vjua5yPOsvvDH0/W2xvLb4/iRqezS3Pehtu7Cz/QkU9n3+P1mh+T8/P42YtxafeL6+/7j6fqEn+n9/f41Ydy0xPK6yfN5luc4Y9zn7PqHoepykOaCnek6ZN1PdeDM1/abse3a4vhujebu8fyZr+0lVNnz9f1+muhNdOCFn+qVrOzh6PmftO43Ytw5ZNzBz/TP2fajt+/t8fu3xvI0YNz3+f0vXNuGoOqvwPG4x/ItW9qhte4iUtiLpOtCa95Hb99cf+OMpevU3ffO2Pa4yPIxXdspV9pgguNAad6xwfFjhORniOSTq+xri+WrvfDK1vXl6voeT9jw8/zZ4fh2lOcwXdvf6jrfAAAAAXRSTlMAQObYZgAAAu1JREFUaN7t2glTEzEUAOBGAlYFW7DKpUCLlqKIWqwKBQseVNBiESkKXqjgibd434oX3ufPNS/Z3W63u43MrMl23DfT3eQ18/LNdBMytB6PG7YGckA4W1fAKBvFIcoG8YiyNTyhbAtXKJvCA8qWcIWyITygbAdXKJtR9EDZCq5QNsIFukDZCHuAi0owjVJDvmyxd8nSZeUVy31+1mfDKqvUAStYAvt176oRsBG4Uqm5KidbXZGdraa2TkeoV4esFgRco9Rs0OUam3LnC+oIoWY2Zm2lGOC6gFo0rOVaItgaiFvZoHosBtiqFV2v5TawRNvG9tJNm7dEDcAOOqY5ZALcGlNim33A7VB4B1w6u5RUnE3c3aP0d3pzgDgByV5sAuz7mxkXBqyihXfRlbxbye2hub2GkYzQT15J6O4jDa8A4ADUHUT74XaApVJD0BnymwIPkld6GKFD5D5SLQB4GOqOona4ZcZoKkznOmIcyQjBKNuRjpJbU5nlIhm3C5ige+8EQsegcZzmTtApTloAfeRS0nIqQ26TAoC1UO00aZyBxlmaG6VTTFkAU9PwtJ6jD8a/B56/ANUuktYlWjcOycsFgWiGXKPl5OITAJyij14QmlegeZX/EaNraWaYTuUDtX3wuk3AG1D15hjELWjehq2v8CJBaJYBZ1A+sI8748KAdzLYEDGkbjN371kB6cLC6QkBwPtGH56FNNuoH1gBET3oPEQCgB15wJpHSPtT9/iJMmwyEswBjkMjLAAYx/nRC28oh4WGp4lnz1+8fKU/LECrKzI39zqrMlsksTd2ALuhZuCt2h2kKwZaBY5bwfxP3Wybwe9sAPbQE0JS67MN+j00G+edAPxAK33U+sP0iPyJdT7rns+RL9kjv0hgEgp11mUTXyHx7bvSSwz0t4XSP37O//qt04gEyg0X6AJlhwv8P4AOFhbJf/mdD3SssGi+q3OqsIi+L3am0Ok/WnD47z48ZiEbxeE5xuhxw9b4A7L3gFLJ6JqgAAAAAElFTkSuQmCC',
          'base64',
        ),
      ),
      name: 'logo.png',
    };
    const source = file(await fixture({ pages: [{}, { rotate: 90 }] }));
    const result = await stampPdf(source, {
      footer: '',
      watermarkImage: logo,
      watermarkImageWidth: 50,
    });
    const pdf = await PDFDocument.load(result.bytes);

    assert.match(
      contentText(pdf.getPage(0)),
      /\n1 0 0 1 148\.82 361\.41\d* cm\n1 0 0 1 0 0 cm\n297\.64 0 0 119\.05\d* 0 0 cm/,
    );

    assert.match(
      contentText(pdf.getPage(1)),
      /\n0\.0+\d* 1 -1 0\.0+\d* 0 0 cm\n420\.94\d* 0 0 168\.37\d* 0 0 cm/,
    );

    await assert.rejects(
      stampPdf(source, {
        watermarkImage: { bytes: new TextEncoder().encode('GIF89a'), name: 'logo.gif' },
      }),
      /logo\.gif is not a PNG or JPEG image/,
    );

    await assert.rejects(
      stampPdf(source, { footer: '', watermarkImage: logo, watermarkImageWidth: 120 }),
      /Image width must be from 5 to 100/,
    );
  });

  it('explains unsupported placeholders, characters and empty stamps', async () => {
    const source = file(await fixture());

    await assert.rejects(
      stampPdf(source, {}),
      /header, a footer or a watermark, or choose a watermark image/,
    );

    await assert.rejects(
      stampPdf(source, { header: 'Page {page}' }),
      /\{page\} is not a placeholder/,
    );

    await assert.rejects(stampPdf(source, { header: 'Ship it 🚀' }), /not in the bundled fonts/);
    await assert.rejects(stampPdf(source, { color: 'red', header: 'x' }), /hex color/);
    const long = await stampPdf(source, {
      header: 'A very long confidential header line '.repeat(4),
      size: 14,
    });

    assert.match(long.warnings[0]!, /reduced to [\d.]+ pt/);
  });
});

describe('PDF metadata', () => {
  it('edits fields, clears blanks on request and removes everything for privacy', async () => {
    const source = file(await fixture({ xmp: true }));
    const edited = await editPdfMetadata(source, { title: 'Final report' });

    assert.equal(edited.before.title, 'Quarterly report');
    assert.equal(edited.after.title, 'Final report');
    assert.equal(edited.after.author, 'Ada Lovelace');
    assert.match(edited.notes[0]!, /XMP/);
    const cleared = await editPdfMetadata(source, { subject: 'Finance' }, { clearBlank: true });

    assert.equal(cleared.after.author, '');
    assert.equal(cleared.after.title, '');
    assert.equal(cleared.after.subject, 'Finance');
    await assert.rejects(editPdfMetadata(source, {}), /Nothing to change/);
    const removed = await removePdfMetadata(source);

    assert.deepEqual(Object.values(removed.after).filter(Boolean), []);
    const reloaded = await PDFDocument.load(removed.bytes, { updateMetadata: false });

    assert.equal(reloaded.catalog.has(PDFName.of('Metadata')), false);
    assert.equal(reloaded.getProducer(), undefined);
  });
});

describe('PNG to PDF', () => {
  it('puts the image on a page of its size and rejects anything but a readable PNG', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const pdf = await PDFDocument.load(await imageToPdf(png));

    assert.deepEqual(pdf.getPage(0).getSize(), { height: 1, width: 1 });
    await assert.rejects(imageToPdf(new TextEncoder().encode('GIF89a')), /not a PNG/);
    await assert.rejects(imageToPdf(png.subarray(0, 20)), /could not be read/);
  });
});
