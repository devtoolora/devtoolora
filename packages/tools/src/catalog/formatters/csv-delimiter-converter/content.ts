import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'With Detect, the first 20 records are scanned outside quoted fields for comma, semicolon, tab and pipe. The separator that appears the same non-zero number of times on the most records wins. A tie, or input with no separator at all, such as a single column, is read as comma-separated. Choose the input separator yourself when the guess is wrong.',
      title: 'How is the input separator detected?',
    },
    {
      content:
        'Each record is written with the output separator and ends with a line feed. A field is quoted only when it holds the output separator, a double quote, a line break, or leading or trailing spaces; double quotes inside it are doubled. Quote every field wraps all fields instead. A record that is a single empty field is written as "" so it is not read back as a blank line.',
      title: 'How is the output written?',
    },
  ],
  examples: [
    'a;b → a<TAB>b.',
    '"x;y";2 from semicolon to tab → x;y<TAB>2.',
    'a<TAB>"b,c" from tab to comma → a,"b,c".',
    'a,b with Quote every field → "a","b".',
  ],
  faq: [
    {
      answer:
        'No. Rows with fewer or more fields than the first one are written as they are; nothing is padded or cut.',
      question: 'Are ragged rows an error?',
    },
    {
      answer:
        'Yes. A quoted field may contain separators, double quotes and line breaks; its text is kept byte for byte and quoted again in the output when needed.',
      question: 'Are line breaks inside cells kept?',
    },
    {
      answer:
        'No. This tool converts, it does not sanitize: cells starting with =, +, - or @ are written unchanged. Use JSON ↔ CSV Converter with Prefix formula-like text when you need that.',
      question: 'Are formula-like cells escaped?',
    },
    {
      answer:
        'An unterminated quoted field, or text after a closing quote that is not a separator or line ending. The error gives its line and column.',
      question: 'What makes the input invalid?',
    },
    {
      answer:
        'No. The input is already text, so no encoding is guessed. A UTF-8 byte order mark at the start is ignored, and CRLF, LF and CR line endings are all read.',
      question: 'Is the file encoding detected?',
    },
  ],
  help: 'Paste CSV, TSV or pipe-separated text, or pick a sample.\n\nKeep Detect or choose the input separator, then choose the output separator.\n\nTurn on Quote every field if the target needs every field quoted.\n\nCopy the result or save it as a .csv or .tsv file.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: 5,000,000 characters, 100,000 data rows, 10,000 columns and 1,000,000 cells including the header, for both input and output.',
    'Blank lines in the input are skipped and do not count toward the 20 records used for detection.',
    'Output records always end with LF (\\n).',
    'Formula-like cells are not escaped: the tool converts and does not sanitize.',
    'No encoding detection: the input is already text. A UTF-8 byte order mark at the start is ignored.',
  ],
};
