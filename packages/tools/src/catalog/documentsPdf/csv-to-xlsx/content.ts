import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An .xlsx file is a ZIP archive of XML parts: a workbook, one worksheet, a table of shared strings and a style sheet. This tool builds that archive in your browser from CSV or JSON text and hands it back as a download. Nothing is uploaded.\n\nThe workbook has a single sheet. Equal input always gives byte-identical output, so the file diffs and caches cleanly.',
      title: 'What the converter writes',
    },
    {
      content: [
        'Numbers: plain decimals such as 42, -0.5 or 1e3 with at most 15 significant digits. 007, +5, 1,000, 5% and 16-digit ids stay text.',
        'Booleans: true and false in any case become TRUE and FALSE cells.',
        'Dates: YYYY-MM-DD gets the format yyyy-mm-dd, and YYYY-MM-DDTHH:MM or with seconds gets yyyy-mm-dd hh:mm:ss. Dates before 1900-03-01 stay text.',
        'JSON numbers and booleans keep their type, null is an empty cell and nested values become JSON text.',
      ],
      title: 'Type detection',
    },
  ],
  examples: [
    'Paste CSV with a header row to get a workbook whose first row is bold and frozen.',
    'Untick Detect types to keep every CSV cell as text, for ids and postal codes.',
    'Choose Semicolon or Tab to match a European export or a TSV file.',
    'Switch Input to JSON and paste an array of objects; the keys become the header row.',
    'Paste an array of arrays to keep the exact layout of the rows.',
    'Name the sheet Orders to get Orders.xlsx with an Orders tab.',
  ],
  faq: [
    {
      answer:
        'Only values that are safe as numbers are converted: no leading zero, no plus sign, no thousands separator and at most 15 significant digits, the limit of an Excel number. Everything else stays text so identifiers never change.',
      question: 'Why did 007 or a long id stay text?',
    },
    {
      answer:
        'Dates are stored as serial numbers in the 1900 system and shown with a date format. Excel has no valid serials before 1900-03-01 in this scheme, so earlier dates stay text.',
      question: 'Why is a date before 1900 still text?',
    },
    {
      answer:
        'The header is the union of all keys in the order they first appear. A record without a key leaves that cell empty.',
      question: 'How does JSON with different keys per record work?',
    },
    {
      answer:
        'A sheet holds at most 1,048,576 rows, 16,384 columns and 32,767 characters per cell. Larger data stops with an error that names the cell; nothing is cut off silently.',
      question: 'What are the size limits?',
    },
    {
      answer:
        'Yes. Control characters XML cannot hold are written as _xHHHH_ escapes, which Excel and the XLSX to CSV tool turn back into the original characters.',
      question: 'Can cells hold unusual characters?',
    },
  ],
  help: 'Paste CSV or JSON, or switch Input to match what you paste. The workbook is built straight away.\n\nFor CSV choose the separator. For JSON use an array of objects or an array of arrays.\n\nName the sheet, and decide whether to detect numbers, booleans and dates and whether the first row is a bold, frozen header. Codes such as 2E10 read as numbers, so turn Detect types off to keep them.\n\nSave the .xlsx file. The text shows how many rows, columns and cells of each type were written.',
  notes: [
    'Everything runs locally; the data never leaves your device.',
    'The workbook has one sheet, with no formulas, column widths or other formatting beyond the header row and date formats.',
    'The sheet name is 1 to 31 characters, without [ ] : * ? / \\ and without a leading or trailing apostrophe.',
    'Type detection applies to CSV cells and to JSON strings; JSON numbers and booleans always keep their type.',
    'Codes like 2E10 or 1e5 are numbers in scientific notation; turn Detect types off when they are identifiers.',
    'Leading and trailing spaces in text cells are preserved.',
    'Blank cells are omitted from the file, so they stay empty; the columns count is the length of the widest row.',
    'Any other JSON shape, such as a single object or an array of numbers, is an error.',
  ],
};
