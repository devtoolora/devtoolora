import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A table has a header row and data rows. Markdown (GitHub flavor) writes it with pipes and a rule row under the header: :--- aligns left, :---: centers and ---: aligns right. HTML uses table, thead, tbody, tr, th and td. The two text styles draw the grid with + - | or with Unicode box characters.\n\nThis tool reads CSV or JSON and writes any of the four. Columns are padded to the widest cell so the source stays readable.',
      title: 'What does the Table Generator write?',
    },
    {
      content:
        'Auto treats input starting with [ or { as JSON and everything else as CSV. In CSV the first record is the header unless you turn that off; then the columns are named Column 1, Column 2 and so on. Short rows are padded with empty cells.\n\nJSON is an array of objects, whose keys in first-seen order become the columns, or an array of arrays, whose first array is the header. Strings are written as they decode; numbers, null, booleans, arrays and objects are written as compact JSON, keeping number spelling such as 1.50.',
      title: 'How is the input read?',
    },
  ],
  examples: [
    'name,age and Ada,36 → a two-column Markdown table with a :--- rule row.',
    '[{"a":1},{"b":2}] → columns a and b, with an empty cell where a key is missing.',
    'A cell x|y in Markdown → x&#124;y, so the pipe does not split the column.',
    'A cell <b> in HTML → &lt;b&gt;.',
    'A cell with a line break → x<br>y in Markdown and HTML, and x y in the text tables.',
  ],
  faq: [
    {
      answer:
        'Text tables pad by code points, not by display width. Wide CJK and emoji characters take two columns in most fonts, so such rows can look misaligned in a plain-text view, although the text is correct.',
      question: 'Why do wide characters look misaligned in the text tables?',
    },
    {
      answer:
        'Markdown cells escape characters that would change the formatting, such as | * _ ` [ ] < > & and braces, as numeric entities like &#124;. GitHub shows them as the original characters, but the raw text is less readable.',
      question: 'Why does my Markdown output contain codes like &#124;?',
    },
    {
      answer:
        'Yes. The alignment applies to every column at once: left, center or right. In Markdown it sets the colon in the rule row, in HTML a text-align style on each cell, and in text tables the padding.',
      question: 'Can each column have its own alignment?',
    },
    {
      answer:
        'A row of the wrong kind is reported with its number, for example Row 2 must be an object, not array. Objects and arrays cannot be mixed in one table. A JSON object at the top level is rejected too; wrap it in an array.',
      question: 'What happens with mixed or invalid JSON rows?',
    },
    {
      answer:
        'Everything runs in your browser, and nothing is uploaded. The result is limited in size, so a huge CSV is rejected with a message naming the limit instead of freezing the page.',
      question: 'Is my data sent anywhere?',
    },
  ],
  help: 'Paste CSV or JSON as the main input.\n\nChoose the input type, or keep Auto, and the output: Markdown, HTML, ASCII or Unicode.\n\nPick one alignment for all columns. For CSV, say whether the first row is the header.\n\nRun the tool, then copy the result or save it as table.md, table.html or table.txt.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 characters of input, 100,000 rows, 1,000 columns, 1,000,000 cells and 20,000,000 characters of output.',
    'Text table widths count code points, so wide CJK and emoji characters misalign.',
    'The delimiter is a comma; use CSV Delimiter Converter first for semicolon or tab files. There are no spreadsheet formulas or Markdown to HTML table import.',
    'A duplicate JSON object key keeps its last value, as JSON.parse does, and the summary names the key and line.',
  ],
};
