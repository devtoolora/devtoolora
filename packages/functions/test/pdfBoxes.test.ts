import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, degrees } from 'pdf-lib';
import { cropPdf, resizePdf } from '../src/pdf';

const mm = (value: number) => (value * 72) / 25.4;
const none = { bottom: 0, left: 0, right: 0, top: 0 };

async function build(
  sizes: Array<[number, number]>,
  edit: (doc: PDFDocument) => void = () => undefined,
): Promise<{ bytes: Uint8Array; name: string }> {
  const doc = await PDFDocument.create();

  for (const size of sizes) doc.addPage(size).drawText('Hello', { x: 20, y: 20 });

  edit(doc);

  return { bytes: await doc.save(), name: 'test.pdf' };
}

async function pagesOf(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPages();
}

function box(rectangle: { height: number; width: number; x: number; y: number }): number[] {
  const { height, width, x, y } = rectangle;

  return [x, y, x + width, y + height].map((value) => Math.round(value * 100) / 100);
}

async function firstOperators(bytes: Uint8Array): Promise<string> {
  const [page] = await pagesOf(bytes);
  const contents = page?.node.Contents();
  const first = contents instanceof PDFArray ? contents.lookup(0) : undefined;

  assert.ok(first instanceof PDFRawStream);

  return new TextDecoder().decode(first.contents);
}

describe('pdf crop', () => {
  it('insets an A4 page by 10 mm and keeps the MediaBox', async () => {
    const file = await build([[595.28, 841.89]]);
    const margin = mm(10);
    const out = await cropPdf(file, {
      margins: { bottom: margin, left: margin, right: margin, top: margin },
      pages: '',
    });
    const [page] = await pagesOf(out.bytes);

    assert.deepEqual(box(page!.getCropBox()), [28.35, 28.35, 566.93, 813.54]);
    assert.deepEqual(box(page!.getMediaBox()), [0, 0, 595.28, 841.89]);
    assert.equal(out.pages[0]?.before.width, 595.28);
    assert.equal(Math.round((out.pages[0]?.after.width ?? 0) * 100) / 100, 538.59);
  });

  it('applies margins to the displayed page for every rotation', async () => {
    const expected: Record<number, number[]> = {
      0: [0, 0, 300, 380],
      90: [20, 0, 300, 400],
      180: [0, 20, 300, 400],
      270: [0, 0, 280, 400],
      [-90]: [0, 0, 280, 400],
      450: [20, 0, 300, 400],
    };

    for (const [angle, rectangle] of Object.entries(expected)) {
      const file = await build([[300, 400]], (doc) =>
        doc.getPage(0).setRotation(degrees(Number(angle))),
      );
      const out = await cropPdf(file, { margins: { ...none, top: 20 }, pages: '' });
      const [page] = await pagesOf(out.bytes);

      assert.deepEqual(box(page!.getCropBox()), rectangle, `rotate ${angle}`);
    }
  });

  it('crops from the existing CropBox on a page whose MediaBox does not start at 0,0', async () => {
    const file = await build([[400, 500]], (doc) => {
      const page = doc.getPage(0);

      page.setMediaBox(100, 100, 400, 500);
      page.setCropBox(150, 120, 300, 400);
    });
    const out = await cropPdf(file, {
      margins: { bottom: 10, left: 5, right: 15, top: 20 },
      pages: '',
    });
    const [page] = await pagesOf(out.bytes);

    assert.deepEqual(box(page!.getCropBox()), [155, 130, 435, 500]);
    assert.deepEqual(box(page!.getMediaBox()), [100, 100, 500, 600]);
  });

  it('names the page when the result would be under 1 pt', async () => {
    const file = await build([[300, 400]]);

    await assert.rejects(
      cropPdf(file, { margins: { ...none, left: 150, right: 150 }, pages: '' }),
      /Page 1 .*1 pt/,
    );
  });

  it('crops only the selected pages', async () => {
    const file = await build([
      [300, 400],
      [300, 400],
    ]);
    const out = await cropPdf(file, { margins: { ...none, top: 50 }, pages: '2' });
    const pages = await pagesOf(out.bytes);

    assert.deepEqual(
      out.pages.map(({ page }) => page),
      [2],
    );

    assert.deepEqual(box(pages[0]!.getCropBox()), [0, 0, 300, 400]);
    assert.deepEqual(box(pages[1]!.getCropBox()), [0, 0, 300, 350]);
  });
});

