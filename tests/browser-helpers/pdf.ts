import { PDFDocument, StandardFonts } from 'pdf-lib';

export async function threePagePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const label of ['A', 'B', 'C'])
    pdf.addPage([300, 300]).drawText(label, { font, size: 96, x: 110, y: 110 });

  return Buffer.from(await pdf.save());
}
