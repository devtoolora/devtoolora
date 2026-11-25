import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'PDF Pages edits the page list of PDF files on your device: merge several files, split one into many, reorder, rotate, delete or extract pages, see page counts and sizes, or re-save a file compactly. Nothing is uploaded.\n\nOn the web and in the desktop app the pages appear as thumbnails. Click thumbnails to choose pages, drag them to reorder, and the page fields fill in for you. You can also type selections such as 1-3, 5, 8-.\n\nEdited copies keep the title, author, subject, keywords and dates of the source file. Merged files take them from the first file.',
      title: 'What can PDF Pages do?',
    },
    {
      content: [
        'Combine a contract, its appendix and a signed cover page into one file for sending.',
        'Send only the pages someone needs, or remove blank, duplicate or confidential pages first.',
        'Fix scans that came out sideways or in the wrong order, then split a batch scan into separate documents.',
      ],
      title: 'When to use PDF Pages',
    },
    {
      content:
        'Pages are numbered from 1. Separate items with commas: 2, 4, 7.\n\nA range includes both ends: 2-5. Leave one end open for “from the start” or “to the end”: -3 or 8-. last means the final page, and odd, even and all do what they say.\n\nFor Reorder the order you type is the new order, pages may repeat and ranges may run backwards: last-1 reverses the file. Pages you leave out are dropped, and the summary lists them.',
      title: 'Writing page selections',
    },
  ],
  examples: [
    'Merge quarterly-report.pdf (4 pages) and appendix.pdf (2 pages) → merged.pdf with 6 pages, titled “Quarterly report”.',
    'Delete pages 2-3 from a 4-page file → quarterly-report-edited.pdf with pages 1 and 4.',
    'Extract “1, last” → a 2-page PDF with the cover and the final page.',
    'Reorder “4, 1-3” → page 4 first, then pages 1 to 3.',
    'Split every 2 pages → quarterly-report-p1-2.pdf and quarterly-report-p3-4.pdf in one ZIP.',
    'Rotate “even” by 90° right → pages 2 and 4 turn clockwise; the others are unchanged.',
    'Info → pages, page size (A4 portrait, 210 × 297 mm), PDF version, encryption, form fields and the title for every file; the title reads Unavailable (encrypted) for a protected file.',
  ],
  faq: [
    {
      answer:
        'No. Merge, split, extract, reorder and delete copy the original page objects into a new file, so images keep their resolution and compression. Nothing is rasterized or recompressed.',
      question: 'Does merging or splitting reduce PDF quality?',
    },
    {
      answer:
        'Not directly. Page count and details can inspect an encrypted file, but every editing operation refuses it. Open the file with its password in a PDF reader, save or print an unprotected copy and use that.',
      question: 'Can I merge or split a password-protected PDF?',
    },
    {
      answer:
        'Merge saves merged.pdf. The other operations add a suffix to the first file’s name, such as report-edited.pdf after Delete, report-extract.pdf, report-reordered.pdf, report-rotated.pdf or report-compact.pdf. Split downloads report-split.zip with files like report-p1-2.pdf.',
      question: 'What are the output files called?',
    },
    {
      answer:
        'Yes. Every page keeps its own size and orientation in the merged file, and Page count and details lists each size with its number of pages, such as A4 portrait (210 × 297 mm) × 3.',
      question: 'Can I merge PDFs with different page sizes?',
    },
    {
      answer:
        'The file must contain the %PDF- header within its first 1,024 bytes. Other formats renamed to .pdf, or web pages saved with a .pdf name, fail with a message that the file does not start with %PDF-.',
      question: 'Why does it say my file is not a PDF?',
    },
    {
      answer:
        'Yes. pdf-lib runs inside the app on your device, so merging, splitting and reordering work without a connection and the files are never uploaded.',
      question: 'Does PDF Pages work offline?',
    },
  ],
  help: 'Choose one or more PDF files. Merge uses them in the order shown; the other operations use the first file.\n\nPick an operation. For Delete, Extract, Rotate and Reorder, type the pages such as 1-3, 5, 8-, or on the web and desktop click and drag the page thumbnails.\n\nThe result updates as you change the selection and shows the page count and file size before and after.\n\nDownload the PDF, or the ZIP for Split. Info downloads a JSON report instead.',
  notes: [
    'Everything runs locally with pdf-lib; files never leave your device.',
    'Every editing operation refuses encrypted or password-protected PDFs; save an unprotected copy in a PDF reader first. Info still shows their pages and sizes, but not the title, because that field is encrypted.',
    'Bookmarks, form field behavior, tagged structure for screen readers and digital signatures are not carried into new files; links and annotations on copied pages are.',
    'Rotation changes how readers show the page (/Rotate), not the page content, so it is lossless.',
    'Compact re-saves the file with object streams. It does not recompress images, so scanned files rarely shrink much.',
    'Pages are copied, not re-rendered, so text stays selectable and vector graphics stay sharp.',
    'Each file can be up to 50 MiB; very large or many files can take a while on slower devices.',
  ],
};