describe('pdf resize', () => {
  const a4 = {
    height: 841.89,
    orientation: 'portrait' as const,
    pages: '',
    scaleContent: true,
    width: 595.28,
  };

  it('scales a Letter page onto A4 and centers it', async () => {
    const file = await build([[612, 792]]);
    const out = await resizePdf(file, a4);
    const [page] = await pagesOf(out.bytes);
    const scale = Math.min(595.28 / 612, 841.89 / 792);
    const operators = await firstOperators(out.bytes);
    const [a, , e, f] = operators
      .match(/([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+) cm/)!
      .slice(1)
      .map(Number) as [number, number, number, number, number, number];

    assert.deepEqual(box(page!.getMediaBox()), [0, 0, 595.28, 841.89]);
    assert.deepEqual(box(page!.getCropBox()), [0, 0, 595.28, 841.89]);
    assert.equal(Math.round(a! * 1e4) / 1e4, 0.9727);
    assert.ok(Math.abs(a! - scale) < 1e-5);
    assert.ok(Math.abs(e! - (595.28 - 612 * scale) / 2) < 1e-3);
    assert.ok(Math.abs(f! - (841.89 - 792 * scale) / 2) < 1e-3);
  });

  it('keeps the content size without scaleContent', async () => {
    const out = await resizePdf(await build([[612, 792]]), { ...a4, scaleContent: false });
    const operators = await firstOperators(out.bytes);

    assert.match(operators, /(^|\s)1 0 0 1 -8\.36 24\.945 cm/);
  });

  it('follows the displayed orientation with auto', async () => {
    const landscape = await build([[800, 500]]);
    const rotated = await build([[500, 800]], (doc) => doc.getPage(0).setRotation(degrees(90)));
    const out = await resizePdf(landscape, { ...a4, orientation: 'auto' });
    const turned = await resizePdf(rotated, { ...a4, orientation: 'auto' });

    assert.deepEqual(out.pages[0]?.after, { height: 595.28, width: 841.89 });
    assert.deepEqual(turned.pages[0]?.after, { height: 595.28, width: 841.89 });
    assert.deepEqual(box((await pagesOf(turned.bytes))[0]!.getMediaBox()), [0, 0, 595.28, 841.89]);
  });

  it('uses inherited MediaBox and Rotate and moves annotations with the content', async () => {
    const file = await build([[200, 100]], (doc) => {
      const page = doc.getPage(0);
      const parent = page.node.Parent();
      const link = doc.context.obj({ Rect: [10, 10, 60, 40], Subtype: 'Link', Type: 'Annot' });
      const ink = doc.context.obj({
        InkList: [[10, 10, 20, 30]],
        Rect: [10, 10, 20, 30],
        Subtype: 'Ink',
        Type: 'Annot',
      });

      page.node.delete(PDFName.of('MediaBox'));
      parent?.set(PDFName.of('MediaBox'), doc.context.obj([0, 0, 200, 100]));
      parent?.set(PDFName.of('Rotate'), doc.context.obj(180));

      page.node.set(
        PDFName.of('Annots'),
        doc.context.obj([doc.context.register(link), doc.context.register(ink)]),
      );
    });
    const out = await resizePdf(file, { ...a4, height: 200, orientation: 'auto', width: 400 });
    const [page] = await pagesOf(out.bytes);
    const rect = (page!.node.Annots()?.lookup(0) as import('pdf-lib').PDFDict).lookup(
      PDFName.of('Rect'),
      PDFArray,
    );

    const ink = (page!.node.Annots()?.lookup(1) as import('pdf-lib').PDFDict).lookup(
      PDFName.of('InkList'),
      PDFArray,
    );
    const stroke = ink
      .lookup(0, PDFArray)
      .asArray()
      .map((value) => Number(value.toString()));

    assert.deepEqual(stroke, [20, 20, 40, 60]);
    assert.deepEqual(out.pages[0]?.after, { height: 200, width: 400 });
    assert.deepEqual(box(page!.getMediaBox()), [0, 0, 400, 200]);

    assert.deepEqual(
      rect.asArray().map((value) => Number(value.toString())),
      [20, 20, 120, 80],
    );
  });

  it('gives each page its own Contents array when pages share one', async () => {
    const shared = await build(
      [
        [200, 100],
        [200, 100],
      ],
      (doc) => {
        const ref = doc.context.register(
          doc.context.obj([doc.context.register(doc.context.stream('0 0 m'))]),
        );

        for (const page of doc.getPages()) page.node.set(PDFName.of('Contents'), ref);
      },
    );

    const wrapped = async (bytes: Uint8Array, index: number) => {
      const contents = (await pagesOf(bytes))[index]?.node.Contents() as PDFArray;

      return contents
        .asArray()
        .map((_, at) => contents.lookup(at))
        .filter((entry): entry is PDFRawStream => entry instanceof PDFRawStream)
        .map((entry) => new TextDecoder().decode(entry.contents))
        .join('\n');
    };

    const one = await resizePdf(shared, { ...a4, pages: '1' });
    const both = await resizePdf(shared, a4);

    assert.equal((await wrapped(one.bytes, 0)).match(/ cm /g)?.length, 1);
    assert.doesNotMatch(await wrapped(one.bytes, 1), / cm /);
    assert.equal((await wrapped(both.bytes, 0)).match(/ cm /g)?.length, 1);
    assert.equal((await wrapped(both.bytes, 1)).match(/ cm /g)?.length, 1);
  });

  it('clips a CropBox larger than the MediaBox to the MediaBox', async () => {
    const file = await build([[200, 100]], (doc) => doc.getPage(0).setCropBox(-50, -50, 400, 300));
    const out = await resizePdf(file, { ...a4, height: 100, orientation: 'auto', width: 200 });
    const cropped = await cropPdf(file, { margins: { ...none, left: 10 }, pages: '' });

    assert.deepEqual(out.pages[0]?.before, { height: 100, width: 200 });
    assert.deepEqual(box((await pagesOf(cropped.bytes))[0]!.getCropBox()), [10, 0, 200, 100]);
  });

  it('translates InkList points together with Rect when the offsets are not zero', async () => {
    const file = await build([[612, 792]], (doc) => {
      const ink = doc.context.obj({
        InkList: [[100, 100, 200, 200]],
        Rect: [100, 100, 200, 200],
        Subtype: 'Ink',
        Type: 'Annot',
      });

      doc.getPage(0).node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(ink)]));
    });
    const out = await resizePdf(file, a4);
    const [page] = await pagesOf(out.bytes);
    const annot = page!.node.Annots()?.lookup(0) as import('pdf-lib').PDFDict;
    const numbers = (array: PDFArray) => array.asArray().map((value) => Number(value.toString()));
    const rect = numbers(annot.lookup(PDFName.of('Rect'), PDFArray));
    const stroke = numbers(annot.lookup(PDFName.of('InkList'), PDFArray).lookup(0, PDFArray));

    assert.ok(Math.abs((rect[1] ?? 0) - 100) > 20);
    stroke.forEach((value, index) => assert.ok(Math.abs(value - (rect[index] ?? 0)) < 0.01));
  });

  it('rejects impossible target sizes', async () => {
    await assert.rejects(resizePdf(await build([[100, 100]]), { ...a4, width: 0 }), /between/);
  });
});
