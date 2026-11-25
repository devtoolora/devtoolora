import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { dataUriFromBytes } from '@devtoolora/functions/binary';
import type { ToolResult } from '@devtoolora/core';
import { pdfPagesTool } from '../src/catalog/documentsPdf';

/** Pages are 200, 210, 220 … points wide, so a page's width identifies it. */
async function pdfBytes(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (let index = 0; index < pages; index += 1) pdf.addPage([200 + index * 10, 300]);

  return pdf.save();
}

async function run(fields: Record<string, string>, files = [3]): Promise<ToolResult> {
  const list = await Promise.all(
    files.map(async (pages, index) => ({
      data: dataUriFromBytes(await pdfBytes(pages), 'application/pdf'),
      name: `file${index + 1}.pdf`,
    })),
  );

  return pdfPagesTool.run({ fields: { pdfs: JSON.stringify(list), ...fields }, text: '' });
}

async function pageWidths(result: ToolResult): Promise<number[]> {
  const pdf = await PDFDocument.load(Buffer.from(result.artifact!.base64, 'base64'));

  return pdf.getPages().map((page) => page.getWidth());
}

describe('pdf-toolkit operations', () => {
  it('details reports one object per file with a summary of the page total', async () => {
    const single = await run({ mode: 'info' });

    assert.equal(single.artifact?.fileName, 'pdf-info.json');
    assert.equal(single.language, 'json');
    assert.equal(single.summary, '1 file · 3 pages in total.');
    assert.equal(JSON.parse(single.text ?? '').pageCount, 3);
    assert.equal(single.jsonTable?.rows[0]?.[0], 'file1.pdf');

    const several = await run({ mode: 'info' }, [2, 3]);

    assert.equal(several.summary, '2 files · 5 pages in total.');

    assert.deepEqual(
      JSON.parse(several.text ?? '').map((report: { pageCount: number }) => report.pageCount),
      [2, 3],
    );
  });

  it('merge keeps file order and needs two files', async () => {
    const merged = await run({ mode: 'merge' }, [2, 3]);

    assert.equal(merged.artifact?.fileName, 'merged.pdf');
    assert.match(merged.summary ?? '', /^Merged 2 files in the order shown · .* → .*\.$/);
    assert.deepEqual(await pageWidths(merged), [200, 210, 200, 210, 220]);

    await assert.rejects(
      run({ mode: 'merge' }),
      /Add at least two PDF files to merge, in the order you want them\./,
    );
  });

  it('split writes a ZIP named after the first file for each, every N and custom ranges', async () => {
    const each = await run({ mode: 'split' });

    assert.equal(each.artifact?.fileName, 'file1-split.zip');
    assert.equal(each.summary, 'Split 3 pages into 3 files · ZIP download.');

    assert.deepEqual(
      (each.text ?? '').split('\n').map((line) => line.split(' · ')[0]),
      ['file1-p1.pdf', 'file1-p2.pdf', 'file1-p3.pdf'],
    );

    const every = await run({ mode: 'split', splitEvery: '2', splitMode: 'every' });

    assert.equal(every.summary, 'Split 3 pages into 2 files · ZIP download.');

    assert.deepEqual(
      Object.keys(unzipSync(new Uint8Array(Buffer.from(every.artifact!.base64, 'base64')))),
      ['file1-p1-2.pdf', 'file1-p3.pdf'],
    );

    const ranges = await run({ mode: 'split', splitMode: 'ranges', splitRanges: '1,2-3' });

    assert.deepEqual(
      (ranges.text ?? '').split('\n').map((line) => line.split(' · ')[0]),
      ['file1-p1.pdf', 'file1-p2-3.pdf'],
    );

    await assert.rejects(
      run({ mode: 'split', splitMode: 'x' }),
      /Choose Each page, Every N pages or Custom ranges\./,
    );
  });

  it('reorder, rotate, delete and extract name the output and describe the pages', async () => {
    const reordered = await run({ mode: 'reorder', order: '3,1' });

    assert.equal(reordered.artifact?.fileName, 'file1-reordered.pdf');
    assert.match(reordered.summary ?? '', /^New order 3, 1; dropped pages 2 · /);
    assert.deepEqual(await pageWidths(reordered), [220, 200]);

    const rotated = await run({ angle: '270', mode: 'rotate', rotatePages: '2' });

    assert.equal(rotated.artifact?.fileName, 'file1-rotated.pdf');
    assert.match(rotated.summary ?? '', /^Rotated page 2 of 3 90° left · /);
    assert.match((await run({ mode: 'rotate' })).summary ?? '', /^Rotated all 3 pages 90° right/);

    await assert.rejects(
      run({ angle: '45', mode: 'rotate' }),
      /Rotate by 90° right, 180° or 90° left\./,
    );

    const deleted = await run({ mode: 'delete', pages: '2' });

    assert.equal(deleted.artifact?.fileName, 'file1-edited.pdf');
    assert.match(deleted.summary ?? '', /^Deleted page 2 of 3 · /);
    assert.deepEqual(await pageWidths(deleted), [200, 220]);

    const extracted = await run({ mode: 'extract', pages: '2-' });

    assert.equal(extracted.artifact?.fileName, 'file1-extract.pdf');
    assert.match(extracted.summary ?? '', /^Extracted pages 2-3 of 3 · /);
    assert.deepEqual(await pageWidths(extracted), [210, 220]);
  });

  it('optimize re-saves and an unknown operation lists the choices', async () => {
    const compact = await run({ mode: 'optimize' });

    assert.equal(compact.artifact?.fileName, 'file1-compact.pdf');

    assert.match(
      compact.summary ?? '',
      /^Re-saved with object streams; images are not recompressed · /,
    );

    await assert.rejects(
      run({ mode: 'zip' }),
      /Choose an operation: merge, split, reorder, rotate, delete, extract, details or re-save\./,
    );
  });
});
