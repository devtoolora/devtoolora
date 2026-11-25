import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'List header names or 1-based column numbers separated by commas, such as name, 1. The columns appear in the order you list them, and a column listed twice is repeated. Names are matched exactly, including case. If a header name appears more than once, the name selects its first column; use the column number for the others. A token made only of digits is always a number, so a header named 2024 can be reached only by its position. Empty entries are ignored, and an empty list keeps every column.',
      title: 'How are columns selected?',
    },
    {
      content:
        'Steps run in a fixed order: select the columns, then rename, then transpose. Rename takes old=new pairs separated by commas, and old is a header name of one of the selected columns; every column with that name is renamed, and all pairs see the names before renaming, so a=b,b=a swaps two headers. If the same old name is listed twice, as in a=x,a=y, the last pair wins. Transpose turns the rows into columns, so the header row becomes the first column.',
      title: 'In what order are the steps applied?',
    },
  ],
  examples: [
    'id,name,age with Columns name, 1 → name,id.',
    'Rename name=full_name → the header name becomes full_name.',
    'Columns 2,2 → the second column twice.',
    'id,name / 1,Ada with Transpose → id,1 / name,Ada.',
  ],
  faq: [
    {
      answer:
        'An unknown header name is an error that names it, and so is a column number the CSV does not have. The message says how many columns there are.',
      question: 'What happens with a column that does not exist?',
    },
    {
      answer:
        'A row with fewer fields than the header gets empty cells in the selected columns. Fields beyond the header width are dropped, because only header columns can be selected.',
      question: 'How are ragged rows handled?',
    },
    {
      answer:
        'Yes. The separator is detected from the first 20 records, as in CSV Delimiter Converter, and the output uses the same one. Use that tool to change it.',
      question: 'Is the separator kept?',
    },
    {
      answer:
        'The output must stay within the CSV limits, so a transposed table can have at most 10,000 rows in the input, which become its 10,000 columns. A larger input is an error.',
      question: 'Why can transposing fail?',
    },
    {
      answer:
        'No. This tool reshapes columns only; cells starting with =, +, - or @ are written unchanged.',
      question: 'Are formula-like cells escaped?',
    },
  ],
  help: 'Paste CSV or TSV text, or pick a sample.\n\nList the columns to keep by header name or number, in the order you want.\n\nOptionally add old=new pairs to rename headers, and turn on Transpose to swap rows and columns.\n\nCopy the result or save it as a .csv or .tsv file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 characters, 100,000 data rows, 10,000 columns and 1,000,000 cells including the header, for both input and output; transposing needs at most 10,000 rows.',
    'Steps run in order: select, then rename, then transpose.',
    'A repeated header name selects its first column; use the column number for the others. If rename lists the same old name twice, the last pair wins.',
    'A token made only of digits is always a 1-based position, never a header name. Header names are matched exactly, including case.',
    'The input separator is detected and kept. Output records always end with LF (\\n).',
    'Formula-like cells are not escaped: the tool reshapes and does not sanitize.',
  ],
};
