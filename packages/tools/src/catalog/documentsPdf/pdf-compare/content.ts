import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'The tool reads the text layer of both PDFs with pdf.js in your browser, joins the selected pages of each file into one text and compares the two texts line by line. Every page ends with a line break, so a last line that is the same in both files counts as unchanged even when one file has more pages. Nothing is uploaded.',
      title: 'How two PDFs are compared',
    },
    {
      content: [
        'Rows are unchanged, changed, added or removed, and a changed row marks the part of the line that differs. The summary counts changed, added and removed rows and the lines that match.',
        'The report lists, for each file, the line where every selected page starts, so a row can be traced back to its page.',
        'Only text is compared. Layout, fonts, images and annotations are ignored, and a scanned page has no text layer, so the tool stops and says so instead of reporting an empty result.',
        'Each file may have at most 100,000 characters and 10,000 lines of selected text, so choose fewer pages for long documents.',
      ],
      title: 'Rows, pages and limits',
    },
  ],
  examples: [
    'Compare two versions of a contract to see which sentences changed.',
    'Check that a regenerated report has the same text as the last release.',
    'Enter 2-3 in Pages to compare only the same chapter in both files.',
    'Turn on Ignore letter case to skip changes that only differ in capitals.',
    'Switch to Unified view to read removed and added lines in one column.',
    'Save the JSON report to keep the rows and the page start lines.',
  ],
  faq: [
    {
      answer:
        'No. Only the text layer is compared, so a moved image, a new font or a different layout shows no difference as long as the text and its order stay the same.',
      question: 'Does it compare the look of the pages?',
    },
    {
      answer:
        'The page selection applies to both files. Leave Pages blank to compare every page, or enter ranges such as 1-3, 5, last, odd or even.',
      question: 'Which pages are compared?',
    },
    {
      answer:
        'A scanned PDF holds pictures of text, not text. The tool names the file and says it has no text layer, because reading a picture needs OCR, which it does not do.',
      question: 'Why does it say a file has no text layer?',
    },
    {
      answer:
        'Text moves between lines when a PDF is laid out again, for example after a font or margin change. The comparison follows lines, so reflowed text shows as changed rows.',
      question: 'Why do unchanged paragraphs show as changed?',
    },
    {
      answer:
        'It is on by default and treats runs of spaces and tabs as equal, which hides extraction differences. Turn it off to see spacing changes that survive extraction; pdf.js already collapses a run of spaces inside a line, so a b  c and a  b c still match.',
      question: 'What does Ignore spaces and tabs do?',
    },
  ],
  help: 'Choose the Before PDF and the After PDF. The tool extracts the text of both and lists the lines that were changed, added or removed.\n\nLeave Pages blank to compare all pages, or enter ranges such as 1-3, 5, 8-, last, odd or even. The same selection applies to both files.\n\nChoose Side by side or Unified view to read the rows, or the JSON or readable report to save them. Ignore options only affect matching, not the text you see.\n\nThe tool compares the text layer only. It does not compare layout or images, and it does not read scanned pages.',
  notes: [
    'Everything runs locally with pdf.js; the PDFs never leave your device.',
    'The files are read one after the other, so memory use stays near the larger file.',
    'Each PDF may be up to 50 MiB, with at most 2,000 selected pages, 100,000 characters and 10,000 lines of text.',
    'Text comes out in the order the page draws it, so multi-column layouts follow drawing order.',
    'Ignore spaces and tabs and Ignore letter case change matching only; the rows show the text as pdf.js extracted it, with runs of spaces inside a line collapsed.',
    'A password-protected PDF cannot be read; remove the password first.',
    'Errors name the file they come from, using its file name.',
  ],
};
