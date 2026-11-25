import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A PDF that was exported from a word processor, a browser or a report generator carries a text layer: the characters are stored with their positions, so a reader can select and search them. This tool opens the file with pdf.js in your browser, reads that text layer page by page and writes it out as plain text. Nothing is uploaded.\n\nText is taken in the order the page draws it, which is usually the reading order. A line break follows wherever pdf.js sees the end of a line. Trailing spaces are trimmed, runs of blank lines collapse to one, and each page is trimmed before the pages are joined with a blank line.',
      title: 'How the text is read',
    },
    {
      content: [
        'A scanned page is a picture of text, not text. It has no text layer, so it comes out empty, and the summary counts such pages. Reading a picture needs OCR, which this tool does not do.',
        'Multi-column layouts and tables come out in drawing order, so columns may follow each other instead of sitting side by side.',
        'Some PDFs embed fonts without a map from glyphs to characters. Their text may come out as unreadable symbols, the same as when you copy it in a PDF reader.',
        'CJK character maps and the standard font data of pdf.js are not bundled, so text that depends on them may be missing.',
      ],
      title: 'Scans, columns and missing text',
    },
  ],
  examples: [
    'Extract the text of a report to paste it into an email, a ticket or a chat.',
    'Turn off Page markers to get one continuous text without --- Page N --- lines.',
    'Enter 2-5 in Pages to extract only the chapter on pages 2 to 5.',
    'Enter last to get the closing page, such as a signature block or a summary.',
    'Save the JSON file to keep the text of each page as a separate entry for a script.',
    'Check the summary for pages without a text layer before you trust that the output is complete.',
  ],
  faq: [
    {
      answer:
        'The page is probably a scanned image. It has no text layer, so there is nothing to extract. The summary says how many pages have no text. Run the file through an OCR program first.',
      question: 'Why is a page empty?',
    },
    {
      answer:
        'A PDF with an open password cannot be read until the password is removed. Open it in a PDF reader, enter the password and save or print an unprotected copy. A PDF that only restricts printing or copying opens normally.',
      question: 'Can it read password-protected PDFs?',
    },
    {
      answer:
        'The text follows the order in which the page draws it. Most exported documents draw in reading order, but columns, sidebars and tables can be drawn in another order, and the tool does not reorder them.',
      question: 'Why are columns or table cells out of order?',
    },
    {
      answer:
        'The file can be up to 50 MiB. At most 2,000 pages can be selected at once, and the text is limited to 20,000,000 characters. A file over a limit stops with an error naming it; nothing is cut off silently.',
      question: 'How large can the PDF be?',
    },
  ],
  help: 'Choose a PDF file. The text is extracted straight away.\n\nLeave Pages blank for every page, or enter a selection such as 1-3, 5, 8-, last, odd or even.\n\nKeep Page markers on to start each page with --- Page N ---, or turn them off for one continuous text.\n\nCopy the text, or save it as a .txt file or as JSON with one entry per page.',
  notes: [
    'Everything runs locally with pdf.js; the PDF never leaves your device.',
    'Only the text layer is read. Scanned pages have none, and the summary counts them; OCR is not done.',
    'Without page markers, pages with no text are left out of the text, but they stay in the JSON file.',
    'CJK character maps and standard font data are not bundled, so some text in CJK or unembedded fonts may be missing.',
    'Text comes in drawing order with line breaks where pdf.js sees them; columns and tables are not rebuilt.',
    'Password-protected PDFs must be unlocked first; a PDF with only permission restrictions opens normally.',
  ],
};
