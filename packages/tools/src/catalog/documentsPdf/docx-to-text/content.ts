import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A .docx file is a ZIP archive of XML parts. The main part holds the body as paragraphs and tables, a styles part names the heading styles, and a numbering part says which paragraphs are bullets or numbered items. This tool opens the archive in your browser, finds the main part through the package relationships and walks the body in order. Nothing is uploaded.\n\nHeadings come from the built-in style names heading 1 to heading 6 and from Title, even when the style id is localized, and otherwise from an outline level on the paragraph or its style. List items come from the numbering definitions, so a numbered list keeps its start value and restarts the deeper levels.',
      title: 'How the document is read',
    },
    {
      content: [
        'Direct bold, italic and strike-through become **, * and ~~ in Markdown, and adjacent runs with the same formatting are merged. Formatting that comes only from a style is ignored.',
        'Hyperlinks become [text](url) only for http, https and mailto addresses. Any other target, such as javascript:, stays plain text.',
        'A table becomes a pipe table whose first row is the header. Paragraphs in a cell are joined with <br>, a merged cell adds empty cells, and a table inside a cell is flattened into its text. Plain text output writes tab-separated rows.',
        'Tracked changes show the current view: inserted text is kept and deleted text is dropped. The result of a field such as a page number is kept and its instruction is dropped.',
      ],
      title: 'Formatting, links and tables',
    },
  ],
  examples: [
    'Convert a report to Markdown to paste it into a README or a wiki page.',
    'Choose Plain text to get the words with simple list markers and tab-separated table rows.',
    'Open the alias DOCX to Markdown to start with Markdown output selected.',
    'Check the summary to see how many headings, lists and tables were found.',
    'Convert a document with tracked changes to get the text as it reads with every change accepted.',
    'Use the result as a clean starting point before converting the Markdown to PDF.',
  ],
  faq: [
    {
      answer:
        'The tool supports .docx only. The old binary .doc format and password-protected files are not supported, and neither are OpenDocument .odt files. Open the file in Word or LibreOffice and save it as .docx without a password.',
      question: 'Why does an old or protected file fail?',
    },
    {
      answer:
        'Images, text boxes, equations, footnote references, comments, headers and footers are skipped. The summary counts what was skipped so you know the output is not the whole document.',
      question: 'What is left out?',
    },
    {
      answer:
        'Markdown uses ** for bold, * for italic and ~~ for strike-through only when the run itself is formatted. A style such as Strong that adds bold through the style sheet is not detected.',
      question: 'Why is some bold text not bold in the output?',
    },
    {
      answer:
        'Lists use the numbering definitions in the file. A bullet list uses - and an ordered list keeps its start value, so a list that starts at 3 prints 3. first. Nested items are indented by the width of the parent marker.',
      question: 'How are lists written?',
    },
    {
      answer:
        'The file can be up to 20 MiB, and the XML and the converted text are size limited. A document that exceeds a limit stops with an error naming it; nothing is cut off silently.',
      question: 'How large can a document be?',
    },
  ],
  help: 'Choose a .docx file. It converts straight away.\n\nPick Plain text or Markdown. The alias DOCX to Markdown starts with Markdown selected.\n\nRead the summary for the number of paragraphs, headings, lists and tables, and for what was skipped.\n\nCopy the text or save it as a .md or .txt file.',
  notes: [
    'Everything runs locally; the document never leaves your device.',
    'Images, text boxes, equations, footnote references, comments, headers and footers are skipped and counted in the summary.',
    'Formatting that comes only from a style is ignored; only direct bold, italic and strike-through reach the Markdown.',
    'Empty paragraphs collapse, so blocks are separated by exactly one blank line, and a page break starts a new paragraph.',
    'Content controls, smart tags, custom XML and simple fields keep their text, and the result of a complex field is kept.',
    'Documents from Word, Google Docs, LibreOffice, Pages and textutil are supported, including files without a style or numbering part.',
    'Text is escaped for Markdown, so characters such as * and _ in the document do not turn into formatting.',
  ],
};
