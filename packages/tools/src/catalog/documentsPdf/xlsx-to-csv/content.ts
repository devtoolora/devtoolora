import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An .xlsx file is a ZIP archive of XML parts: a workbook that lists the sheets, one XML file per sheet, a table of shared strings and a style sheet. This tool opens that archive in your browser, follows the workbook to each worksheet and writes the cell values as CSV or JSON. Nothing is uploaded.\n\nOnly values are converted. A formula cell gives the result Excel stored when the file was saved, so a file written by a program that never calculated its formulas has empty cells there. The summary counts the formulas so you can spot that.',
      title: 'What the converter reads',
    },
    {
      content: [
        'A number prints exactly as stored, so 1.5 stays 1.5 and JSON gets a real number.',
        'A cell whose number format is a date or time becomes ISO text: 2025-10-28, 2025-10-28T12:00:00 or 18:00:00. Elapsed-time formats such as [h]:mm keep counting hours past 24, so 1.5 prints as 36:00:00. Both the 1900 and the 1904 date system are understood.',
        'TRUE and FALSE cells are TRUE and FALSE in CSV and true and false in JSON; error cells such as #N/A keep their text.',
        'Rich text is joined into plain text, and merged cells keep their value in the top-left cell only.',
      ],
      title: 'Numbers, dates and other cell types',
    },
  ],
  examples: [
    'Export the first sheet of a workbook as CSV with a comma separator.',
    'Switch Separator to Semicolon or Tab to match a European locale or TSV import.',
    'Choose JSON with Records to get one object per row, keyed by the header row.',
    'Choose JSON with Rows to get an array of arrays that keeps the sheet layout.',
    'Type Notes or 2 in Sheet to convert the second sheet instead of the first.',
    'Tick All sheets to get one JSON object keyed by sheet name, or one CSV file per sheet.',
  ],
  faq: [
    {
      answer:
        'The file holds only the value Excel calculated and stored on the last save. If the workbook was written by a script that never opened it in Excel, there is no stored value, the cell is empty and the summary still counts the formula.',
      question: 'Why is a formula cell empty?',
    },
    {
      answer:
        'The old binary .xls format and password-protected workbooks are not supported, and neither are OpenDocument .ods files. Open the file in Excel or LibreOffice and save it as .xlsx without a password.',
      question: 'Why does a legacy or protected file fail?',
    },
    {
      answer:
        'A blank header becomes Column N, counted from 1, and a repeated header gets _2, _3 and so on, so every key in a record is unique. Choose JSON rows if you need the header row untouched.',
      question: 'What happens to blank or duplicate headers in JSON records?',
    },
    {
      answer:
        'Dates are stored as serial numbers, and only the cell format tells Excel to show a date. The tool applies the same rule: a built-in or custom date and time format turns the serial into ISO text, and any other format leaves the number alone.',
      question: 'How does it decide that a number is a date?',
    },
    {
      answer:
        'The workbook can be up to 20 MiB. Output follows the CSV limits of 100,000 rows, 10,000 columns and 1,000,000 cells, and a sheet whose XML is too large to read stops with an error naming it; nothing is cut off silently.',
      question: 'How large can a workbook be?',
    },
  ],
  help: 'Choose an .xlsx or .xlsm file. The first sheet converts straight away.\n\nPick CSV or JSON. For CSV choose the separator, for JSON choose records or rows.\n\nType a sheet name or number to convert another sheet, or tick All sheets to convert them all.\n\nCopy the text or save the file. With All sheets, CSV gives one file per sheet and JSON gives a single file.',
  notes: [
    'Everything runs locally; the workbook never leaves your device.',
    'Hidden sheets are read like any other sheet. Chart sheets and dialog sheets have no cells and are skipped, and the summary names them.',
    'Formatting other than date detection is ignored, and so are comments, images, charts, macros (.xlsm values are read), pivot tables, hyperlinks and data validation.',
    'Rows are padded to the widest row, output starts at A1 and trailing empty rows are dropped.',
    'Seconds round to the nearest second, and the 1900 date system keeps Excel’s fake 1900-02-29 for serial 60.',
    'A date format on a value below 1 (below 0 in the 1904 system) keeps the plain number unless the format is time only.',
    'Text escapes such as _x000D_ are decoded, and _x005F_ stands for a literal underscore.',
  ],
};
